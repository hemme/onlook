import { safeStorage } from 'electron';
import { defineDomain } from '../state/store.js';

/** The seam the tests and a driven run drive; the real one touches the OS keychain. */
export interface SafeStorageDeps {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
}

export interface GlmCredentials {
  /** `base64` of the `safeStorage` blob; never the plain key. */
  blob?: string;
}

let rootOverride: string | undefined;

/** A suite points the file at its own scratch folder; `undefined` returns it to the app's state root. A new root drops the memoized domain. */
export function setGlmCredentialsRootForTesting(root: string | undefined): void {
  if (root === rootOverride) return;
  rootOverride = root;
  domain = undefined;
}

let domain: ReturnType<typeof defineDomain<GlmCredentials>> | undefined;

function credentialsDomain(): ReturnType<typeof defineDomain<GlmCredentials>> {
  if (domain === undefined) {
    const root = rootOverride;
    domain = defineDomain<GlmCredentials>({
      name: 'glm-credentials',
      version: 1,
      fallback: () => ({}),
      ...(root === undefined ? {} : { root: () => root }),
    });
  }
  return domain;
}

let deps: SafeStorageDeps = safeStorage;

export function setSafeStorageForTesting(replacement: SafeStorageDeps | undefined): void {
  deps = replacement ?? safeStorage;
}

export type GlmKeyOutcome = 'saved' | 'keychain-unavailable' | 'corrupt-blob';

export function readGlmKey(): { key?: string; outcome: GlmKeyOutcome } {
  const { blob } = credentialsDomain().read();
  if (blob === undefined) return { outcome: 'saved' };
  if (!deps.isEncryptionAvailable()) return { outcome: 'keychain-unavailable' };
  try {
    return { key: deps.decryptString(Buffer.from(blob, 'base64')), outcome: 'saved' };
  } catch {
    return { outcome: 'corrupt-blob' };
  }
}

export function saveGlmKey(key: string): GlmKeyOutcome {
  if (!deps.isEncryptionAvailable()) return 'keychain-unavailable';
  try {
    credentialsDomain().write({ blob: deps.encryptString(key).toString('base64') });
    return 'saved';
  } catch {
    return 'keychain-unavailable';
  }
}

export function clearGlmKey(): void {
  credentialsDomain().erase();
}
