// src/app/api/review-recitation/route.js
import { NextResponse } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// تعريف المخطط الصارم لضمان فحص التلاوة وتقديم تقرير مفصل
const reviewResponseSchema = {
  type: Type.OBJECT,
  properties: {
    transcribedText: {
      type: Type.STRING,
      description: 'التفريغ الصوتي الخام لما نطق به القارئ حرفياً وحركياً بالضبط، حتى لو نطق تشكيلاً خاطئاً أو بدّل حرفاً.',
    },
    phoneticComparison: {
      type: Type.ARRAY,
      description: 'مقارنة دقيقة كلمة بكلمة وحركة بحركة بين المنطوق والمكتوب',
      items: {
        type: Type.OBJECT,
        properties: {
          targetWord: { type: Type.STRING, description: 'الكلمة بالتشكيل كما في المصحف' },
          spokenWord: { type: Type.STRING, description: 'الكلمة بالتشكيل كما لفظها القارئ بصوته' },
          hasDiscrepancy: { type: Type.BOOLEAN, description: 'هل يوجد اختلاف في حركة أو حرف؟' },
        },
        required: ['targetWord', 'spokenWord', 'hasDiscrepancy'],
      },
    },
    mistakes: {
      type: Type.ARRAY,
      description: 'قائمة الأخطاء المرصودة بالتفصيل سواء لحن جلي أو خفي',
      items: {
        type: Type.OBJECT,
        properties: {
          type: {
            type: Type.STRING,
            description: 'نوع الخطأ: لحن جلي (تبديل حركة، إبدال حرف، زيادة/نقص حرف، تسكين متحرك)، مد، قلقلة، غنة',
          },
          wordSpoken: {
            type: Type.STRING,
            description: 'الكلمة أو المقطع كما نطقه القارئ بالحركة أو الحرف الخاطئ',
          },
          wordCorrect: {
            type: Type.STRING,
            description: 'الرسم والتشكيل الصحيح في المصحف',
          },
          explanation: {
            type: Type.STRING,
            description: 'شرح الخطأ بدقة: مثلاً (ضم الميم بدلاً من كسرها، أو نطق سين بدلاً من صاد)',
          },
          howToFix: {
            type: Type.STRING,
            description: 'توجيه عملي ودقيق لكيفية نطق المخرج والحركة الصحيحة في المرة القادمة',
          },
        },
        required: ['type', 'wordSpoken', 'wordCorrect', 'explanation', 'howToFix'],
      },
    },
    score: {
      type: Type.INTEGER,
      description: 'الدرجة من 100: يخصم 15 نقطة لكل خطأ في التشكيل أو تبديل حرف (لحن جلي)، و 5 نقاط لكل خطأ تجويدي',
    },
    status: {
      type: Type.STRING,
      description: 'التقييم: متقن (95-100)، جيد جداً (80-94)، يحتاج ضبط الحركات (60-79)، لم يجتز (أقل من 60)',
    },
    tajweedObservations: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'ملاحظات دقيقة على التجويد، الغنن، المدود، والمخارج',
    },
    nextTimeAdvice: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'خطوات تدريبية محددة وقابلة للتطبيق لتحسين التلاوة في المرة القادمة',
    },
    generalFeedback: {
      type: Type.STRING,
      description: 'رسالة تقييمية ختامية تجمع بين الصراحة في كشف الأخطاء والتوجيه',
    },
  },
  required: [
    'transcribedText',
    'phoneticComparison',
    'mistakes',
    'score',
    'status',
    'tajweedObservations',
    'nextTimeAdvice',
    'generalFeedback',
  ],
};

