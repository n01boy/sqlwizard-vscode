import * as i18next from 'i18next';
import { StorageService } from './StorageService';

export class I18nService {
  private static instance: I18nService;
  private i18n: i18next.i18n;

  private constructor() {
    this.i18n = i18next.createInstance();
    this.initialize();
  }

  static getInstance(): I18nService {
    if (!I18nService.instance) {
      I18nService.instance = new I18nService();
    }
    return I18nService.instance;
  }

  private async initialize(): Promise<void> {
    const enTranslations = await import('../i18n/en.json');
    const jaTranslations = await import('../i18n/ja.json');

    await this.i18n.init({
      lng: StorageService.getInstance().getLanguage(),
      fallbackLng: 'en',
      resources: {
        en: {
          translation: enTranslations,
        },
        ja: {
          translation: jaTranslations,
        },
      },
      interpolation: {
        escapeValue: false,
      },
    });
  }

  async changeLanguage(language: 'en' | 'ja'): Promise<void> {
    await this.i18n.changeLanguage(language);
    await StorageService.getInstance().setLanguage(language);
  }

  t(key: string, options?: any): string {
    return this.i18n.t(key, options) as string;
  }

  getCurrentLanguage(): string {
    return this.i18n.language;
  }
}
