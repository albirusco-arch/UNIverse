/**
 * POST /functions/v1/delete-account  ->  200 { deleted: true }
 *
 * Deletes the caller's CV files and auth user. Every table references
 * profiles/auth.users with ON DELETE CASCADE, so profile, posts, comments,
 * messages, research, tokens… go with it; storage files are removed first.
 * Required by App Store Review Guideline 5.1.1(v) (in-app account deletion).
 */
import { adminClient, corsHeaders, getCaller, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const user = await getCaller(req);
  if (!user) return json({ error: 'unauthorized' }, 401);

  const admin = adminClient();
  const { data: files } = await admin.storage.from('cvs').list(user.id);
  if (files?.length) {
    const { error: storageError } = await admin.storage.from('cvs').remove(files.map((f) => `${user.id}/${f.name}`));
    if (storageError) {
      console.error(JSON.stringify({ event: 'delete_cv_failed', user: user.id, error: storageError.message }));
      return json({ error: 'delete_failed' }, 500);
    }
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error(JSON.stringify({ event: 'delete_account_failed', user: user.id, error: error.message }));
    return json({ error: 'delete_failed' }, 500);
  }
  return json({ deleted: true });
});
