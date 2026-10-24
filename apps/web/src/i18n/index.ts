import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { th } from './th';
import { en } from './en';

export const languages = ['th', 'en'] as const;
export type Language = typeof languages[number];
const storageKey = 'scamreport-language';
const stored = typeof localStorage === 'undefined' ? null : localStorage.getItem(storageKey);

// Thai by default; the choice persists per device. Missing keys fall back to Thai, never to raw keys.
void i18n.use(initReactI18next).init({
  lng: stored === 'en' ? 'en' : 'th',
  fallbackLng: 'th',
  interpolation: { escapeValue: false },
  returnNull: false,
  resources: { th: { translation: th }, en: { translation: en } },
});
i18n.on('languageChanged', language => {
  document.documentElement.lang = language;
  localStorage.setItem(storageKey, language);
});
document.documentElement.lang = i18n.language;

export default i18n;
