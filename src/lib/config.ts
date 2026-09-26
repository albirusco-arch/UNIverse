import Constants from 'expo-constants';

/** Support address shown in Settings and used for university suggestions. Set EXPO_PUBLIC_SUPPORT_EMAIL before release. */
export const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? 'support@example.com';

/**
 * App Store reviewers cannot receive our email codes, so this one account signs
 * in with a password instead (create it in Supabase Auth and share it in App Store Connect).
 */
export const REVIEW_EMAIL = process.env.EXPO_PUBLIC_REVIEW_EMAIL?.trim().toLowerCase() || null;

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
