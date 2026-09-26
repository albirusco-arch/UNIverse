import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { fetchProfile, notifyChange, saveProfile, setDemoIdentity } from '@/data/api';
import type { Profile } from '@/data/types';
import { universityForEmail } from '@/lib/student-email';
import { isDemoMode, supabase } from '@/lib/supabase';
import { upcomingTerms } from '@/lib/terms';

const PROFILE_KEY = 'universe.profile.v2';
const DEMO_EMAIL_KEY = 'universe.demo-email.v2';
const GUEST_KEY = 'universe.guest';

/** Account used by "Try the demo" (demo mode only). */
export const DEMO_ACCOUNT_EMAIL = 'demo.student@studenti.unimi.it';

const emptyProfile: Profile = {
  id: 'me',
  displayName: '',
  homeUniversity: '',
  homeUniversityId: null,
  field: null,
  level: null,
  destinationId: null,
  term: null,
  verified: false,
};

type SessionState = {
  ready: boolean;
  /** Signed in with a university email. */
  signedIn: boolean;
  /** Browsing without an account (catalogue and general university info only). */
  guest: boolean;
  email: string | null;
  profile: Profile;
  /** Name, home university, field and level are filled in. */
  profileComplete: boolean;
  updateProfile: (changes: Partial<Profile>) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  /** Sends a 6-digit code. With `createUser: false` (log in) unknown emails are rejected. */
  sendCode: (email: string, options: { createUser: boolean }) => Promise<void>;
  verifyCode: (email: string, code: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /** Demo mode: signs in as a sample student with a complete profile. */
  startDemo: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionState | null>(null);

async function readLocalProfile(): Promise<Profile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_KEY);
    return raw ? { ...emptyProfile, ...(JSON.parse(raw) as Partial<Profile>) } : null;
  } catch {
    return null;
  }
}

async function writeLocalProfile(profile: Profile | null) {
  try {
    if (profile) await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    else await AsyncStorage.removeItem(PROFILE_KEY);
  } catch {
    // Non-fatal: the profile is kept in memory for this session.
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [demoEmail, setDemoEmail] = useState<string | null>(null);
  const [guestFlag, setGuestFlag] = useState(false);
  const [profile, setProfile] = useState<Profile>(emptyProfile);

  // Initial load: cached profile, then the session.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = await readLocalProfile();
      const guest = await AsyncStorage.getItem(GUEST_KEY).catch(() => null);
      if (cancelled) return;
      if (local) setProfile(local);
      setGuestFlag(guest === '1');
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

  // When signed in, the server profile (created at sign-up, linked to the
  // university of the email) is the source of truth.
  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    fetchProfile(userId)
      .then(async (server) => {
        if (cancelled || !server) return;
        setProfile(server);
        await writeLocalProfile(server);
      })
      .catch(() => undefined);
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
      await writeLocalProfile(next);
      if (userId) await saveProfile({ ...next, id: userId });
      notifyChange();
    },
    [profile, userId],
  );

  const continueAsGuest = useCallback(async () => {
    await AsyncStorage.setItem(GUEST_KEY, '1').catch(() => undefined);
    setGuestFlag(true);
  }, []);

  const sendCode = useCallback(async (email: string, { createUser }: { createUser: boolean }) => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: createUser } });
    if (error) throw error;
  }, []);

  /** Demo mode: mimic the database trigger that links the account to its university. */
  const signInDemo = useCallback(async (email: string, extra: Partial<Profile> = {}) => {
    const university = universityForEmail(email);
    const next: Profile = {
      ...emptyProfile,
      displayName: email.split('@')[0].replace(/[._]/g, ' '),
      homeUniversity: university?.name ?? '',
      homeUniversityId: university?.id ?? null,
      verified: true,
      ...extra,
    };
    await AsyncStorage.setItem(DEMO_EMAIL_KEY, email).catch(() => undefined);
    await writeLocalProfile(next);
    setProfile(next);
    setDemoEmail(email);
    notifyChange();
  }, []);

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      if (!supabase) return signInDemo(email);
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
      if (error) throw error;
    },
    [signInDemo],
  );

  const startDemo = useCallback(
    () =>
      signInDemo(DEMO_ACCOUNT_EMAIL, {
        displayName: 'Alex Demo',
        field: 'biochemistry',
        level: 'bachelor',
        destinationId: 'heidelberg',
        term: upcomingTerms()[0],
      }),
    [signInDemo],
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
    setProfile(emptyProfile);
    await writeLocalProfile(null);
    await AsyncStorage.removeItem(GUEST_KEY).catch(() => undefined);
    setGuestFlag(false);
    notifyChange();
  }, []);

  const signedIn = isDemoMode ? demoEmail !== null : session !== null;
  const value = useMemo<SessionState>(
    () => ({
      ready,
      signedIn,
      guest: guestFlag && !signedIn,
      email: isDemoMode ? demoEmail : (session?.user.email ?? null),
      profile,
      profileComplete: Boolean(profile.displayName && profile.homeUniversity && profile.field && profile.level),
      updateProfile,
      continueAsGuest,
      sendCode,
      verifyCode,
      signInWithPassword,
      startDemo,
      signOut,
    }),
    [
      ready,
      signedIn,
      guestFlag,
      demoEmail,
      session,
      profile,
      updateProfile,
      continueAsGuest,
      sendCode,
      verifyCode,
      signInWithPassword,
      startDemo,
      signOut,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession must be used inside SessionProvider');
  return context;
}
