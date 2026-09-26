/**
 * Career tools: the student's CV (private storage), AI CV reviews and AI
 * opportunity matching (see supabase/functions/cv-review and /opportunities),
 * and saved opportunities.
 */
import { readFileBytes } from '@/lib/read-file';

import { createDemoCvReview, createDemoOpportunities } from '../demo/career';
import type {
  CvFile,
  CvReview,
  CvReviewRequest,
  Opportunity,
  OpportunityRequest,
  OpportunitySearch,
  SavedOpportunity,
} from '../types';

import {
  currentUserId,
  isDemoMode,
  NoCvError,
  notifyChange,
  requireClient,
  requireUserId,
  STALE_JOB_MS,
  throwFunctionError,
} from './core';
import { demo } from './demo-store';
import { demoSpend } from './wallet';

// ---------------------------------------------------------------------------
// CV file

export const MAX_CV_BYTES = 10 * 1024 * 1024;

export async function getCv(): Promise<CvFile | null> {
  if (isDemoMode) return demo.cv;
  const userId = await currentUserId();
  if (!userId) return null;
  const { data, error } = await requireClient()
    .from('cv_files')
    .select('file_name, size_bytes, uploaded_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { file_name: string; size_bytes: number; uploaded_at: string };
  return { fileName: row.file_name, sizeBytes: row.size_bytes, uploadedAt: row.uploaded_at };
}

/** Uploads (or replaces) the student's CV. `uri` is a local file picked with the document picker. */
export async function uploadCv(file: { uri: string; name: string; size: number }) {
  if (file.size > MAX_CV_BYTES) throw new Error('too_large');
  if (isDemoMode) {
    demo.cv = { fileName: file.name, sizeBytes: file.size, uploadedAt: new Date().toISOString() };
    notifyChange();
    return;
  }
  const userId = await requireUserId();
  const path = `${userId}/cv.pdf`;
  const body = await readFileBytes(file.uri);
  const client = requireClient();
  const upload = await client.storage.from('cvs').upload(path, body, { contentType: 'application/pdf', upsert: true });
  if (upload.error) throw upload.error;
  const { error } = await client
    .from('cv_files')
    .upsert({ user_id: userId, path, file_name: file.name.slice(0, 200), size_bytes: file.size, uploaded_at: new Date().toISOString() });
  if (error) throw error;
  notifyChange();
}

export async function deleteCv() {
  if (isDemoMode) {
    demo.cv = null;
    notifyChange();
    return;
  }
  const userId = await requireUserId();
  const client = requireClient();
  const removed = await client.storage.from('cvs').remove([`${userId}/cv.pdf`]);
  if (removed.error) throw removed.error;
  const { error } = await client.from('cv_files').delete().eq('user_id', userId);
  if (error) throw error;
  notifyChange();
}

// ---------------------------------------------------------------------------
// AI jobs (CV reviews and opportunity searches share the same row shape)

type JobRow<Req, Rep> = {
  id: string;
  status: CvReview['status'];
  request: Req;
  report: Rep | null;
  error: string | null;
  created_at: string;
};

function mapJob<Req, Rep>(row: JobRow<Req, Rep>) {
  const pending = row.status === 'pending' || row.status === 'running';
  const stale = pending && Date.now() - new Date(row.created_at).getTime() > STALE_JOB_MS;
  return {
    id: row.id,
    status: stale ? ('error' as const) : row.status,
    request: row.request,
    report: row.report,
    error: stale ? 'timeout' : row.error,
    createdAt: row.created_at,
  };
}

const JOB_COLUMNS = 'id, status, request, report, error, created_at';

/** Demo mode: show the progress UI for a few seconds, then the sample result. */
function simulate<T extends { id: string; status: CvReview['status'] }>(list: T[], job: T, delayMs: number) {
  list.unshift({ ...job, status: 'running' });
  setTimeout(() => {
    const index = list.findIndex((item) => item.id === job.id);
    if (index >= 0) list[index] = job;
    notifyChange();
  }, delayMs);
  notifyChange();
}

export async function requestCvReview(request: CvReviewRequest): Promise<string> {
  if (isDemoMode) {
    if (!demo.cv) throw new NoCvError('no cv');
    demoSpend('cv_review');
    const id = `demo-cv-${Date.now()}`;
    simulate(demo.cvReviews, createDemoCvReview(request, id), 5000);
    return id;
  }
  await requireUserId();
  const { data, error } = await requireClient().functions.invoke<{ id: string }>('cv-review', { body: { request } });
  if (error) await throwFunctionError(error);
  if (!data?.id) throw new Error('Missing review id');
  notifyChange();
  return data.id;
}

export async function getCvReview(id: string): Promise<CvReview | null> {
  if (isDemoMode) return demo.cvReviews.find((r) => r.id === id) ?? null;
  const { data, error } = await requireClient().from('cv_reviews').select(JOB_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapJob(data as JobRow<CvReview['request'], CvReview['report']>) : null;
}

export async function listCvReviews(): Promise<CvReview[]> {
  if (isDemoMode) return [...demo.cvReviews];
  if (!(await currentUserId())) return [];
  const { data, error } = await requireClient()
    .from('cv_reviews')
    .select(JOB_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data as JobRow<CvReview['request'], CvReview['report']>[]).map(mapJob);
}

export async function requestOpportunities(request: OpportunityRequest): Promise<string> {
  if (isDemoMode) {
    if (request.useCv && !demo.cv) throw new NoCvError('no cv');
    demoSpend('opportunity_match');
    const id = `demo-opp-${Date.now()}`;
    simulate(demo.opportunitySearches, createDemoOpportunities(request, id), 6000);
    return id;
  }
  await requireUserId();
  const { data, error } = await requireClient().functions.invoke<{ id: string }>('opportunities', { body: { request } });
  if (error) await throwFunctionError(error);
  if (!data?.id) throw new Error('Missing search id');
  notifyChange();
  return data.id;
}

export async function getOpportunitySearch(id: string): Promise<OpportunitySearch | null> {
  if (isDemoMode) return demo.opportunitySearches.find((s) => s.id === id) ?? null;
  const { data, error } = await requireClient().from('opportunity_searches').select(JOB_COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapJob(data as JobRow<OpportunitySearch['request'], OpportunitySearch['report']>) : null;
}

export async function listOpportunitySearches(): Promise<OpportunitySearch[]> {
  if (isDemoMode) return [...demo.opportunitySearches];
  if (!(await currentUserId())) return [];
  const { data, error } = await requireClient()
    .from('opportunity_searches')
    .select(JOB_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return (data as JobRow<OpportunitySearch['request'], OpportunitySearch['report']>[]).map(mapJob);
}

// ---------------------------------------------------------------------------
// Saved opportunities

export async function listSavedOpportunities(): Promise<SavedOpportunity[]> {
  if (isDemoMode) return [...demo.savedOpportunities];
  if (!(await currentUserId())) return [];
  const { data, error } = await requireClient()
    .from('saved_opportunities')
    .select('url, opportunity, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as { url: string; opportunity: Opportunity; created_at: string }[]).map((row) => ({
    url: row.url,
    opportunity: row.opportunity,
    createdAt: row.created_at,
  }));
}

export async function setOpportunitySaved(opportunity: Opportunity, saved: boolean) {
  if (isDemoMode) {
    demo.savedOpportunities = demo.savedOpportunities.filter((s) => s.url !== opportunity.url);
    if (saved) demo.savedOpportunities.unshift({ url: opportunity.url, opportunity, createdAt: new Date().toISOString() });
  } else {
    const userId = await requireUserId();
    const table = requireClient().from('saved_opportunities');
    const { error } = saved
      ? await table.upsert({ user_id: userId, url: opportunity.url, opportunity }, { ignoreDuplicates: true })
      : await table.delete().eq('user_id', userId).eq('url', opportunity.url);
    if (error) throw error;
  }
  notifyChange();
}
