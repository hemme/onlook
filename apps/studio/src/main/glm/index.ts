import { handle } from '../ipc/bridge.js';
import { IPC_EMIT, IPC_INVOKE, IDLE_GLM_SETUP_STATE, sanitizeGlmKey, type GlmSetupState } from '@studio/events';
import { broadcastToRenderers } from '../tabs/broadcast.js';
import { recordAgentSetupStep } from '../telemetry/setup-step.js';
import { log } from '../log/index.js';
import { clearGlmKey, readGlmKey, saveGlmKey } from './credentials.js';
import { validateGlmKey, type GlmKeyVerdict, type GlmValidate } from './validate.js';
import { GLM_DEFAULT_MODEL } from './constants.js';

const logger = log('glm');

/** A key check that hangs parks the tile; the same bound the Claude status read allows. */
const VALIDATE_TIMEOUT_MS = 60_000;

export interface GlmHostOptions {
  emit?: (state: GlmSetupState) => void;
  validate?: GlmValidate;
  clock?: () => number;
}

function settle(verdict: GlmKeyVerdict): GlmSetupState {
  if (verdict === 'accepted') return { status: 'ready', model: GLM_DEFAULT_MODEL };
  if (verdict === 'rejected-by-provider') return { status: 'invalid-key', detail: 'rejected-by-provider' };
  return { status: 'error', detail: 'network' };
}

/** GLM's whole setup surface: no login child, no browser round-trip — a stored key plus one provider request. */
export class GlmHost {
  private readonly options: GlmHostOptions;
  private state: GlmSetupState = IDLE_GLM_SETUP_STATE;
  private checking: Promise<GlmSetupState> | undefined;

  constructor(options: GlmHostOptions = {}) {
    this.options = options;
  }

  current(): GlmSetupState {
    return this.state;
  }

  private publish(next: GlmSetupState): GlmSetupState {
    this.state = next;
    (this.options.emit ?? ((state) => broadcastToRenderers(IPC_EMIT.glmState, state)))(next);
    return next;
  }

  /** Re-reads the stored key; `fresh` re-asks the provider. An in-flight check is joined, not doubled. */
  status(req: { fresh?: boolean } | undefined): Promise<GlmSetupState> {
    const read = readGlmKey();
    if (read.outcome === 'keychain-unavailable') return Promise.resolve(this.publish({ status: 'error', detail: 'keychain-unavailable' }));
    if (read.key === undefined) return Promise.resolve(this.publish({ status: 'no-key' }));
    if (!req?.fresh) return Promise.resolve(this.publish({ status: 'ready', model: GLM_DEFAULT_MODEL }));
    this.checking ??= this.check(read.key).finally(() => {
      this.checking = undefined;
    });
    return this.checking;
  }

  private async check(key: string): Promise<GlmSetupState> {
    this.publish({ status: 'checking' });
    const controller = new AbortController();
    const clock = this.options.clock ?? (() => Date.now());
    const startedAt = clock();
    const timer = setTimeout(() => controller.abort(), VALIDATE_TIMEOUT_MS);
    try {
      const verdict = await (this.options.validate ?? validateGlmKey)(key, controller.signal);
      const outcome = verdict === 'accepted' ? 'ok' : verdict === 'rejected-by-provider' ? 'invalid_key' : 'failed';
      recordAgentSetupStep('glm', 'key_saved', { outcome });
      return this.publish(settle(verdict));
    } finally {
      clearTimeout(timer);
      logger.debug('key check finished', { elapsed_ms: clock() - startedAt });
    }
  }

  async saveKey(raw: string): Promise<GlmSetupState> {
    const key = sanitizeGlmKey(raw);
    if (key === undefined) return this.publish({ status: 'invalid-key', detail: 'rejected-by-provider' });
    this.publish({ status: 'saving' });
    const outcome = saveGlmKey(key);
    if (outcome !== 'saved') {
      recordAgentSetupStep('glm', 'key_saved', { outcome: 'failed' });
      return this.publish({ status: 'error', detail: 'keychain-unavailable' });
    }
    this.checking = undefined;
    return this.check(key);
  }

  clearKey(): GlmSetupState {
    clearGlmKey();
    this.checking = undefined;
    return this.publish({ status: 'no-key' });
  }
}

let host: GlmHost | undefined;

export function glmSetupState(): GlmSetupState {
  return host?.current() ?? IDLE_GLM_SETUP_STATE;
}

/** The chat's unauthenticated path re-checks before it declares the key gone. */
export function recheckGlmAfterUnauthenticated(): void {
  void host?.status({ fresh: true });
}

export function registerGlmHost(options: GlmHostOptions = {}): GlmHost {
  host = new GlmHost(options);
  handle(IPC_INVOKE.glmStatus, (_event, req) => host?.status(req) as Promise<GlmSetupState>);
  handle(IPC_INVOKE.glmSaveKey, (_event, req: { key: string } | undefined) => host?.saveKey(req?.key ?? '') ?? Promise.resolve({ status: 'no-key' }));
  handle(IPC_INVOKE.glmClearKey, () => host?.clearKey() ?? { status: 'no-key' });
  return host;
}
