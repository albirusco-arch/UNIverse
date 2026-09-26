// Admin import of exchange agreements from an official list (CSV) into SQL for
// the Supabase SQL editor. Every row must link the official page it comes
// from; imported rows are marked verified (an admin checked them).
//
// Columns (header row required, order free):
//   home_university, partner_university   catalogue id, Erasmus code or web domain
//   agreement_type                        erasmus | bilateral | other
//   source_url                            official page listing the agreement
//   department, isced_codes, levels, languages, language_level, places, academic_year   optional
// Lists (isced_codes, levels, languages) are separated by ";".

export const AGREEMENT_TYPES = ['erasmus', 'bilateral', 'other'];
const LEVELS = ['bachelor', 'master', 'phd'];

/** RFC 4180 CSV: quoted fields may contain commas, quotes ("") and newlines. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((value) => value.trim()));
}

const normalizeCode = (code) => code.toUpperCase().replace(/\s+/g, ' ').trim();
const hostOf = (value) => {
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
};

/** Resolves catalogue ids, Erasmus codes and web domains to university ids (catalogue rows from universities.json). */
export function createResolver(universities) {
  const ids = new Set(universities.map((row) => row[0]));
  const byCode = new Map();
  const byDomain = new Map();
  for (const [id, , , , website, domains, erasmusCode] of universities) {
    if (erasmusCode) byCode.set(normalizeCode(erasmusCode), id);
    for (const domain of [hostOf(website), ...(domains ? domains.split(' ') : [])]) {
      if (domain && !byDomain.has(domain)) byDomain.set(domain, id);
    }
  }
  return (value) => {
    const text = value.trim();
    if (!text) return null;
    if (ids.has(text)) return text;
    const code = byCode.get(normalizeCode(text));
    if (code) return code;
    const host = hostOf(text);
    return (host && byDomain.get(host)) ?? null;
  };
}

const list = (value) =>
  value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);

/** Validates the CSV rows; returns agreements and the errors found (with CSV line numbers). */
export function readAgreements(text, resolve) {
  const [header, ...rows] = parseCsv(text);
  const errors = [];
  if (!header) return { agreements: [], errors: ['The file is empty.'] };
  const columns = header.map((name) => name.trim().toLowerCase());
  for (const required of ['home_university', 'partner_university', 'agreement_type', 'source_url']) {
    if (!columns.includes(required)) errors.push(`Missing column "${required}".`);
  }
  if (errors.length) return { agreements: [], errors };

  const agreements = [];
  rows.forEach((values, index) => {
    const line = index + 2;
    const cell = (name) => (values[columns.indexOf(name)] ?? '').trim();
    const problems = [];
    const home = resolve(cell('home_university'));
    const partner = resolve(cell('partner_university'));
    if (!home) problems.push(`unknown home university "${cell('home_university')}"`);
    if (!partner) problems.push(`unknown partner university "${cell('partner_university')}"`);
    if (home && home === partner) problems.push('home and partner are the same university');
    const type = cell('agreement_type').toLowerCase().replace('erasmus+', 'erasmus');
    if (!AGREEMENT_TYPES.includes(type)) problems.push(`agreement_type must be one of ${AGREEMENT_TYPES.join(', ')}`);
    const sourceUrl = cell('source_url');
    if (!/^https?:\/\/\S+$/.test(sourceUrl)) problems.push('source_url must be the full link to the official page');
    const isced = list(cell('isced_codes'));
    if (isced.some((code) => !/^[0-9]{2}([0-9]{1,2})?$/.test(code))) problems.push('isced_codes must be ISCED-F codes like 041 or 0311');
    const levels = list(cell('levels')).map((level) => level.toLowerCase());
    if (levels.some((level) => !LEVELS.includes(level))) problems.push(`levels must be ${LEVELS.join(', ')}`);
    const languages = list(cell('languages')).map((code) => code.toLowerCase());
    if (languages.some((code) => !/^[a-z]{2}$/.test(code))) problems.push('languages must be ISO 639-1 codes like en or de');
    const placesText = cell('places');
    const places = placesText ? Number(placesText) : null;
    if (places !== null && !(Number.isInteger(places) && places >= 1 && places <= 500)) problems.push('places must be a whole number from 1 to 500');

    if (problems.length) {
      errors.push(`Line ${line}: ${problems.join('; ')}.`);
      return;
    }
    agreements.push({
      home,
      partner,
      type,
      department: cell('department'),
      isced,
      levels,
      languages,
      languageLevel: cell('language_level'),
      places,
      academicYear: cell('academic_year'),
      sourceUrl,
    });
  });
  return { agreements, errors };
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const array = (values) => (values.length ? `array[${values.map(quote).join(', ')}]::text[]` : `'{}'::text[]`);

function departmentKind(name) {
  const lower = name.toLowerCase();
  if (/facult|fakult|facolt/.test(lower)) return 'faculty';
  if (/school|scuola|école|escuela|schule/.test(lower)) return 'school';
  if (/institut/.test(lower)) return 'institute';
  return 'department';
}

/** SQL that upserts the departments and agreements, marking them verified as of `today`. */
export function agreementsSql(agreements, { today, origin }) {
  const lines = [`-- Generated by scripts/import-partnerships.mjs from ${origin} on ${today}. Review, then run in the Supabase SQL editor.`, 'begin;', ''];
  const departments = new Map();
  for (const a of agreements) {
    if (a.department) departments.set(`${a.home}|${a.department.toLowerCase()}`, a);
  }
  for (const a of departments.values()) {
    lines.push(
      `insert into public.departments (university_id, name, kind, source, source_url, verified, last_verified)`,
      `  values (${quote(a.home)}, ${quote(a.department)}, ${quote(departmentKind(a.department))}, 'admin', ${quote(a.sourceUrl)}, true, ${quote(today)})`,
      '  on conflict (university_id, name_key) do nothing;',
    );
  }
  for (const a of agreements) {
    const department = a.department
      ? `(select id from public.departments where university_id = ${quote(a.home)} and name_key = lower(${quote(a.department)}))`
      : 'null';
    lines.push(
      'insert into public.partnerships (home_university_id, partner_university_id, agreement_type, home_department_id, isced_codes, levels, languages, language_level, places, academic_year, source, source_url, verified, last_verified)',
      `  values (${quote(a.home)}, ${quote(a.partner)}, ${quote(a.type)}, ${department}, ${array(a.isced)}, ${array(a.levels)}, ${array(a.languages)}, ${quote(a.languageLevel)}, ${a.places ?? 'null'}, ${quote(a.academicYear)}, 'admin', ${quote(a.sourceUrl)}, true, ${quote(today)})`,
      "  on conflict (home_university_id, partner_university_id, agreement_type, coalesce(home_department_id::text, ''))",
      '  do update set isced_codes = excluded.isced_codes, levels = excluded.levels, languages = excluded.languages,',
      '    language_level = excluded.language_level, places = excluded.places, academic_year = excluded.academic_year,',
      "    source = 'admin', source_url = excluded.source_url, verified = true, last_verified = excluded.last_verified, hidden = false, updated_at = now();",
    );
  }
  lines.push('', 'commit;', '');
  return lines.join('\n');
}
