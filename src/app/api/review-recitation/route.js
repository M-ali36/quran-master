// src/app/api/review-recitation/route.js
import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// دالة التوليد المعتمدة لديك مع نظام إعادة المحاولة والموديل البديل
async function generateRecitationReview(
  audioPart,
  promptText,
  systemInstruction
) {
  const models = ['gemini-3.8-flash', 'gemini-2.5-pro'];
  let lastError = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                audioPart,
                { text: promptText },
              ],
            },
          ],
          config: {
            systemInstruction,
            temperature: 0.2,
          },
        });

        return response.text || '';
      } catch (err) {
        lastError = err;
        console.warn(`Attempt ${attempt} on ${model} failed:`, err?.message || err);

        // إذا كان الخطأ 503 (ضغط على السيرفر) انتظر وجرب مرة أخرى
        if (
          err?.status === 503 ||
          err?.message?.includes('high demand') ||
          err?.message?.includes('UNAVAILABLE')
        ) {
          await new Promise((res) => setTimeout(res, 1200 * attempt));
          continue;
        }

        // لأي خطأ آخر، انتقل فوراً للموديل البديل
        break;
      }
    }
  }

  throw lastError;
}

export async function POST(req) {
  try {
    const formData = await req.formData();
    const audioFile = formData.get('audio');
    const targetVersesText = formData.get('targetVersesText');
    const surahName = formData.get('surahName') || '';
    const startAya = formData.get('startAya') || '1';
    const endAya = formData.get('endAya') || '1';
    const lang = formData.get('lang') || 'ar';

    if (!audioFile || !targetVersesText) {
      return NextResponse.json(
        {
          error:
            lang === 'ar'
              ? 'الملف الصوتي ونصوص الآيات مطلوبة'
              : 'Audio file and verses text are required',
        },
        { status: 400 }
      );
    }

    // تجهيز الصوت بصيغة Base64
    const audioBytes = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(audioBytes).toString('base64');
    let mimeType = audioFile.type || 'audio/webm';
    if (mimeType.includes(';')) {
      mimeType = mimeType.split(';')[0].trim();
    }

    const audioPart = {
      inlineData: {
        mimeType: mimeType || 'audio/webm',
        data: base64Audio,
      },
    };

    const isAr = lang === 'ar';

    const systemInstruction = isAr
      ? 'أنت معلم قرآن كريم ومصحح تلاوة معتمد. مهمتك فحص التلاوة الصوتية مقارنة بالنص القرآني، واكتشاف أخطاء الحفظ وتغيير الكلمات واللحن الجلي في التشكيل، والرد بصيغة JSON نظيفة فقط.'
      : 'You are an expert Quran recitation reviewer and teacher. Evaluate the spoken recitation against the target Quranic text, detect mistakes, and return strictly a valid JSON object.';

    const promptText = isAr
      ? `السورة: ${surahName} (من الآية ${startAya} إلى الآية ${endAya}).
النص القرآني المعتمد المطلوب:
"""
${targetVersesText}
"""

استمع للملف الصوتي بدقة وقارنه بالنص المعتمد أعلاه.
أخرج كائن JSON فقط بدون أي علامات markdown أو كود خارجي:
{
  "score": 90,
  "status": "ممتاز / جيد جداً / يحتاج مراجعة",
  "transcribedText": "النص المنطوق كما سُمع",
  "mistakes": [
    { "word": "الكلمة المنطوقة", "correction": "الكلمة الصحيحة", "reason": "سبب الخطأ" }
  ],
  "feedback": "ملاحظة تشجيعية وتوجيه تجويدي"
}`
      : `Surah: ${surahName} (from verse ${startAya} to verse ${endAya}).
Verified Target Quranic Text:
"""
${targetVersesText}
"""

Listen to the audio recitation and compare it against the target verses.
Output strictly a JSON object with this exact structure:
{
  "score": 90,
  "status": "Excellent / Very Good / Needs Review",
  "transcribedText": "Transcribed spoken text",
  "mistakes": [
    { "word": "spoken word", "correction": "correct word", "reason": "reason for mistake" }
  ],
  "feedback": "Encouraging remark and concise tajweed tip"
}`;

    // تشغيل التوليد عبر دالة الـ Fallback والـ Retry
    const rawResult = await generateRecitationReview(
      audioPart,
      promptText,
      systemInstruction
    );

    // تنظيف استجابة الـ JSON
    const cleanJson = (rawResult || '')
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();

    const jsonResult = JSON.parse(cleanJson);
    return NextResponse.json(jsonResult);
  } catch (error) {
    console.error('Quran Review API Error:', error);
    return NextResponse.json(
      {
        error:
          error?.status === 503 || error?.message?.includes('high demand')
            ? 'الخدمة تواجه ضغطاً كبيراً حالياً، يرجى إعادة المحاولة بعد لحظات.'
            : error?.message || 'Failed to evaluate recitation',
      },
      { status: error?.status || 500 }
    );
  }
}