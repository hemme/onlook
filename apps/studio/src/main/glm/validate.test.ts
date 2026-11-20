import { afterEach, describe, expect, it } from 'bun:test';
import { validateGlmKey } from './validate.js';

interface RecordedRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

/** Answers one canned status and records the request that earned it. */
function scripted(status: number): { requests: RecordedRequest[]; restore(): void } {
  const requests: RecordedRequest[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    requests.push({
      url: String(input),
      headers: Object.fromEntries(Object.entries(init?.headers ?? {})) as Record<string, string>,
      body: String(init?.body ?? ''),
    });
    return new Response(status === 200 ? '{}' : 'nope', { status });
  }) as unknown as typeof fetch;
  return {
    requests,
    restore: () => {
      globalThis.fetch = realFetch;
    },
  };
}

afterEach(() => {
  // Each test restores its own fetch; nothing to do here but keep the hook for symmetry.
});

describe('the GLM key check', () => {
  it('accepts a 2xx and sends the headers and body the Anthropic-compatible route needs', async () => {
    const mock = scripted(200);
    try {
      expect(await validateGlmKey('zai-secret', new AbortController().signal)).toBe('accepted');
      expect(mock.requests).toHaveLength(1);
      const request = mock.requests[0]!;
      expect(request.url).toBe('https://api.z.ai/api/anthropic/v1/messages');
      expect(request.headers['x-api-key']).toBe('zai-secret');
      expect(request.headers['authorization']).toBe('Bearer zai-secret');
      expect(request.headers['anthropic-version']).toBe('2023-06-01');
      // A request without a model is a 400 on Z.ai's route, so the model must ride the body.
      expect(JSON.parse(request.body).model).toBe('glm-5.3');
    } finally {
      mock.restore();
    }
  });

  it('refuses the key on 401 and 403', async () => {
    for (const status of [401, 403]) {
      const mock = scripted(status);
      try {
        expect(await validateGlmKey('zai-wrong', new AbortController().signal)).toBe('rejected-by-provider');
      } finally {
        mock.restore();
      }
    }
  });

  it('takes a non-auth 4xx as proof the credential itself stands', async () => {
    const mock = scripted(400);
    try {
      expect(await validateGlmKey('zai-secret', new AbortController().signal)).toBe('accepted');
    } finally {
      mock.restore();
    }
  });

  it('reports the network when the endpoint cannot be reached', async () => {
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error('connection refused');
    }) as unknown as typeof fetch;
    try {
      expect(await validateGlmKey('zai-secret', new AbortController().signal)).toBe('network');
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
