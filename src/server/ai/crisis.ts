/**
 * Crisis-language check. Runs BEFORE any LLM call (see /api/chat).
 * If it fires, the LLM is skipped and a fixed, reviewed safe response is returned.
 *
 * This is a keyword safety net, not a diagnosis. It is intentionally conservative:
 * a false alarm shows a caring message; a miss could be harmful.
 *
 * Pure module (no server-only imports) so it can be unit-tested.
 */

export type CrisisLanguage = 'ar' | 'en';

/**
 * Help resources shown in the crisis response.
 *  - 123: Egyptian ambulance.
 *  - findahelpline.com: international directory of crisis lines.
 */
export const CRISIS_RESOURCES = {
  ambulanceEG: '123',
  directory: 'findahelpline.com',
} as const;

const CRISIS_MESSAGES: Record<CrisisLanguage, string> = {
  ar: [
    'أنا هنا ومهتم بسلامتك. اللي بتمر بيه دلوقتي شكله تقيل جدًا، وكلامك مهم.',
    '',
    'لو في خطر فوري أو بتفكر تأذي نفسك، من فضلك تواصل مع حد تثق فيه واتصل بالطوارئ أو توجّه لأقرب قسم طوارئ:',
    `• الإسعاف في مصر: ${CRISIS_RESOURCES.ambulanceEG}`,
    `• للعثور على خط دعم موثوق في بلدك: ${CRISIS_RESOURCES.directory}`,
    '',
    'ولو تقدر، ما تفضلش لوحدك دلوقتي. كلّم حد من أهلك أو أصحابك وقوله إنك محتاج حد جنبك.',
    '',
    'أنا هنا ومستعد أكمّل معاك الكلام. وفاكرك إني مساعد ذكاء اصطناعي، ومش بديل عن دعم إنساني أو متخصص.',
  ].join('\n'),
  en: [
    "I'm here, and I care about your safety. What you're going through sounds really heavy, and what you said matters.",
    '',
    "If you're in immediate danger or thinking about hurting yourself, please reach out to someone you trust and contact emergency services or go to the nearest emergency department:",
    `• Egypt ambulance: ${CRISIS_RESOURCES.ambulanceEG}`,
    `• Find a verified support line in your country: ${CRISIS_RESOURCES.directory}`,
    '',
    "If you can, please don't stay alone right now. Tell a family member or a friend that you need someone beside you.",
    '',
    "I'm here and happy to keep talking with you. I'm an AI assistant, so I can't replace human or professional support.",
  ].join('\n'),
};

/** Lower-case, strip Arabic diacritics/tatweel, and unify letter variants so patterns stay short. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, '') // tashkeel + tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, ' ');
}

// Patterns are written against NORMALIZED text (see normalize()).
const AR_PATTERNS: RegExp[] = [
  /نتحر|انتحار/,
  /(?:^| )(?:[اهبح]?(?:قتل|ذبح|شنق|نهي)|اضيع|اتخلص من) (?:نفسي|حياتي)/,
  /(اخلص|اقضي) علي نفسي/,
  /(عايز|عاوز|عايزه|عاوزه|نفسي|حابب|احب|اريد|ابغي) (ان |اني )?اموت(?! من (ال)?(ضحك|جوع|برد|حر))/,
  /(مش|لا) (عايز|عاوز|عايزه|عاوزه|اريد|ارغب)( ان| في| ف)? (اعيش|اكمل|الحياه|استمر)/,
  /(تعبت|زهقت|كرهت) (من )?(حياتي|الحياه|عيشتي)/,
  /(تعبت|زهقت|كرهت) من الدنيا/,
  /(?:مش|ما) قادره? (?:اعيش|اكمل|استمر)/,
  /(?:نفسي|عايزه?|عاوزه?|حابب|احب|اريد) (?:اختفي|اغيب) (?:لل?ابد|خالص|نهائي)/,
  /(اذي|اوذي|ايذاء|اذيه) نفسي/,
  /(اجرح|اقطع|احرق) (نفسي|ايدي|شرايني|وريدي|دراعي)/,
  /(?:ما ?|م)فيش (?:فايده|امل) (?:من )?(?:حياتي|اعيش|اكمل)/,
  /(مفيش|ما فيش) سبب (اعيش|اكمل|للحياه)/,
];

const EN_PATTERNS: RegExp[] = [
  /\bsuicid(e|al)\b/,
  /\b(kill(ing)?|hurt(ing)?|harm(ing)?|cut(ting)?|end(ing)?)\s+(myself|my\s+life)\b/,
  /\bwant(ed)?\s+(to\s+)?(die|be\s+dead)\b(?!\s+(laughing|of\s+(laughter|embarrassment|shame)|from\s+(laughter|embarrassment)))/,
  /\bwanna\s+die\b/,
  /\b(?:wish|wished)\s+(?:i\s+)?(?:were|was)\s+dead\b/,
  /\bwant(?:ed)?\s+to\s+end\s+it(?:\s+all)?\b/,
  /\b(?:can't|cannot)\s+(?:keep\s+going|go\s+on|do\s+this\s+anymore|take\s+it\s+anymore)\b/,
  /\b(don'?t|do\s+not|no\s+longer)\s+want\s+to\s+(live|be\s+alive|exist)\b/,
  /\bno\s+reason\s+to\s+(live|go\s+on)\b/,
  /\bbetter\s+off\s+(dead|without\s+me)\b/,
  /\bend(ing)?\s+it\s+all\b/,
  /\bself[\s-]?harm\b/,
  /\btake\s+my\s+(own\s+)?life\b/,
];

export function detectCrisis(text: string): boolean {
  const normalized = normalize(text);
  return AR_PATTERNS.some((p) => p.test(normalized)) || EN_PATTERNS.some((p) => p.test(normalized));
}

/** Picks the language of the reply from the message itself, falling back to the UI locale. */
export function pickLanguage(text: string, fallback: CrisisLanguage): CrisisLanguage {
  if (/[؀-ۿ]/.test(text)) return 'ar';
  if (/[a-z]/i.test(text)) return 'en';
  return fallback;
}

export function crisisResponse(language: CrisisLanguage): string {
  return CRISIS_MESSAGES[language];
}
