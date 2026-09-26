/**
 * AI research (see supabase/functions/research): exchange course matching,
 * entry requirements, scholarships and visas.
 */
import { createDemoResearch } from '../demo/research';
import type { Research, ResearchRequest } from '../types';

import {
  currentUserId,
  functionErrorStatus,
  isDemoGuest,
  isDemoMode,
  notifyChange,
  RateLimitError,
  requireClient,
  requireDemoStudent,
  requireUserId,
  STALE_JOB_MS,
} from './core';
import { demo } from './demo-store';

type ResearchRow = {
  id: string;
  kind: Research['kind'];
  status: Research['status'];
  request: ResearchRequest;
  report: Research['report'];
  error: string | null;
  created_at: string;
};

function mapResearch(row: ResearchRow): Research {
  const pending = row.status === 'pending' || row.status === 'running';
  const stale = pending && Date.now() - new Date(row.created_at).getTime() > STALE_JOB_MS;
  return {
    id: row.id,
    kind: row.kind,
    status: stale ? 'error' : row.status,
    request: row.request,
    report: row.report,
    error: stale ? 'timeout' : row.error,
    createdAt: row.created_at,
  };
}

const COLUMNS = 'id,kind,status,request,report,error,created_at';

export async function requestResearch(request: ResearchRequest): Promise<string> {
  requireDemoStudent();
  if (isDemoMode) {
    const id = `demo-${Date.now()}`;
    demo.research.unshift({ ...createDemoResearch(request, id), status: 'running', report: null });
    // Simulate the research delay so the progress UI can be seen.
    setTimeout(() => {
      demo.research = demo.research.map((r) => (r.id === id ? createDemoResearch(request, id) : r));
      notifyChange();
    }, 6000);
    notifyChange();
    return id;
  }
  await requireUserId();
  const { data, error } = await requireClient().functions.invoke<{ id: string }>('research', { body: { request } });
  if (error) {
    if (functionErrorStatus(error) === 429) throw new RateLimitError('rate limited');
    throw error;
  }
  if (!data?.id) throw new Error('Missing research id');
  notifyChange();
  return data.id;
}

export async function getResearch(id: string): Promise<Research | null> {
  if (isDemoGuest()) return null;
  if (isDemoMode) return demo.research.find((r) => r.id === id) ?? null;
  const { data, error } = await requireClient().from('research_requests').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? mapResearch(data as ResearchRow) : null;
}

export async function listMyResearch(): Promise<Research[]> {
  if (isDemoGuest()) return [];
  if (isDemoMode) return [...demo.research];
  if (!(await currentUserId())) return [];
  const { data, error } = await requireClient()
    .from('research_requests')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return (data as ResearchRow[]).map(mapResearch);
}
