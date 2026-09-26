/**
 * POST /functions/v1/delete-account  ->  200 { deleted: true }
 *
 * Deletes the caller's auth user. Every table references profiles/auth.users with
 * ON DELETE CASCADE, so profile, posts, comments, likes, matches… go with it.
 * Required by App Store Review Guideline 5.1.1(v) (in-app account deletion).
 */
import { adminClient, corsHeaders, getCaller, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const user = await getCaller(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const { error } = await adminClient().auth.admin.deleteUser(user.id);
  if (error) {
    console.error(JSON.stringify({ event: 'delete_account_failed', user: user.id, error: error.message }));
    return json({ error: 'delete_failed' }, 500);
  }
  return json({ deleted: true });
});
