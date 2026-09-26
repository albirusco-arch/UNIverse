/**
 * Offline tests for the research loop with a scripted fake Anthropic client.
 * Run with: npm run test:functions
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type Anthropic from '@anthropic-ai/sdk';

import { DEFAULT_MODEL, ResearchError, researchCourseMatch } from './research.ts';
import { normalizeUrl, type CourseMatchRequest, type SubmittedReport } from './schema.ts';

const request: CourseMatchRequest = {
  homeUniversity: 'University of Milan',
  program: 'BSc Biotechnology',
  level: 'bachelor',
  destinationId: 'heidelberg',
  destinationName: 'Heidelberg University',
  term: 'Fall 2027',
  courses: [{ name: 'Biochemistry II', ects: 6 }],
  notes: '',
  locale: 'it',
};

const report: SubmittedReport = {
  summary: 'Feasible.',
  academicYear: '2027/28',
  exchangePageUrl: 'https://www.uni-heidelberg.de/exchange',
  requirements: [
    { category: 'language', title: 'German B1', detail: 'B1 for German-taught courses.', sourceIds: [1] },
    { category: 'financial', title: 'Grant', detail: 'From a forum.', sourceIds: [3] },
    { category: 'credits', title: 'Min credits', detail: 'Cited page never opened.', sourceIds: [2, 99] },
  ],
  deadlines: [{ title: 'Application', date: '15 May 2027', sourceIds: [1] }],
  courseMatches: [
    {
      homeCourse: 'Biochemistry II',
      homeEcts: 6,
      destinationCourse: 'Molecular Biochemistry',
      destinationCode: 'MB-1',
      destinationEcts: 6,
      semester: 'Winter',
      language: 'English',
      url: 'https://www.uni-heidelberg.de/catalogue/mb-1',
      fit: 'strong',
      rationale: 'Same topics.',
      sourceIds: [4],
    },
  ],
  warnings: ['Confirm with coordinator.'],
  sources: [
    { id: 1, url: 'https://www.uni-heidelberg.de/exchange/', title: 'Exchange', kind: 'official_destination', academicYear: '2027/28' },
    { id: 2, url: 'https://www.uni-heidelberg.de/rules', title: 'Rules', kind: 'official_destination', academicYear: '' },
    { id: 3, url: 'https://forum.example.org/thread', title: 'Forum', kind: 'other', academicYear: '' },
    { id: 4, url: 'https://uni-heidelberg.de/catalogue/mb-1#top', title: 'Catalogue', kind: 'official_program', academicYear: '2027/28' },
  ],
};

type Scripted = Record<string, unknown>;

function message(content: unknown[], stop_reason: string): Scripted {
  return {
    id: 'msg',
    type: 'message',
    role: 'assistant',
    model: DEFAULT_MODEL,
    content,
    stop_reason,
    usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 10, server_tool_use: { web_search_requests: 1 } },
  };
}

const searchResult = {
  type: 'web_search_tool_result',
  tool_use_id: 'srv_1',
  content: [
    { type: 'web_search_result', url: 'https://www.uni-heidelberg.de/exchange', title: 'Exchange', encrypted_content: 'x', page_age: null },
    { type: 'web_search_result', url: 'https://forum.example.org/thread', title: 'Forum', encrypted_content: 'x', page_age: null },
  ],
};

const fetchResult = {
  type: 'web_fetch_tool_result',
  tool_use_id: 'srv_2',
  content: {
    type: 'web_fetch_result',
    url: 'https://www.uni-heidelberg.de/catalogue/mb-1',
    retrieved_at: null,
    content: { type: 'document', source: { type: 'text', media_type: 'text/plain', data: '...' } },
  },
};

const submit = (input: unknown, id = 'toolu_1') => ({ type: 'tool_use', id, name: 'submit_report', input });

/** Fake client that replays scripted responses and records every request. */
function fakeClient(responses: Scripted[]) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        create: async (params: Record<string, unknown>) => {
          // Snapshot: the loop mutates the messages array after each call.
          calls.push(structuredClone(params));
          const next = responses.shift();
          if (!next) throw new Error('No scripted response left');
          return next;
        },
      },
    },
  };
  return { client: client as unknown as Anthropic, calls };
}

