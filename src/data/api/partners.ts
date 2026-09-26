/**
 * Partner-first search: the exchange agreements of a home university, its
 * departments and course catalogues, student suggestions, and reading the
 * official partner list with AI (supabase/functions/partner-lists).
 */
import { createDemoPartnerships } from '../demo/partners';
import type { AgreementType, Course, Department, PartnerExtraction, Partnership } from '../types';

import {
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
import { demoPartners } from './demo-store';

/** The agreement is already listed. */
export class DuplicateError extends Error {}

/** Only students of a university can have its list read (it costs an AI run). */
export class NotYourUniversityError extends Error {}

type PartnershipRow = {
  id: string;
  home_university_id: string;
  partner_university_id: string;
  agreement_type: AgreementType;
  home_department_id: string | null;
  home_department_name: string | null;
  isced_codes: string[];
  levels: Partnership['levels'];
  languages: string[];
  language_level: string;
  places: number | null;
  academic_year: string;
  source: Partnership['source'];
  source_url: string;
  verified: boolean;
  last_verified: string | null;
};

function mapPartnership(row: PartnershipRow): Partnership {
  return {
    id: row.id,
    homeUniversityId: row.home_university_id,
    partnerUniversityId: row.partner_university_id,
    agreementType: row.agreement_type,
    homeDepartment:
      row.home_department_id && row.home_department_name ? { id: row.home_department_id, name: row.home_department_name } : null,
    iscedCodes: row.isced_codes,
    levels: row.levels,
    languages: row.languages,
    languageLevel: row.language_level,
    places: row.places,
    academicYear: row.academic_year,
    source: row.source,
    sourceUrl: row.source_url,
    verified: row.verified,
    lastVerified: row.last_verified,
  };
}

export async function listPartnerships(homeUniversityId: string): Promise<Partnership[]> {
  if (isDemoMode) {
    const list = demoPartners(homeUniversityId).partnerships;
    return isDemoGuest() ? list.filter((p) => p.source !== 'student') : [...list];
  }
  const { data, error } = await requireClient()
    .from('partner_list')
    .select(
      'id,home_university_id,partner_university_id,agreement_type,home_department_id,home_department_name,isced_codes,levels,languages,language_level,places,academic_year,source,source_url,verified,last_verified',
    )
    .eq('home_university_id', homeUniversityId)
    .limit(2000);
  if (error) throw error;
  return (data as PartnershipRow[]).map(mapPartnership);
}

export async function listDepartments(universityId: string): Promise<Department[]> {
  if (isDemoMode) return [...demoPartners(universityId).departments];
  const { data, error } = await requireClient()
    .from('departments')
    .select('id,university_id,name,kind,isced_codes,website,source_url,verified')
    .eq('university_id', universityId)
    .order('name');
  if (error) throw error;
  return (
    data as {
      id: string;
      university_id: string;
      name: string;
      kind: Department['kind'];
      isced_codes: string[];
      website: string;
      source_url: string;
      verified: boolean;
    }[]
  ).map((row) => ({
    id: row.id,
    universityId: row.university_id,
    name: row.name,
    kind: row.kind,
    iscedCodes: row.isced_codes,
    website: row.website,
    sourceUrl: row.source_url,
    verified: row.verified,
  }));
}

export async function listCourses(universityId: string, departmentId?: string): Promise<Course[]> {
  if (isDemoMode) return [];
  let query = requireClient()
    .from('courses')
    .select('id,university_id,department_id,code,title,ects,level,language,term,isced_code,url,source_url,verified')
    .eq('university_id', universityId);
  if (departmentId) query = query.eq('department_id', departmentId);
  const { data, error } = await query.order('title').limit(500);
  if (error) throw error;
  return (
    data as {
      id: string;
      university_id: string;
      department_id: string | null;
      code: string;
      title: string;
      ects: number | null;
      level: Course['level'];
      language: string | null;
      term: Course['term'];
      isced_code: string | null;
      url: string;
      source_url: string;
      verified: boolean;
    }[]
  ).map((row) => ({
    id: row.id,
    universityId: row.university_id,
    departmentId: row.department_id,
    code: row.code,
    title: row.title,
    ects: row.ects === null ? null : Number(row.ects),
    level: row.level,
    language: row.language,
    term: row.term,
    iscedCode: row.isced_code,
    url: row.url,
    sourceUrl: row.source_url,
    verified: row.verified,
  }));
}

export async function suggestPartnership(input: {
  homeUniversityId: string;
  partnerUniversityId: string;
  agreementType: AgreementType;
  sourceUrl: string;
  academicYear: string;
}) {
  requireDemoStudent();
  if (isDemoMode) {
    const state = demoPartners(input.homeUniversityId);
    const exists = state.partnerships.some(
      (p) =>
        p.partnerUniversityId === input.partnerUniversityId && p.agreementType === input.agreementType && !p.homeDepartment,
    );
    if (exists) throw new DuplicateError();
    state.partnerships.push({
      id: `local-partner-${Date.now()}`,
      homeUniversityId: input.homeUniversityId,
      partnerUniversityId: input.partnerUniversityId,
      agreementType: input.agreementType,
      homeDepartment: null,
      iscedCodes: [],
      levels: [],
      languages: [],
      languageLevel: '',
      places: null,
      academicYear: input.academicYear,
      source: 'student',
      sourceUrl: input.sourceUrl,
      verified: false,
      lastVerified: null,
    });
  } else {
    const userId = await requireUserId();
    const { error } = await requireClient().from('partnerships').insert({
      home_university_id: input.homeUniversityId,
      partner_university_id: input.partnerUniversityId,
      agreement_type: input.agreementType,
      academic_year: input.academicYear,
      source: 'student',
      source_url: input.sourceUrl,
      created_by: userId,
    });
    if (error?.code === '23505') throw new DuplicateError();
    if (error) throw error;
  }
  notifyChange();
}

type ExtractionRow = {
  status: PartnerExtraction['status'];
  found: number;
  matched: number;
  unmatched: string[];
  error: string | null;
  checked_at: string | null;
  updated_at: string;
};

export async function getPartnerExtraction(homeUniversityId: string): Promise<PartnerExtraction | null> {
  if (isDemoGuest()) return null;
  if (isDemoMode) return demoPartners(homeUniversityId).extraction;
  const { data, error } = await requireClient()
    .from('partner_extractions')
    .select('status,found,matched,unmatched,error,checked_at,updated_at')
    .eq('university_id', homeUniversityId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as ExtractionRow;
  const stale = row.status === 'running' && Date.now() - Date.parse(row.updated_at) > STALE_JOB_MS;
  return {
    status: stale ? 'error' : row.status,
    found: row.found,
    matched: row.matched,
    unmatched: row.unmatched,
    checkedAt: row.checked_at,
    error: stale ? 'timeout' : row.error,
  };
}

/** Starts reading the official partner list of the student's home university. */
export async function requestPartnerExtraction(homeUniversityId: string): Promise<void> {
  requireDemoStudent();
  if (isDemoMode) {
    const state = demoPartners(homeUniversityId);
    state.extraction = { status: 'running', found: 0, matched: 0, unmatched: [], checkedAt: null, error: null };
    notifyChange();
    // Simulate the research delay; the result is sample data, flagged as such.
    setTimeout(() => {
      const fresh = createDemoPartnerships(homeUniversityId, { fromAi: true });
      const known = new Set(state.partnerships.map((p) => `${p.partnerUniversityId}|${p.agreementType}`));
      state.partnerships.push(...fresh.filter((p) => !known.has(`${p.partnerUniversityId}|${p.agreementType}`)));
      state.extraction = {
        status: 'done',
        found: fresh.length + 2,
        matched: fresh.length,
        unmatched: ['Sample Institute of Technology', 'Sample School of Arts'],
        checkedAt: new Date().toISOString(),
        error: null,
      };
      notifyChange();
    }, 6000);
    return;
  }
  await requireUserId();
  const { error } = await requireClient().functions.invoke('partner-lists', { body: { universityId: homeUniversityId } });
  if (error) {
    const status = functionErrorStatus(error);
    if (status === 429) throw new RateLimitError('rate limited');
    if (status === 403) throw new NotYourUniversityError();
    throw error;
  }
  notifyChange();
}
