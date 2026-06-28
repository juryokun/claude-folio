import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en';
import ja from './ja';

export type Language = 'ja' | 'en';

i18n.use(initReactI18next).init({
  resources: {
    ja: { translation: ja },
    en: { translation: en },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export function setLanguage(lang: Language) {
  i18n.changeLanguage(lang);
}

export default i18n;