describe('researchCourseMatch', () => {
  it('resumes paused turns and verifies cited sources against retrieved URLs', async () => {
    const { client, calls } = fakeClient([
      message([searchResult, fetchResult], 'pause_turn'),
      message([{ type: 'text', text: 'Done.', citations: null }, submit(report)], 'tool_use'),
    ]);

    const result = await researchCourseMatch(client, request, { now: new Date('2026-09-26T10:00:00Z') });

    assert.equal(calls.length, 2);
    const first = calls[0];
    assert.equal(first.model, 'claude-opus-5');
    assert.equal(first.fallbacks, 'default');
    assert.deepEqual(first.betas, ['server-side-fallback-2026-07-01']);
    const toolTypes = (first.tools as { type?: string; name: string }[]).map((tool) => tool.type ?? tool.name);
    assert.deepEqual(toolTypes, ['web_search_20260209', 'web_fetch_20260209', 'submit_report']);

    // pause_turn: the paused assistant turn is sent back with no extra user message.
    const second = calls[1].messages as { role: string }[];
    assert.deepEqual(
      second.map((m) => m.role),
      ['user', 'assistant'],
    );

    const final = result.report;
    assert.equal(final.checkedAt, '2026-09-26T10:00:00.000Z');
    assert.deepEqual(
      final.sources.map((s) => s.retrieved),
      [true, false, true, true],
    );
    // Official + retrieved -> verified; forum-only -> not; unknown ids are dropped.
    assert.equal(final.requirements[0].verified, true);
    assert.equal(final.requirements[1].verified, false);
    assert.equal(final.requirements[2].verified, false);
    assert.deepEqual(final.requirements[2].sourceIds, [2]);
    assert.equal(final.deadlines[0].verified, true);
    assert.equal(final.courseMatches[0].verified, true);
    assert.equal(result.usage.inputTokens, 200);
    assert.equal(result.usage.webSearches, 2);
  });

  it('asks for a corrected report when the submission does not match the schema', async () => {
    const { client, calls } = fakeClient([
      message([submit({ summary: 'incomplete' }, 'toolu_bad')], 'tool_use'),
      message([submit(report, 'toolu_good')], 'tool_use'),
    ]);

    const result = await researchCourseMatch(client, request);

    assert.equal(result.report.summary, 'Feasible.');
    const retry = calls[1].messages as { role: string; content: unknown }[];
    const feedback = retry[retry.length - 1].content as { type: string; tool_use_id: string; is_error: boolean }[];
    assert.equal(feedback[0].type, 'tool_result');
    assert.equal(feedback[0].tool_use_id, 'toolu_bad');
    assert.equal(feedback[0].is_error, true);
    // Nothing was retrieved in this conversation, so nothing can be verified.
    assert.ok(result.report.requirements.every((r) => !r.verified));
  });

  it('nudges the model when it ends its turn without submitting', async () => {
    const { client, calls } = fakeClient([
      message([{ type: 'text', text: 'Here is my report…', citations: null }], 'end_turn'),
      message([submit(report)], 'tool_use'),
    ]);

    await researchCourseMatch(client, request);

    const nudge = calls[1].messages as { role: string; content: unknown }[];
    assert.equal(nudge[nudge.length - 1].role, 'user');
    assert.match(String(nudge[nudge.length - 1].content), /submit_report/);
  });

  it('surfaces refusals as a ResearchError', async () => {
    const { client } = fakeClient([message([], 'refusal')]);
    await assert.rejects(researchCourseMatch(client, request), (error: unknown) => {
      return error instanceof ResearchError && error.code === 'refusal';
    });
  });

  it('gives up after too many turns without a report', async () => {
    const { client } = fakeClient(Array.from({ length: 8 }, () => message([searchResult], 'pause_turn')));
    await assert.rejects(researchCourseMatch(client, request), (error: unknown) => {
      return error instanceof ResearchError && error.code === 'no_report';
    });
  });
});

describe('normalizeUrl', () => {
  it('ignores protocol, www, trailing slashes and fragments', () => {
    assert.equal(normalizeUrl('https://www.Uni-Heidelberg.de/exchange/#x'), 'uni-heidelberg.de/exchange');
    assert.equal(normalizeUrl('http://uni-heidelberg.de/exchange'), 'uni-heidelberg.de/exchange');
    assert.equal(normalizeUrl('https://a.org/p?q=1'), 'a.org/p?q=1');
  });

  it('rejects non-web URLs', () => {
    assert.equal(normalizeUrl('javascript:alert(1)'), null);
    assert.equal(normalizeUrl('not a url'), null);
  });
});
