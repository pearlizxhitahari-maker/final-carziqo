import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { LanguageCode } from '@/lib/types';
import { translations, TranslationKey } from '@/lib/i18n/translations';

interface LanguageContextValue {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: TranslationKey) => string;
  dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export function LanguageProvider({ children, initialLanguage }: { children: ReactNode; initialLanguage: LanguageCode }) {
  const [language, setLanguageState] = useState<LanguageCode>(initialLanguage);

  useEffect(() => {
    setLanguageState(initialLanguage);
  }, [initialLanguage]);

  const dir: 'ltr' | 'rtl' = language === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = dir;
  }, [language, dir]);

  const t = (key: TranslationKey): string => {
    const dict = translations[language] || translations.en;
    return dict[key] || translations.en[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: setLanguageState, t, dir }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
