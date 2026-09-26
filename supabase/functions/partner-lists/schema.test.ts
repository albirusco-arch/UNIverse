/**
 * Offline tests for reading partner lists: only partners on retrieved official
 * pages are kept, and they are matched to the catalogue by exact identifiers
 * only. Run with: npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type Anthropic from '@anthropic-ai/sdk';

import { normalizeUrl } from '../_shared/sources.ts';
import { extractPartners } from './extract.ts';
import { buildUserPrompt, SYSTEM_PROMPT } from './prompt.ts';
import {
  departmentKind,
  finalizePartners,
  matchPartners,
  type CatalogueRow,
  type SubmittedPartner,
  type SubmittedPartners,
} from './schema.ts';

const LIST = 'https://www.unimi.it/en/study/exchange/erasmus-partners.pdf';

function partner(name: string, overrides: Partial<SubmittedPartner> = {}): SubmittedPartner {
  return {
    name,
    englishName: '',
    countryCode: 'DE',
    city: '',
    erasmusCode: '',
    website: '',
    agreementType: 'erasmus',
    department: '',
    iscedCodes: [],
    levels: [],
    languages: [],
    languageLevel: '',
    places: null,
    academicYear: '2026/27',
    sourceIds: [1],
    ...overrides,
  };
}

const submitted: SubmittedPartners = {
  partners: [
    partner('Ruprecht-Karls-Universität Heidelberg', { erasmusCode: 'd  heidelb01', department: 'Department of Biosciences', iscedCodes: ['051'], languages: ['de'], languageLevel: 'B2', places: 2 }),
    partner('Universiteit van Amsterdam', { countryCode: 'NL', website: 'https://www.uva.nl/en', agreementType: 'erasmus' }),
    partner('University of Toronto', { countryCode: 'CA', agreementType: 'bilateral' }),
    partner('Famous University From Memory', { sourceIds: [] }),
    partner('Forum Rumour University', { sourceIds: [2] }),
    partner('Unopened List University', { sourceIds: [3] }),
  ],
  listComplete: false,
  sources: [
    { id: 1, url: LIST, title: 'Erasmus+ partner universities', kind: 'official_home', academicYear: '2026/27' },
    { id: 2, url: 'https://forum.example.com/unimi-partners', title: 'Forum', kind: 'other', academicYear: '' },
    { id: 3, url: 'https://www.unimi.it/en/unopened', title: 'Not opened', kind: 'official_home', academicYear: '' },
  ],
};

const retrieved = new Set([normalizeUrl(LIST)!, normalizeUrl('https://forum.example.com/unimi-partners')!]);

const catalogue: CatalogueRow[] = [
  { id: 'heidelberg', name: 'Heidelberg University', country_code: 'DE', website: 'https://www.uni-heidelberg.de', email_domains: ['uni-heidelberg.de'], erasmus_code: 'D HEIDELB01' },
  { id: 'uva', name: 'University of Amsterdam', country_code: 'NL', website: 'https://www.uva.nl', email_domains: ['uva.nl'], erasmus_code: null },
  { id: 'utoronto', name: 'University of Toronto', country_code: 'CA', website: 'https://www.utoronto.ca', email_domains: ['utoronto.ca'], erasmus_code: null },
  { id: 'toronto-us', name: 'University of Toronto', country_code: 'US', website: 'https://example.edu', email_domains: [], erasmus_code: null },
  { id: 'unimi', name: 'University of Milan', country_code: 'IT', website: 'https://www.unimi.it', email_domains: ['unimi.it'], erasmus_code: null },
];

describe('partner lists', () => {
  it('keeps only partners cited on a retrieved official page, with that page as source', () => {
    const result = finalizePartners(submitted, retrieved, new Date('2026-09-27T10:00:00Z'));
    assert.deepEqual(
      result.partners.map((p) => p.name),
      ['Ruprecht-Karls-Universität Heidelberg', 'Universiteit van Amsterdam', 'University of Toronto'],
    );
    assert.ok(result.partners.every((p) => p.sourceUrl === LIST));
    assert.equal(result.listComplete, false);
    assert.equal(result.checkedAt, '2026-09-27T10:00:00.000Z');
  });

  it('matches by Erasmus code, official domain or exact name in the same country only', () => {
    const { partners } = finalizePartners(submitted, retrieved, new Date());
    const extra = [
      { ...partner('Univ. Heidelberg', { erasmusCode: '' }), sourceUrl: LIST }, // no fuzzy matching
      { ...partner('University of Toronto', { countryCode: 'GB' }), sourceUrl: LIST }, // wrong country
      { ...partner('Università degli Studi di Milano', { countryCode: 'IT', website: 'unimi.it' }), sourceUrl: LIST }, // the home itself
    ];
    const { matched, unmatched } = matchPartners([...partners, ...extra], catalogue, 'unimi');
    assert.deepEqual(
      matched.map((m) => [m.partner.name, m.universityId]),
      [
        ['Ruprecht-Karls-Universität Heidelberg', 'heidelberg'],
        ['Universiteit van Amsterdam', 'uva'],
        ['University of Toronto', 'utoronto'],
      ],
    );
    assert.deepEqual(unmatched, ['Univ. Heidelberg (DE)', 'University of Toronto (GB)']);
  });

  it('refuses ambiguous names', () => {
    const twins: CatalogueRow[] = [
      { id: 'a', name: 'Saint Mary University', country_code: 'CA', website: 'https://a.ca', email_domains: [], erasmus_code: null },
      { id: 'b', name: 'Saint Mary University', country_code: 'CA', website: 'https://b.ca', email_domains: [], erasmus_code: null },
    ];
    const { matched, unmatched } = matchPartners([{ ...partner('Saint Mary University', { countryCode: 'CA' }), sourceUrl: LIST }], twins, 'x');
    assert.equal(matched.length, 0);
    assert.equal(unmatched.length, 1);
  });

  it('names department kinds', () => {
    assert.equal(departmentKind('Faculty of Law'), 'faculty');
    assert.equal(departmentKind('Scuola di Economia'), 'school');
    assert.equal(departmentKind('Department of Biosciences'), 'department');
  });

  it('prompts for the home university and forbids partners from memory', () => {
    const prompt = buildUserPrompt({ name: 'University of Milan', website: 'https://www.unimi.it', country: 'Italy' }, new Date('2026-09-27T00:00:00Z'));
    assert.match(prompt, /Today is 2026-09-27/);
    assert.match(prompt, /University of Milan \(Italy\), official website: https:\/\/www\.unimi\.it/);
    assert.match(SYSTEM_PROMPT, /Never add a partner from memory/);
  });

  it('streams the long extraction and returns only verified partners', async () => {
    const calls: Record<string, unknown>[] = [];
    const final = {
      id: 'msg_1',
      type: 'message',
      role: 'assistant',
      model: 'claude-opus-5',
      stop_reason: 'tool_use',
      stop_details: null,
      usage: { input_tokens: 10, output_tokens: 10, cache_read_input_tokens: 0, server_tool_use: { web_search_requests: 1 } },
      content: [
        { type: 'web_fetch_tool_result', tool_use_id: 'srvtoolu_1', content: { type: 'web_fetch_result', url: LIST, content: { type: 'document', source: { type: 'text', media_type: 'text/plain', data: '...' } } } },
        { type: 'tool_use', id: 'toolu_1', name: 'submit_partners', input: submitted },
      ],
    };
    const client = {
      beta: {
        messages: {
          create: async () => {
            throw new Error('long extractions must be streamed');
          },
          stream: (params: Record<string, unknown>) => {
            calls.push(params);
            return { finalMessage: async () => final };
          },
        },
      },
    } as unknown as Anthropic;
    const result = await extractPartners(client, { name: 'University of Milan', website: 'https://www.unimi.it', country: 'Italy' });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].max_tokens, 64000);
    const tools = calls[0].tools as { name?: string; eager_input_streaming?: boolean; max_content_tokens?: number }[];
    assert.equal(tools.find((tool) => tool.name === 'submit_partners')?.eager_input_streaming, true);
    assert.equal(tools.find((tool) => tool.name === 'web_fetch')?.max_content_tokens, 60000);
    // The forum-only partner is dropped; the unopened page was never retrieved.
    assert.equal(result.partners.length, 3);
  });
});
