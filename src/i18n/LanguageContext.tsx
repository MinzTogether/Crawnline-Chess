import React, { createContext, useContext, useMemo } from 'react';
import type { MoveClassification } from '../types/chess';
import {
  translate,
  type AppLanguage,
  type TranslationKey,
} from './translations';

interface LanguageContextValue {
  lang: AppLanguage;
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string;
  getClassificationLabel: (cls: MoveClassification) => string;
}

const CLASSIFICATION_KEYS: Record<MoveClassification, TranslationKey> = {
  book: 'clsBook',
  brilliant: 'clsBrilliant',
  great: 'clsGreat',
  best: 'clsBest',
  excellent: 'clsExcellent',
  good: 'clsGood',
  inaccuracy: 'clsInaccuracy',
  mistake: 'clsMistake',
  blunder: 'clsBlunder',
};

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  t: (key, vars) => translate('en', key, vars),
  getClassificationLabel: (cls) => translate('en', CLASSIFICATION_KEYS[cls]),
});

export const LanguageProvider: React.FC<{
  lang: AppLanguage;
  children: React.ReactNode;
}> = ({ lang, children }) => {
  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      t: (key, vars) => translate(lang, key, vars),
      getClassificationLabel: (cls) => translate(lang, CLASSIFICATION_KEYS[cls]),
    }),
    [lang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useI18n(): LanguageContextValue {
  return useContext(LanguageContext);
}
