/**
 * Minimal declarations for the Supabase Edge Runtime globals, so the functions
 * can be type-checked with `tsc` (npm run check:functions) outside Deno.
 */
declare namespace Deno {
  const env: { get(name: string): string | undefined };
  function serve(handler: (request: Request) => Response | Promise<Response>): unknown;
}

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};