async function generateRecitationReview(
  audioPart,
  promptText,
  systemInstruction
) {
  // الحفاظ على قائمة الموديلات الخاصة بك كما هي دون تعديل
  const models = [
    "gemini-3.5-flash-lite",
    "gemini-3.8-flash",
    "gemini-3.0-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash"
  ];
  let lastError = null;

  for (const model of models) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [audioPart, { text: promptText }],
            },
          ],
          config: {
            systemInstruction,
            temperature: 0.0,
            responseMimeType: 'application/json',
            responseSchema: reviewResponseSchema,
          },
        });

        return response.text || '{}';
      } catch (err) {
        lastError = err;
        console.warn(`Attempt ${attempt} on ${model} failed:`, err?.message || err);

        if (
          err?.status === 503 ||
          err?.message?.includes('high demand') ||
          err?.message?.includes('UNAVAILABLE')
        ) {
          await new Promise((res) => setTimeout(res, 1500 * attempt));
          continue;
        }
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

    // تم تدعيم التوجيه الصارم لكسر الانحياز ومنع التغاضي عن الحركات
    const systemInstruction = isAr
      ? `أنت نظام تدقيق صوتي جنائي ومُحكم تلاوة شديد الصرامة برواية حفص عن عاصم.
مهمتك الأولى والأساسية هي رصد "اللحن الجلي" (أخطاء التشكيل وتبديل الحروف) قبل التجويد والمدود.

تحذير جوهري لمكافحة التصحيح التلقائي (Anti-Autocorrect Protocol):
1. القارئ قد يتعمد قراءة حركات خاطئة لاختبارك (مثلاً: كسر المرفوع، ضم المجرور، تسكين المتحرك، تحويل الضاد إلى ظاء أو دال، تحويل السين إلى صاد، أو إسقاط الشدة).
2. إياك ثم إياك أن تصحح الكلمة في عقلك أو تفترض حسن النية! لا تعتمد على ما "يجب" أن يُقرأ، بل دوّن بدقة متناهية الحركات التي صوّت بها لسان القارئ فعلياً في "transcribedText".
3. التدقيق يبدأ أولاً باللحن الجلي: أي فتحة تحولت لضمة أو كسرة أو سكون تعتبر خطأ فادحاً (لحن جلي) وتُدرج فوراً في قائمة mistakes مع خصم مباشر من النتيجة.
4. التجويد (المد والغنة والقلقلة) يأتي في المرتبة الثانية بعد سلامة الحركات والحروف.`
      : `You are a forensic Quran audio auditor and strict recitation judge according to Hafs an Asim.
Your top priority is catching "Lahn Jali" (diacritic/vowel distortions and letter alterations) before tajweed.

Anti-Autocorrect & Anti-Hallucination Directives:
1. The user may deliberately alter vowel diacritics (Fathah, Dammah, Kasrah, Sukun) or mispronounce letters to test your accuracy.
2. Under no circumstances should you "auto-correct" what you hear. Write down the verbatim vocalized sounds and short vowels that actually hit the audio track into "transcribedText".
3. Any vowel change (e.g. pronouncing Dammah instead of Kasrah, or Sukun instead of Fathah) is a major mistake (Lahn Jali) and MUST be recorded in the mistakes array.
4. Tajweed rules (Ghunnah, Madd) are secondary to vowel and letter accuracy.`;

    const promptText = isAr
      ? `السورة: ${surahName} (الآيات من ${startAya} إلى ${endAya}).

النص القرآني المعتمد والمشكول بالمصحف:
"""
${targetVersesText}
"""

خطوات التحكيم الإلزامية:
الخطوة 1: استمع للصوت وفرغ ما نطق به القارئ بحركاته الصوتية الواقعية دون مجاملة أو تصحيح تلقائي في حقل (transcribedText).
الخطوة 2: قارن كل كلمة مسموعة بالكلمة المقابلة لها في النص المعتمد حرفاً بحرف وحركة بحركة في (phoneticComparison).
الخطوة 3: إذا وجدت كلمة نُطقت بحركة مختلفة (مثلاً: رَبِّ نُطقت رَبَّ، أو العَالَمِينَ نُطقت العَالَمُونَ، أو غَيْرِ نُطقت غَيْرَ) أو سُكّن متحرك، يجب وضعها كخطأ لحن جلي في (mistakes) مع تحديد كلمة القارئ والصواب وكيفية إصلاحها.
الخطوة 4: احسب الدرجة بنظام الخصم الحقيقي: كل خطأ تشكيل أو حرف يخصم 15%، وإذا تكررت أخطاء التشكيل يجب ألا تتجاوز النتيجة 60%.`
      : `Surah: ${surahName} (Verses ${startAya} to ${endAya}).

Official Vowelled Quranic Text:
"""
${targetVersesText}
"""

Mandatory Evaluation Protocol:
Step 1: Faithfully transcribe the audio with the exact short vowels/letters spoken into (transcribedText) without auto-correcting mistakes.
Step 2: Align and compare every spoken word against the target word in (phoneticComparison).
Step 3: If any vowel differs (e.g., Fathah replaced by Kasrah/Dammah/Sukun) or letter changed, immediately log it in (mistakes) as Lahn Jali.
Step 4: Strictly deduct 15 points per vowel/letter mistake from the score.`;

    const rawResult = await generateRecitationReview(
      audioPart,
      promptText,
      systemInstruction
    );

    const jsonResult = JSON.parse(rawResult);
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