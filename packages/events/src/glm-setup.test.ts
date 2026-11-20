import { describe, expect, it } from 'bun:test';
import { GLM_API_KEY_PLAN, GLM_SETUP_STATUSES, IDLE_GLM_SETUP_STATE, sanitizeGlmKey } from './glm-setup.js';
import { HARNESS_IDS, isHarnessId } from './models.js';

describe('GLM setup wire types', () => {
  it('recognises glm as a harness id', () => {
    expect(HARNESS_IDS).toContain('glm');
    expect(isHarnessId('glm')).toBe(true);
    expect(isHarnessId('anthropic')).toBe(false);
  });

  it('names the plan after the key it runs on', () => {
    expect(GLM_API_KEY_PLAN).toBe('glm-api-key');
  });

  it('starts from no key', () => {
    expect(IDLE_GLM_SETUP_STATE).toEqual({ status: 'no-key' });
    expect(GLM_SETUP_STATUSES).toContain('ready');
  });

  it('keeps a pasted key whole and refuses junk', () => {
    expect(sanitizeGlmKey('  abc123.def456  ')).toBe('abc123.def456');
    expect(sanitizeGlmKey('id.with spaces\nkept')).toBe('id.with spaces kept');
    expect(sanitizeGlmKey('short')).toBeUndefined();
    expect(sanitizeGlmKey('x'.repeat(513))).toBeUndefined();
  });
});
