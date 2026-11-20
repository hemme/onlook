import { afterEach, describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanupTempFixtures, makeStateRoot } from '@studio/fixtures';
import { clearGlmKey, readGlmKey, saveGlmKey, setGlmCredentialsRootForTesting, setSafeStorageForTesting } from './credentials.js';

/** XOR-with-a-marker cipher: reversible, and a blob it did not write fails to decrypt. */
function wiredStorage(options: { available?: boolean; failDecrypt?: boolean } = {}): void {
  const available = options.available ?? true;
  setSafeStorageForTesting({
    isEncryptionAvailable: () => available,
    encryptString: (plain) => Buffer.from(`enc:${plain}`, 'utf8'),
    decryptString: (blob) => {
      if (options.failDecrypt) throw new Error('cannot decrypt');
      const text = blob.toString('utf8');
      if (!text.startsWith('enc:')) throw new Error('not ours');
      return text.slice('enc:'.length);
    },
  });
}

afterEach(() => {
  setSafeStorageForTesting(undefined);
  setGlmCredentialsRootForTesting(undefined);
  cleanupTempFixtures();
});

describe('GLM credentials', () => {
  it('round-trips a key through the safe-storage seam', () => {
    const root = makeStateRoot({ name: 'glm-roundtrip' });
    setGlmCredentialsRootForTesting(root);
    wiredStorage();
    expect(saveGlmKey('zai-secret-key')).toBe('saved');
    expect(readGlmKey()).toEqual({ key: 'zai-secret-key', outcome: 'saved' });
    clearGlmKey();
    expect(readGlmKey()).toEqual({ outcome: 'saved' });
  });

  it('refuses to save when no encryption is available, and reads no key', () => {
    setGlmCredentialsRootForTesting(makeStateRoot({ name: 'glm-unavailable' }));
    wiredStorage({ available: false });
    expect(saveGlmKey('zai-secret-key')).toBe('keychain-unavailable');
    expect(readGlmKey()).toEqual({ outcome: 'saved' });
  });

  it('reports a blob it cannot decrypt as corrupt, not as absent', () => {
    const root = makeStateRoot({ name: 'glm-corrupt' });
    setGlmCredentialsRootForTesting(root);
    wiredStorage();
    saveGlmKey('zai-secret-key');
    wiredStorage({ failDecrypt: true });
    expect(readGlmKey()).toEqual({ outcome: 'corrupt-blob' });
  });

  it('stores only the encrypted blob, never the plain key', () => {
    const root = makeStateRoot({ name: 'glm-cipher' });
    setGlmCredentialsRootForTesting(root);
    wiredStorage();
    saveGlmKey('zai-plain-never-lands');
    const raw = readFileSync(join(root, 'glm-credentials.json'), 'utf8');
    expect(raw).not.toContain('zai-plain-never-lands');
    // The blob on disk is the base64 of the safe-storage ciphertext, which round-trips back to the key.
    expect(readGlmKey()).toEqual({ key: 'zai-plain-never-lands', outcome: 'saved' });
  });
});
