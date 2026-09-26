import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import {
  getLanguage,
  LANGUAGES,
  resolveLanguage,
  setActiveLanguage,
  type Language,
  type LanguagePreference,
} from '@/i18n';

const PREFERENCE_KEY = 'universe.language';

type LanguageContextValue = {
  language: Language;
  preference: LanguagePreference;
  setPreference: (preference: LanguagePreference) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function deviceLanguage(): string | null {
  try {
    return getLocales()[0]?.languageCode ?? null;
  } catch {
    return null;
  }
}

function isPreference(value: unknown): value is LanguagePreference {
  return value === 'system' || (LANGUAGES as readonly unknown[]).includes(value);
}

/**
 * Picks the UI language (the choice saved in Settings, else the device's) before
 * anything renders. Screens read strings through `t()`, so the root navigator is
 * keyed by `language` and remounts when it changes.
 */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [preference, setPreferenceState] = useState<LanguagePreference>('system');
  const [language, setLanguage] = useState<Language>(getLanguage);

  useEffect(() => {
    AsyncStorage.getItem(PREFERENCE_KEY)
      .catch(() => null)
      .then((stored) => {
        const saved = isPreference(stored) ? stored : 'system';
        const resolved = resolveLanguage(saved, deviceLanguage());
        setActiveLanguage(resolved);
        setPreferenceState(saved);
        setLanguage(resolved);
        setReady(true);
      });
  }, []);

  const setPreference = (next: LanguagePreference) => {
    const resolved = resolveLanguage(next, deviceLanguage());
    setActiveLanguage(resolved);
    setPreferenceState(next);
    setLanguage(resolved);
    AsyncStorage.setItem(PREFERENCE_KEY, next).catch(() => {});
  };

  if (!ready) return null;

  return (
    <LanguageContext.Provider value={{ language, preference, setPreference }}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error('useLanguage must be used inside LanguageProvider');
  return value;
}
