/** Loads a student's CV (private "cvs" bucket) as base64 for a Claude document block. */
import type { SupabaseClient } from '@supabase/supabase-js';

const MAX_BYTES = 10 * 1024 * 1024;

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function loadCv(admin: SupabaseClient, userId: string): Promise<{ base64: string; fileName: string } | null> {
  const { data: file } = await admin.from('cv_files').select('path, file_name').eq('user_id', userId).maybeSingle();
  if (!file) return null;
  const { data: blob, error } = await admin.storage.from('cvs').download(file.path);
  if (error || !blob || blob.size === 0 || blob.size > MAX_BYTES) return null;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // Only PDFs are accepted by the bucket; check the magic number anyway.
  if (bytes.length < 5 || String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') return null;
  return { base64: toBase64(bytes), fileName: file.file_name };
}
