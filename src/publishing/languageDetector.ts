export interface LanguageDetectionResult {
  code: string;
  label: string;
  source: 'transcript_model' | 'heuristic_text' | 'fallback_default';
  translated: boolean;
  translationNote: string | null;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  hi: 'Hindi',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  ru: 'Russian',
};

const STOPWORD_MARKERS: Record<string, readonly string[]> = {
  es: ['que', 'para', 'como', 'pero', 'porque', 'cuando', 'sobre', 'esto', 'esta', 'aquí'],
  pt: ['não', 'para', 'como', 'mais', 'quando', 'sobre', 'isso', 'você', 'então', 'muito'],
  fr: ['pour', 'avec', 'dans', 'mais', 'nous', 'vous', 'cette', 'comme', 'quand', 'être'],
  de: ['nicht', 'und', 'für', 'eine', 'dass', 'aber', 'wenn', 'über', 'oder', 'sind'],
  it: ['che', 'per', 'con', 'non', 'una', 'sono', 'come', 'questo', 'anche', 'più'],
  en: ['the', 'and', 'that', 'with', 'this', 'from', 'they', 'would', 'about', 'there'],
};

export function normalizeLanguageCode(rawCode?: string | null): string {
  if (!rawCode) return 'en';
  const base = rawCode.trim().toLowerCase().split(/[-_]/)[0] || 'en';
  return LANGUAGE_LABELS[base] ? base : base.slice(0, 5) || 'en';
}

export function getLanguageLabel(code: string): string {
  const norm = normalizeLanguageCode(code);
  return LANGUAGE_LABELS[norm] ?? norm.toUpperCase();
}

export function detectContentLanguage(params: {
  text: string;
  transcriptLanguage?: string | null;
  preferredLanguage?: string | null;
  isTranslated?: boolean;
}): LanguageDetectionResult {
  if (params.transcriptLanguage && params.transcriptLanguage.trim()) {
    const code = normalizeLanguageCode(params.transcriptLanguage);
    const label = getLanguageLabel(code);
    const translated = Boolean(params.isTranslated);
    return {
      code,
      label,
      source: 'transcript_model',
      translated,
      translationNote: translated
        ? `Captions translated from original audio metadata into ${label}; review wording to ensure speaker intent stays intact.`
        : null,
    };
  }

  const sample = params.text.trim();
  if (sample.length >= 8) {
    if (/[\u0900-\u097F]/.test(sample)) {
      return { code: 'hi', label: 'Hindi', source: 'heuristic_text', translated: false, translationNote: null };
    }
    if (/[\u3040-\u30FF]/.test(sample)) {
      return { code: 'ja', label: 'Japanese', source: 'heuristic_text', translated: false, translationNote: null };
    }
    if (/[\uAC00-\uD7AF]/.test(sample)) {
      return { code: 'ko', label: 'Korean', source: 'heuristic_text', translated: false, translationNote: null };
    }
    if (/[\u4E00-\u9FFF]/.test(sample)) {
      return { code: 'zh', label: 'Chinese', source: 'heuristic_text', translated: false, translationNote: null };
    }
    if (/[\u0600-\u06FF]/.test(sample)) {
      return { code: 'ar', label: 'Arabic', source: 'heuristic_text', translated: false, translationNote: null };
    }
    if (/[\u0400-\u04FF]/.test(sample)) {
      return { code: 'ru', label: 'Russian', source: 'heuristic_text', translated: false, translationNote: null };
    }

    const words = sample.toLowerCase().match(/[a-z\u00C0-\u024F]{2,}/g) ?? [];
    if (words.length > 0) {
      let bestLang = 'en';
      let bestHits = 0;
      for (const [lang, markers] of Object.entries(STOPWORD_MARKERS)) {
        const markerSet = new Set(markers);
        let hits = 0;
        for (const w of words) {
          if (markerSet.has(w)) hits += 1;
        }
        if (hits > bestHits) {
          bestHits = hits;
          bestLang = lang;
        }
      }
      if (bestHits >= 1) {
        return {
          code: bestLang,
          label: getLanguageLabel(bestLang),
          source: 'heuristic_text',
          translated: false,
          translationNote: null,
        };
      }
    }
  }

  const fallbackCode = normalizeLanguageCode(params.preferredLanguage || 'en');
  return {
    code: fallbackCode,
    label: getLanguageLabel(fallbackCode),
    source: 'fallback_default',
    translated: false,
    translationNote: null,
  };
}
