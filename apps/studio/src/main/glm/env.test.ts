import { afterEach, describe, expect, it } from 'bun:test';
import { cleanupTempFixtures, makeStateRoot } from '@studio/fixtures';
import { resetUserEnvForTests, userEnv } from '../env/shell-env.js';
import { setGlmCredentialsRootForTesting, setSafeStorageForTesting } from './credentials.js';
import { glmChildSdkEnv } from './env.js';

/** A login shell that exports a foreign Anthropic route: the app's overrides must win over it. */
async function shellWith(env: Record<string, string>): Promise<void> {
  resetUserEnvForTests(async () => ({ ...env }));
  await userEnv();
}

afterEach(() => {
  resetUserEnvForTests();
  setSafeStorageForTesting(undefined);
  setGlmCredentialsRootForTesting(undefined);
  delete process.env['STUDIO_STATE_ROOT'];
  delete process.env['STUDIO_GLM_BASE_URL'];
  cleanupTempFixtures();
});

describe('the GLM child env', () => {
  it('layers the Z.ai endpoint, the stored key and a private config dir over the login shell', async () => {
    const root = makeStateRoot({ name: 'glm-env-key' });
    process.env['STUDIO_STATE_ROOT'] = root;
    setGlmCredentialsRootForTesting(root);
    setSafeStorageForTesting({
      isEncryptionAvailable: () => true,
      encryptString: (plain) => Buffer.from(`enc:${plain}`, 'utf8'),
      decryptString: (blob) => blob.toString('utf8').slice('enc:'.length),
    });
    const { saveGlmKey } = await import('./credentials.js');
    saveGlmKey('zai-secret-key');
    await shellWith({ ANTHROPIC_BASE_URL: 'https://api.anthropic.com', ANTHROPIC_AUTH_TOKEN: 'someone-elses', CLAUDE_CONFIG_DIR: '/Users/shared/.claude', CLAUDECODE: '1' });

    const env = await glmChildSdkEnv();
    expect(env?.['ANTHROPIC_BASE_URL']).toBe('https://api.z.ai/api/anthropic');
    expect(env?.['ANTHROPIC_AUTH_TOKEN']).toBe('zai-secret-key');
    expect(env?.['CLAUDE_CONFIG_DIR']).toContain('glm/claude-config');
    // The nesting marker a Studio-driven run would leak is scrubbed.
    expect(env?.['CLAUDECODE']).toBeUndefined();
  });

  it('keeps the endpoint pointed at Z.ai even with no key stored', async () => {
    await shellWith({});
    const env = await glmChildSdkEnv();
    expect(env?.['ANTHROPIC_BASE_URL']).toBe('https://api.z.ai/api/anthropic');
    expect(env?.['ANTHROPIC_AUTH_TOKEN']).toBeUndefined();
  });

  it('honours the STUDIO_GLM_BASE_URL override for a different Z.ai route', async () => {
    await shellWith({});
    const env = await glmChildSdkEnv({ STUDIO_GLM_BASE_URL: 'https://open.bigmodel.cn/api/anthropic' });
    expect(env?.['ANTHROPIC_BASE_URL']).toBe('https://open.bigmodel.cn/api/anthropic');
  });

  it('still yields an env when the capture fails: the inherited environment routes to Z.ai', async () => {
    resetUserEnvForTests(async () => undefined);
    await shellWith({});
    const env = await glmChildSdkEnv();
    expect(env?.['ANTHROPIC_BASE_URL']).toBe('https://api.z.ai/api/anthropic');
  });
});
