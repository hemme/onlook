import type { Env } from '../env/shell-env.js';
import { readEnvSwitch } from '../env/switch.js';
import { userEnv } from '../env/shell-env.js';
import { scrubStudioSession } from '../claude/env.js';
import { stateRoot } from '../state/root.js';
import { readGlmKey } from './credentials.js';
import { GLM_BASE_URL, GLM_BASE_URL_SWITCH } from './constants.js';

function glmBaseUrl(env?: NodeJS.ProcessEnv): string {
  return readEnvSwitch(GLM_BASE_URL_SWITCH, env) ?? GLM_BASE_URL;
}

/**
 * The env a GLM session's Claude CLI child runs with: the login shell's, then the provider overrides on top.
 * A dedicated `CLAUDE_CONFIG_DIR` keeps Z.ai's run out of the user's `~/.claude`, so one provider's state never answers for the other.
 * Awaited rather than sync: a session built before the shell capture settles must not silently run the plain Claude route.
 */
export async function glmChildSdkEnv(processEnv?: NodeJS.ProcessEnv): Promise<Env> {
  const env: Env = scrubStudioSession(await userEnv());
  const { key } = readGlmKey();
  if (key !== undefined) {
    env['ANTHROPIC_AUTH_TOKEN'] = key;
  }
  env['ANTHROPIC_BASE_URL'] = glmBaseUrl(processEnv);
  env['CLAUDE_CONFIG_DIR'] = `${stateRoot()}/glm/claude-config`;
  return env;
}
