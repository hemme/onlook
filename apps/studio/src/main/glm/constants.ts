import type { ModelChoice } from '@studio/events';

/** Z.ai's Anthropic-compatible endpoint; the CLI's own auth stays untouched because the key rides `ANTHROPIC_AUTH_TOKEN`. */
export const GLM_BASE_URL = 'https://api.z.ai/api/anthropic';

/** A different endpoint (e.g. the mainland `open.bigmodel.cn` one) without a rebuild. */
export const GLM_BASE_URL_SWITCH = 'STUDIO_GLM_BASE_URL';

/** Z.ai's flagship is `glm-5.3`; "Max" is its `reasoning_effort` value, not a model code (docs.z.ai). */
export const GLM_DEFAULT_MODEL = 'glm-5.3';

/** The static catalog: Z.ai's Anthropic-compatible route has no model list to discover, so the ids ship with the app. */
export const GLM_MODELS: readonly ModelChoice[] = [
  {
    value: 'glm-5.3',
    displayName: 'GLM-5.3',
    description: 'The most capable GLM model for complex coding',
    supportsEffort: false,
  },
  {
    value: 'glm-5.3[1m]',
    displayName: 'GLM-5.3 (1M context)',
    description: 'GLM-5.3 with the 1M-token context window',
    supportsEffort: false,
  },
  {
    value: 'glm-5.3-flash',
    displayName: 'GLM-5.3 Flash',
    description: 'Fast GLM model for everyday coding',
    supportsEffort: false,
  },
];
