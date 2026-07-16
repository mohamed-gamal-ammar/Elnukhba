import { GoogleGenAI } from "@google/genai";
import { db } from "./db.js";

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      console.warn("GEMINI_API_KEY is not defined or is placeholder. AI Assistant will operate in fallback helper mode.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Generate the dynamic grounding context for the AI based on products and FAQs in our DB
function buildSystemInstruction(): string {
  const products = db.getProducts();
  const faqs = db.getFaqs();
  const settings = db.getSettings();

  let productsText = "";
  products.forEach(p => {
    productsText += `- المنتج: ${p.title} (${p.brand})
  السعر الأساسي: ${p.price} ج.م ${p.discountPrice ? `(سعر العرض الحالي: ${p.discountPrice} ج.م!)` : ""}
  المواصفات: ${p.specifications.map(s => `${s.key}: ${s.value}`).join(' | ')}
  المميزات الرئيسية: ${p.features.join(' | ')}
  التقييم: ${p.rating}/5
  المخزون المتاح: ${p.stock} وحدة
  رابط المعاينة معرف: ${p.id}
  ---
  `;
  });

  let faqsText = "";
  faqs.forEach(f => {
    faqsText += `س: ${f.question}\nج: ${f.answer}\n\n`;
  });

  return `أنت مساعد التسوق الذكي لمتجر "${settings.logoText} ${settings.logoSubtext}".
أنت تتكلم بلغة عربية ودودة ومحترفة للغاية، وتساعد العملاء في اختيار الأجهزة المنزلية والإلكترونيات الأنسب لاحتياجاتهم وميزانياتهم.

هذه هي المنتجات المتوفرة حالياً في متجرنا (لا تذكر أي منتجات غير موجودة في هذه القائمة):
${productsText}

تفاصيل الدفع والشحن والسياسات:
- الدفع: الدفع عند الاستلام فقط (Cash on Delivery) نقداً أو بالفيزا مع المندوب.
- الشحن: الشحن لجميع المحافظات موحد بتكلفة ${settings.shippingFlatRate} ج.م ويستغرق 2-4 أيام عمل.
- الأسئلة الشائعة المتوفرة:
${faqsText}

تعليمات مهمة لإجاباتك:
1. يرجى توجيه العملاء دائماً إلى أجهزتنا الحقيقية المذكورة أعلاه وشرح مزاياها وأسعارها بدقة مع تقديم نصيحة احترافية مقنعة.
2. إذا سأل العميل عن منتج معين، قارنه له بمنتجاتنا أو اعرض له البديل المتاح لدينا.
3. يمكنك استخدام التنسيقات البسيطة مثل النقاط العريضة والخطوط العريضة لتبسيط القراءة.
4. حافظ على نبرة مبيعات ودية ومستشارة خبيرة بالمنزل العصري.
5. يرجى الاختصار والإيجاز في الإجابات بحيث تكون سريعة وسهلة القراءة ومباشرة (لا تتجاوز إجابتك 3-4 فقرات قصيرة).`;
}

export async function askAssistant(message: string, history: { role: 'user' | 'model'; parts: { text: string }[] }[]): Promise<string> {
  const client = getAiClient();

  if (!client) {
    // Return high-quality offline rule-based help in Arabic if API key is missing
    return getOfflineResponse(message);
  }

  try {
    const systemInstruction = buildSystemInstruction();
    
    // Structure chat content from custom state history
    const contents = [
      ...history.map(h => ({
        role: h.role,
        parts: h.parts
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const response = await client.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "عذراً، لم أستطع صياغة رد مناسب حالياً. كيف يمكنني مساعدتك بطريقة أخرى؟";
  } catch (error) {
    console.error("Gemini API call failed:", error);
    return getOfflineResponse(message);
  }
}

// Highly comprehensive offline helper fallback using local string analysis
function getOfflineResponse(message: string): string {
  const msgLower = message.toLowerCase();
  
  if (msgLower.includes('تلفزيون') || msgLower.includes('شاشة') || msgLower.includes('lg') || msgLower.includes('ال جي')) {
    return `أهلاً بك! نوفر لك حالياً **شاشة تلفزيون إل جي OLED65C3 ذكية 4K UHD قياس 65 بوصة** بسعر رائع وهو **44,999 ج.م** بدلاً من **49,999 ج.م**!
    \nتتميز هذه الشاشة بتقنية OLED المتطورة التي توفر تبايناً مثالياً ولوناً أسود مطلقاً، بالإضافة لمعالج ذكي لدعم ترقية الصورة، ومعدل تحديث 120 هرتز مما يجعلها الخيار المثالي لعشاق الألعاب والسينما المنزلية.
    \nهل ترغب في إضافة هذه الشاشة الفاخرة لسلة تسوقك الآن؟`;
  }
  
  if (msgLower.includes('ثلاجة') || msgLower.includes('سامسونج') || msgLower.includes('تبريد') || msgLower.includes('refrigerator')) {
    return `أهلاً بك! لدينا واحدة من أفضل الثلاجات مبيعاً: **ثلاجة سامسونج ديجيتال إنفرتر نوفروست 450 لتر** باللون الفضي الساحر أو الأسود الزجاجي.
    \nسعرها الحالي في العرض هو **26,999 ج.م** بدلاً من **28,400 ج.م**، وتأتي بضمان 10 سنوات كاملة على الضاغط الرقمي (الموتور) وتتميز بنظام نوفروست لمنع الثلج وتوفير كبير للكهرباء.
    \nما رأيك، هل تود معرفة المزيد من مواصفاتها الفنية؟`;
  }
  
  if (msgLower.includes('غسالة') || msgLower.includes('توشيبا') || msgLower.includes('غسيل') || msgLower.includes('washing')) {
    return `مرحباً بك! لدينا **غسالة ملابس توشيبا فوق أوتوماتيك بسعة 11 كيلو جرام** بسعر عرض متميز للغاية وهو **16,800 ج.م** (متوفرة أيضاً بسعة 13 كجم بسعر 19,200 ج.م).
    \nتأتي بضمان 5 سنوات كاملة وتتميز بمروحة هجين تمنع تشابك الملابس تماماً وتوفر كثيراً في المياه ومسحوق الغسيل وسهلة للغاية في الاستخدام والتحميل العلوي.
    \nهل ترغب في أن أساعدك بإضافتها لسلة المشتريات؟`;
  }

  if (msgLower.includes('تكييف') || msgLower.includes('كاريير') || msgLower.includes('بارد') || msgLower.includes('حر') || msgLower.includes('تبريد')) {
    return `مرحباً! نوصي بشدة بـ **تكييف كاريير إنفرتر بارد/ساخن 2.25 حصان اوبتيماكس**، وهو متاح بسعر خاص جداً وهو **29,999 ج.م** بدلاً من **32,500 ج.م**!
    \nيتميز بتقنية الإنفرتر الموفرة لـ 40٪ من استهلاك الكهرباء، ونظام فلاتر متقدم لتنقية الأجواء وشاشة ديجيتال أنيقة وضمان 5 سنوات.
    \nيسعدني جداً مساعدتك في حجز هذا التكييف لتنعم بجو مريح في بيتك.`;
  }

  if (msgLower.includes('خلاط') || msgLower.includes('تورنيدو') || msgLower.includes('مايكروويف') || msgLower.includes('شارب') || msgLower.includes('مطبخ')) {
    return `يسعدني خدمتك! لدينا أجهزة مطبخ صغيرة متميزة:
    \n1. **خلاط كهربائي تورنيدو 1.5 لتر** بقوة 500 وات ومطحنتين بسعر فلاش مدهش وهو **999 ج.م** فقط!
    \n2. **مايكروويف شارب ديجيتال 25 لتر بالشواية** بلونه الفضي الميتاليك بسعر **6,200 ج.م** بدلاً من **6,800 ج.م**!
    \nكل هذه الأجهزة تأتي مع الضمان الرسمي المعتمد من الوكلاء في مصر. أي منها تبحث عنه لتجهيز مطبخك؟`;
  }

  if (msgLower.includes('شحن') || msgLower.includes('توصيل') || msgLower.includes('دفع') || msgLower.includes('استلام') || msgLower.includes('عنوان')) {
    return `بالتأكيد، إليك تفاصيل سياسات الشحن والدفع لدينا:
    \n- **طريقة الدفع**: نوفر خدمة **الدفع عند الاستلام فقط** (Cash on Delivery) لتتسلم أجهزتك وتفحصها جيداً قبل الدفع.
    \n- **تكلفة التوصيل**: تكلفة شحن موحدة لجميع محافظات مصر بقيمة **50 جنيهاً مصرياً** فقط.
    \n- **مدة التوصيل**: تستغرق الشحنات من **2 إلى 4 أيام عمل** لتصل لعنوانك مغلفة ومؤمنة تماماً.`;
  }

  return `أهلاً بك في متجر النخبة للأجهزة المنزلية والإلكترونيات! أنا مساعدك الذكي لمبيعات الأجهزة.
  \nيمكنني مساعدتك في اختيار أفضل تلفزيونات LG OLED، ثلاجات سامسونج الإنفرتر، غسالات توشيبا فوق الأوتوماتيك، تكييفات كاريير، أو أجهزة المطبخ الرائعة مثل مايكروويف شارب وخلاطات تورنيدو.
  \nأخبرني، ما هو الجهاز الذي ترغب في تصفحه أو شرائه اليوم للبيت؟ أو اسألني عن الشحن والتوصيل وضمان المنتجات!`;
}
