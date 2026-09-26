/** Test helper: a fake Anthropic client that replays scripted responses. */
import type Anthropic from '@anthropic-ai/sdk';

import { DEFAULT_MODEL } from './agent.ts';

export type Scripted = Record<string, unknown>;

export function message(content: unknown[], stop_reason: string): Scripted {
  return {
    id: 'msg',
    type: 'message',
    role: 'assistant',
    model: DEFAULT_MODEL,
    content,
    stop_reason,
    usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, server_tool_use: { web_search_requests: 1 } },
  };
}

export function toolUse(name: string, input: unknown, id = 'toolu_1') {
  return { type: 'tool_use', id, name, input };
}

export function fakeClient(responses: Scripted[]) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    beta: {
      messages: {
        create: async (params: Record<string, unknown>) => {
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
