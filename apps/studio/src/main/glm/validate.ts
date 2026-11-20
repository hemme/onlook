import { GLM_BASE_URL, GLM_BASE_URL_SWITCH, GLM_DEFAULT_MODEL } from './constants.js';
import { readEnvSwitch } from '../env/switch.js';

export type GlmKeyVerdict = 'accepted' | 'rejected-by-provider' | 'network';

export type GlmValidate = (key: string, signal: AbortSignal) => Promise<GlmKeyVerdict>;

/** One provider request, the cheapest the endpoint answers: a key the provider refuses is refused before any session starts. */
export const validateGlmKey: GlmValidate = async (key, signal) => {
  const base = readEnvSwitch(GLM_BASE_URL_SWITCH) ?? GLM_BASE_URL;
  try {
    const response = await fetch(`${base}/v1/messages`, {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': key,
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: GLM_DEFAULT_MODEL,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      }),
    });
    if (response.ok) return 'accepted';
    if (response.status === 401 || response.status === 403) return 'rejected-by-provider';
    // The provider answered and did not refuse the key: a 4xx about the request body still proves the credential.
    return response.status < 500 ? 'accepted' : 'network';
  } catch {
    return 'network';
  }
};
