import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { fetchProfile, notifyChange, saveProfile, setDemoIdentity, universities } from '@/data/api';
import type { Profile } from '@/data/types';
import { isDemoMode, supabase } from '@/lib/supabase';

const PROFILE_KEY = 'universe.profile.v1';
const DEMO_EMAIL_KEY = 'universe.demo-email.v1';

const emptyProfile: Profile = {
  id: 'me',
  displayName: '',
  homeUniversity: '',
  field: null,
  level: null,
  destinationId: null,
  term: null,
  verified: false,
};

type SessionState = {
  ready: boolean;
  /** Signed in with an account (always false for guests). */
  signedIn: boolean;
  email: string | null;
  profile: Profile;
  /** The user has completed onboarding at least once on this device. */
  onboarded: boolean;
  updateProfile: (changes: Partial<Profile>) => Promise<void>;
  sendCode: (email: string) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

function isUniversityEmail(email: string) {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  return universities.some((u) => u.emailDomains.some((d) => domain === d || domain.endsWith(`.${d}`)));
}

async function readLocalProfile(): Promise<Profile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? { ...emptyProfile, ...(JSON.parse(raw) as Partial<Profile>) } : null;
  } catch {
    return null;
  }
}

async function writeLocalProfile(profile: Profile) {
  try {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Non-fatal: the profile is kept in memory for this session.
  }
}

/** Fills empty server fields with what the user entered before signing in. */
function mergeProfiles(server: Profile, local: Profile | null): Profile {
  if (!local) return server;
  return {
    ...server,
    displayName: server.displayName || local.displayName,
    homeUniversity: server.homeUniversity || local.homeUniversity,
    field: server.field ?? local.field,
    level: server.level ?? local.level,
    destinationId: server.destinationId ?? local.destinationId,
    term: server.term ?? local.term,
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [demoEmail, setDemoEmail] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [onboarded, setOnboarded] = useState(false);

  // Initial load: local profile, then the Supabase session if there is one.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await readLocalProfile();
      if (cancelled) return;
      if (local) {
        setProfile(local);
        setOnboarded(true);
      }
      if (isDemoMode) {
        const email = await AsyncStorage.getItem(DEMO_EMAIL_KEY).catch(() => null);
        if (!cancelled) setDemoEmail(email);
      } else if (supabase) {
        const { data } = await supabase.auth.getSession();
        if (!cancelled) setSession(data.session);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      notifyChange();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // When signed in, the server profile is the source of truth.
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [server, local] = await Promise.all([fetchProfile(userId), readLocalProfile()]);
      if (cancelled || !server) return;
      const merged = mergeProfiles(server, local);
      setProfile(merged);
      await writeLocalProfile(merged);
      if (JSON.stringify(merged) !== JSON.stringify(server)) {
        await saveProfile(merged);
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (isDemoMode) setDemoIdentity(profile);
  }, [profile]);

  const updateProfile = useCallback(
    async (changes: Partial<Profile>) => {
      const next = { ...profile, ...changes };
      setProfile(next);
      setOnboarded(true);
      await writeLocalProfile(next);
      if (userId) await saveProfile({ ...next, id: userId });
      notifyChange();
    },
    [profile, userId],
  );

  const sendCode = useCallback(async (email: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) throw error;
  }, []);

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      if (!supabase) {
        await AsyncStorage.setItem(DEMO_EMAIL_KEY, email).catch(() => undefined);
        setDemoEmail(email);
        await updateProfile({
          verified: isUniversityEmail(email),
          displayName: profile.displayName || email.split('@')[0],
        });
        return;
      }
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) throw error;
    },
    [profile.displayName, updateProfile],
  );

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut();
    } else {
      await AsyncStorage.removeItem(DEMO_EMAIL_KEY).catch(() => undefined);
      setDemoEmail(null);
    }
    const guest = { ...profile, id: 'me', verified: false };
    setProfile(guest);
    await writeLocalProfile(guest);
    notifyChange();
  }, [profile]);

  const value = useMemo<SessionState>(
    () => ({
      ready,
      signedIn: isDemoMode ? demoEmail !== null : session !== null,
      email: isDemoMode ? demoEmail : (session?.user.email ?? null),
      profile,
      onboarded,
      updateProfile,
      sendCode,
      verifyCode,
      signInWithPassword,
      signOut,
    }),
    [ready, demoEmail, session, profile, onboarded, updateProfile, sendCode, verifyCode, signInWithPassword, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}
