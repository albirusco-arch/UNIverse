/** Web has no store: token packs are bought in the iOS and Android apps. */
export const purchasesEnabled = false;

export class PurchaseCancelledError extends Error {}

export async function identifyPurchaser(_userId: string) {}

export async function forgetPurchaser() {}

export async function storePrices(_productIds: string[]): Promise<Record<string, string>> {
  return {};
}

export async function buyProduct(_productId: string): Promise<void> {
  throw new Error('Purchases are only available in the mobile app');
}
