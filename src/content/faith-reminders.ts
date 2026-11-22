// Peace reminders for the Faith page.
// CONTENT RULES: Quran only (short, well-known excerpts of a verse). No hadith, no fatwa, no tafsir claims.
// The "meaning" lines are a plain, simple paraphrase for orientation, NOT a tafsir.
// The Arabic text MUST be checked against a printed mushaf or quran.com before release (see `ref` for each item).
// Do not edit the Arabic text from code; if a correction is needed, change it here and re-check it.

export type FaithReminder = {
  id: string;
  /** Arabic text (an excerpt of the verse, exactly as in the mushaf). */
  ar: string;
  /** Source in Arabic, e.g. "سورة الشرح، آية 5". */
  sourceAr: string;
  /** Source in English. */
  sourceEn: string;
  /** Reference "surah:ayah", used to build a verification link. */
  ref: string;
  meaningAr: string;
  meaningEn: string;
  /** A tiny, optional, no-pressure step for today. */
  gentleAr: string;
  gentleEn: string;
};

export const FAITH_REMINDERS: readonly FaithReminder[] = [
  {
    id: 'sharh-5',
    ar: 'فَإِنَّ مَعَ الْعُسْرِ يُسْرًا',
    sourceAr: 'سورة الشرح، آية 5',
    sourceEn: 'Surah Ash-Sharh, verse 5',
    ref: '94:5',
    meaningAr: 'مع الضيق بييجي فرج، والتعب مش بيفضل للأبد.',
    meaningEn: 'Ease comes along with hardship; the hard time does not last forever.',
    gentleAr: 'خد نفس عميق، وافتكر موقف صعب عدّى عليك قبل كده.',
    gentleEn: 'Take one deep breath and remember a hard time that passed.',
  },
  {
    id: 'raad-28',
    ar: 'أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ',
    sourceAr: 'سورة الرعد، آية 28',
    sourceEn: 'Surah Ar-Ra’d, verse 28',
    ref: '13:28',
    meaningAr: 'ذكر الله بيدّي القلب هدوء وطمأنينة.',
    meaningEn: 'Remembering God brings calm to the heart.',
    gentleAr: 'لو حابب: قول "سبحان الله" ببطء كذا مرة.',
    gentleEn: 'If you like: say "SubhanAllah" slowly a few times.',
  },
  {
    id: 'baqarah-286',
    ar: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا',
    sourceAr: 'سورة البقرة، آية 286',
    sourceEn: 'Surah Al-Baqarah, verse 286',
    ref: '2:286',
    meaningAr: 'ربنا مبيحمّلش حد فوق طاقته.',
    meaningEn: 'God does not burden a soul beyond what it can bear.',
    gentleAr: 'اختار حاجة واحدة صغيرة بس تعملها النهارده، والباقي سيبه.',
    gentleEn: 'Pick just one small thing to do today and let the rest go.',
  },
  {
    id: 'baqarah-186',
    ar: 'وَإِذَا سَأَلَكَ عِبَادِي عَنِّي فَإِنِّي قَرِيبٌ',
    sourceAr: 'سورة البقرة، آية 186',
    sourceEn: 'Surah Al-Baqarah, verse 186 (excerpt)',
    ref: '2:186',
    meaningAr: 'ربنا قريب منك، وتقدر تكلمه في أي وقت.',
    meaningEn: 'God is near, and you can speak to Him at any time.',
    gentleAr: 'قول له في سرّك اللي في قلبك، بأي كلمات.',
    gentleEn: 'Tell Him quietly what is on your heart, in any words.',
  },
  {
    id: 'duha-3',
    ar: 'مَا وَدَّعَكَ رَبُّكَ وَمَا قَلَىٰ',
    sourceAr: 'سورة الضحى، آية 3',
    sourceEn: 'Surah Ad-Duha, verse 3',
    ref: '93:3',
    meaningAr: 'ربك ما سابكش وما زعلش منك.',
    meaningEn: 'Your Lord has not abandoned you, nor is He displeased with you.',
    gentleAr: 'لو حاسس إنك بعيد، ابدأ بخطوة صغيرة جدًا النهارده.',
    gentleEn: 'If you feel distant, start with one very small step today.',
  },
  {
    id: 'baqarah-153',
    ar: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ',
    sourceAr: 'سورة البقرة، آية 153',
    sourceEn: 'Surah Al-Baqarah, verse 153 (excerpt)',
    ref: '2:153',
    meaningAr: 'ربنا مع اللي بيصبر.',
    meaningEn: 'God is with those who are patient.',
    gentleAr: 'قبل ما ترد على حاجة مضايقاك، استنى عدّ لعشرة.',
    gentleEn: 'Before reacting to something annoying, count to ten.',
  },
  {
    id: 'imran-139',
    ar: 'وَلَا تَهِنُوا وَلَا تَحْزَنُوا',
    sourceAr: 'سورة آل عمران، آية 139',
    sourceEn: 'Surah Aal Imran, verse 139 (excerpt)',
    ref: '3:139',
    meaningAr: 'متضعفوش ومتحزنوش.',
    meaningEn: 'Do not lose heart and do not grieve.',
    gentleAr: 'اكتب في يومياتك حاجة واحدة لسه واقف بيها.',
    gentleEn: 'Write one thing in your journal that you are still standing for.',
  },
  {
    id: 'yusuf-87',
    ar: 'وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ',
    sourceAr: 'سورة يوسف، آية 87',
    sourceEn: 'Surah Yusuf, verse 87 (excerpt)',
    ref: '12:87',
    meaningAr: 'متيأسش من رحمة ربنا وفرجه.',
    meaningEn: 'Do not lose hope in God’s mercy.',
    gentleAr: 'افتكر حلم ليك، وابعت لنفسك رسالة للمستقبل.',
    gentleEn: 'Think of a dream of yours, and write your future self a letter.',
  },
  {
    id: 'zumar-53',
    ar: 'لَا تَقْنَطُوا مِن رَّحْمَةِ اللَّهِ',
    sourceAr: 'سورة الزمر، آية 53',
    sourceEn: 'Surah Az-Zumar, verse 53 (excerpt)',
    ref: '39:53',
    meaningAr: 'رحمة ربنا واسعة، فمتفقدش الأمل.',
    meaningEn: 'Do not despair of God’s mercy.',
    gentleAr: 'النهارده سامح نفسك على حاجة صغيرة.',
    gentleEn: 'Today, forgive yourself for one small thing.',
  },
  {
    id: 'baqarah-152',
    ar: 'فَاذْكُرُونِي أَذْكُرْكُمْ',
    sourceAr: 'سورة البقرة، آية 152',
    sourceEn: 'Surah Al-Baqarah, verse 152 (excerpt)',
    ref: '2:152',
    meaningAr: 'اذكروني أذكركم: لما تفتكر ربنا، هو بيفتكرك.',
    meaningEn: 'Remember Me and I will remember you.',
    gentleAr: 'خد دقيقة تحمد ربنا على 3 حاجات.',
    gentleEn: 'Take a minute to thank God for three things.',
  },
  {
    id: 'talaq-3',
    ar: 'وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ',
    sourceAr: 'سورة الطلاق، آية 3',
    sourceEn: 'Surah At-Talaq, verse 3 (excerpt)',
    ref: '65:3',
    meaningAr: 'اللي بيعتمد على ربنا، ربنا كافيه.',
    meaningEn: 'Whoever relies on God, He is enough for him.',
    gentleAr: 'خد بالأسباب اللي في إيدك، وسيب الباقي على ربنا.',
    gentleEn: 'Do what is within your hands, and leave the rest to God.',
  },
  {
    id: 'hadid-4',
    ar: 'وَهُوَ مَعَكُمْ أَيْنَ مَا كُنتُمْ',
    sourceAr: 'سورة الحديد، آية 4',
    sourceEn: 'Surah Al-Hadid, verse 4 (excerpt)',
    ref: '57:4',
    meaningAr: 'ربنا معاك في أي مكان وأي وقت.',
    meaningEn: 'He is with you wherever you are.',
    gentleAr: 'وإنت ماشي النهارده، افتكر إنك مش لوحدك.',
    gentleEn: 'While you walk today, remember you are not alone.',
  },
  {
    id: 'tawbah-40',
    ar: 'لَا تَحْزَنْ إِنَّ اللَّهَ مَعَنَا',
    sourceAr: 'سورة التوبة، آية 40',
    sourceEn: 'Surah At-Tawbah, verse 40 (excerpt)',
    ref: '9:40',
    meaningAr: 'متحزنش، ربنا معانا.',
    meaningEn: 'Do not grieve; God is with us.',
    gentleAr: 'كلّم حد بتثق فيه النهارده.',
    gentleEn: 'Talk to someone you trust today.',
  },
  {
    id: 'duha-5',
    ar: 'وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ',
    sourceAr: 'سورة الضحى، آية 5',
    sourceEn: 'Surah Ad-Duha, verse 5',
    ref: '93:5',
    meaningAr: 'ربنا هيدّيك لحد ما ترضى.',
    meaningEn: 'Your Lord is going to give you, and you will be pleased.',
    gentleAr: 'اكتب حاجة إنت متفائل بيها.',
    gentleEn: 'Write down one thing you are hopeful about.',
  },
] as const;

/**
 * Picks the reminder for a calendar day. Deterministic: the same day always gives the same reminder,
 * and consecutive days rotate through the list.
 * @param dayKey 'YYYY-MM-DD' (the user's local day)
 */
export function reminderForDay(dayKey: string): FaithReminder {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dayKey);
  const days = m ? Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86_400_000) : 0;
  const n = FAITH_REMINDERS.length;
  return FAITH_REMINDERS[((days % n) + n) % n];
}