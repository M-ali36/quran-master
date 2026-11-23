// src/app/api/review-recitation/route.js
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(request) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");
    const targetVersesText = formData.get("targetVersesText");
    const surahName = formData.get("surahName");
    const startAya = formData.get("startAya");
    const endAya = formData.get("endAya");
    const lang = formData.get("lang") || "ar";

    if (!audioFile || !targetVersesText) {
      return NextResponse.json(
        { error: lang === "ar" ? "الملف الصوتي ونصوص الآيات مطلوبة" : "Audio file and verses text are required" },
        { status: 400 }
      );
    }

    const audioBytes = await audioFile.arrayBuffer();
    const base64Audio = Buffer.from(audioBytes).toString("base64");
    const mimeType = audioFile.type || "audio/webm";

    // تكييف الـ Prompt حسب اللغة المختارة
    const isAr = lang === "ar";
    const prompt = isAr
      ? `
أنت معلم قرآن كريم ومصحح تلاوة معتمد.
المستخدم قرأ تلاوة صوتية لمجموعة من الآيات من سورة ${surahName} (من الآية ${startAya} إلى الآية ${endAya}).
النص القرآني الصحيح المعتمد المطلوب هو:
"""
${targetVersesText}
"""

مهمتك:
1. استمع للتسجيل الصوتي بدقة وقارنه بالآيات المطلوبة.
2. احسب نسبة صحة الحفظ والدقة (Score من 100).
3. رصّد أي أخطاء في الحفظ (كلمات سقطت، كلمات أُبدلت، كلمات زائدة).
4. رصّد أي لحن جلي في التشكيل والحركات الإعرابية الصريحة.
5. قدّم نصيحة تجويدية موجزة.

أجب فقط بصيغة JSON نظيفة بدون Markdown (بدون \`\`\`json):
{
  "score": 92,
  "status": "ممتاز / جيد جداً / يحتاج مراجعة",
  "transcribedText": "النص المكتوب كما قاله المستخدم بدقة",
  "mistakes": [
    { "word": "الكلمة كما قرأها", "correction": "الكلمة الصحيحة", "reason": "خطأ في الحركة / كلمة منسية" }
  ],
  "feedback": "ملاحظة تشجيعية موجزة ونصيحة تجويدية باللغة العربية"
}
`
      : `
You are a certified Quran teacher and recitation examiner.
The user recited verses from Surah ${surahName} (from verse ${startAya} to ${endAya}).
The verified Quranic text is:
"""
${targetVersesText}
"""

Task:
1. Listen closely to the audio recitation and compare it against the target verses.
2. Calculate the memorization and recitation accuracy score (0-100).
3. Identify mistakes (skipped words, altered words, extra words).
4. Identify obvious vocalization/tashkeel errors (Lahn Jali).
5. Give a concise pedagogical and tajweed tip in English.

Respond strictly in clean JSON with no Markdown code fences:
{
  "score": 92,
  "status": "Excellent / Very Good / Needs Review",
  "transcribedText": "Transcribed text as recited by the user",
  "mistakes": [
    { "word": "recited word", "correction": "correct word", "reason": "Tashkeel error / Skipped word" }
  ],
  "feedback": "Encouraging remark and concise tajweed tip in English"
}
`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType,
                data: base64Audio,
              },
            },
          ],
        },
      ],
    });

    const responseText = response.text?.trim() || "{}";
    const cleanJson = responseText.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    const result = JSON.parse(cleanJson);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Quran Review API Error:", error);
    return NextResponse.json(
      { error: "Failed to evaluate recitation" },
      { status: 500 }
    );
  }
}