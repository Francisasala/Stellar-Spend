import { Language, TranslationKeys } from './types';
import { en, es, fr, zh, ar, pt, sw } from './translations';

const translations: Record<Language, TranslationKeys> = {
  en,
  es,
  fr,
  zh,
  ar,
  pt,
  sw,
};

const RTL_LANGUAGES: Language[] = ['ar'];

export class I18n {
  private currentLanguage: Language = 'en';

  constructor(language?: Language) {
    if (language && language in translations) {
      this.currentLanguage = language;
    }
  }

  setLanguage(language: Language): void {
    if (language in translations) {
      this.currentLanguage = language;
    }
  }

  getLanguage(): Language {
    return this.currentLanguage;
  }

  t(key: string): string {
    const keys = key.split('.');
    let value: unknown = translations[this.currentLanguage];

    for (const k of keys) {
      if (value && typeof value === 'object' && !Array.isArray(value) && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return key;
      }
    }

    return typeof value === 'string' ? value : key;
  }

  getTranslations(): TranslationKeys {
    return translations[this.currentLanguage];
  }

  getSupportedLanguages(): Language[] {
    return Object.keys(translations) as Language[];
  }

  isRTL(): boolean {
    return RTL_LANGUAGES.includes(this.currentLanguage);
  }
}

export const i18n = new I18n('en');
