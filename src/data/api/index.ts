/**
 * Data access for the whole app. Every function works against Supabase when it
 * is configured, and against in-memory sample data otherwise (demo mode).
 */
export {
  countryList,
  countryName,
  getUniversity,
  normalize,
  searchUniversities,
  universities,
  type Country,
  type Scope,
} from '../catalogue';
export {
  AuthRequiredError,
  InsufficientTokensError,
  isDemoMode,
  NoCvError,
  notifyChange,
  RateLimitError,
  setDemoIdentity,
  subscribe,
} from './core';
export * from './career';
export * from './community';
export * from './feed';
export * from './groups';
export * from './profile';
export * from './research';
export * from './signals';
export * from './universities';
export { buyTokens, getWallet, listFeaturePrices, listTokenProducts } from './wallet';
