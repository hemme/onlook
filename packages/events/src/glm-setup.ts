/** GLM rides the Claude CLI against Z.ai's Anthropic-compatible endpoint; a key is the whole account (no OAuth). */
export type GlmSetupStatus = GlmSetupState['status'];

export const GLM_SETUP_STATUSES = [
  'no-key',
  'checking',
  'saving',
  'ready',
  'invalid-key',
  'error',
] as const satisfies readonly GlmSetupStatus[];

type NoGlmPayload = { detail?: never };
type NoGlmError = { model?: never };

export type GlmSetupState =
  | (({ status: 'no-key' } | { status: 'checking' } | { status: 'saving' }) & NoGlmPayload & NoGlmError)
  | { status: 'ready'; model?: string; detail?: never }
  | ({ status: 'invalid-key'; detail?: 'rejected-by-provider' } & NoGlmError)
  | ({ status: 'error'; detail?: 'keychain-unavailable' | 'network'; model?: never });

export const GLM_API_KEY_PLAN = 'glm-api-key';

export const IDLE_GLM_SETUP_STATE: GlmSetupState = { status: 'no-key' };

/** Trims and bounds a pasted key; an empty or oversized one is no key at all. */
export function sanitizeGlmKey(raw: string): string | undefined {
  const key = raw.replace(/\s+/g, ' ').trim();
  if (key.length < 8 || key.length > 512) return undefined;
  return key;
}
