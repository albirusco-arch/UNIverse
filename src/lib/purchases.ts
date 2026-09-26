/**
 * In-app purchases for token packs, through RevenueCat (App Store / Google Play).
 * Apple requires in-app purchase for digital credits; RevenueCat validates the
 * receipts and notifies the revenuecat-webhook edge function, which credits the
 * tokens. Needs a development or store build: in Expo Go the SDK runs in its
 * preview mode and no real purchase happens.
 */
import { Platform } from 'react-native';
import Purchases, { PURCHASES_ERROR_CODE, type PurchasesError } from 'react-native-purchases';

const API_KEY =
  Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY
    : Platform.OS === 'android'
      ? process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY
      : undefined;

/** Store purchases are configured for this build. */
export const purchasesEnabled = Boolean(API_KEY);

export class PurchaseCancelledError extends Error {}

let configuredUser: string | null = null;

/** Identifies the student to RevenueCat with their Supabase user id (used by the webhook). */
export async function identifyPurchaser(userId: string) {
  if (!API_KEY || configuredUser === userId) return;
  if (configuredUser === null) {
    Purchases.configure({ apiKey: API_KEY, appUserID: userId });
  } else {
    await Purchases.logIn(userId);
  }
  configuredUser = userId;
}

export async function forgetPurchaser() {
  if (!API_KEY || configuredUser === null) return;
  await Purchases.logOut().catch(() => undefined);
  configuredUser = null;
}

/** Localised prices for the given store product ids. */
export async function storePrices(productIds: string[]): Promise<Record<string, string>> {
  if (!API_KEY || configuredUser === null) return {};
  const products = await Purchases.getProducts(productIds, Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION);
  return Object.fromEntries(products.map((product) => [product.identifier, product.priceString]));
}

/** Shows the store's payment sheet (Apple Pay, card or balance on the Apple ID / Google account). */
export async function buyProduct(productId: string): Promise<void> {
  if (!API_KEY || configuredUser === null) throw new Error('Purchases are not configured');
  const [product] = await Purchases.getProducts([productId], Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION);
  if (!product) throw new Error(`Unknown product ${productId}`);
  try {
    await Purchases.purchaseStoreProduct(product);
  } catch (error) {
    if ((error as PurchasesError).code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      throw new PurchaseCancelledError('cancelled');
    }
    throw error;
  }
}
