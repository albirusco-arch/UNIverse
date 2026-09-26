/**
 * Signed-out calls are refused before any work (and before any AI cost): each
 * function's handler runs with a stubbed Deno runtime and no reachable
 * Supabase, so a token can never be validated. Run with: npm test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

type Handler = (req: Request) => Promise<Response>;

const served: Handler[] = [];
Reflect.set(globalThis, 'Deno', {
  env: {
    get: (name: string) =>
      ({
        SUPABASE_URL: 'http://127.0.0.1:9',
        SUPABASE_ANON_KEY: 'anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        ANTHROPIC_API_KEY: 'test-key',
      })[name],
  },
  serve: (handler: Handler) => served.push(handler),
});

const handlers: Record<string, Handler> = {};
for (const name of ['research', 'university-insights', 'delete-account']) {
  await import(`../${name}/index.ts`);
  handlers[name] = served[served.length - 1];
}

const call = (handler: Handler, authorization?: string) =>
  handler(
    new Request('http://localhost/functions/v1/fn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
      body: JSON.stringify({ request: { kind: 'visa' }, universityId: 'heidelberg' }),
    }),
  );

for (const [name, handler] of Object.entries(handlers)) {
  test(`${name} rejects signed-out calls`, async () => {
    for (const authorization of [undefined, 'anon-key', 'Bearer anon-key']) {
      const response = await call(handler, authorization);
      assert.equal(response.status, 401, `${name} with ${authorization ?? 'no'} Authorization header`);
      assert.deepEqual(await response.json(), { error: 'unauthorized' });
    }
  });
}
