import { createHash } from 'node:crypto';
import { AGENT_MODEL, AGENT_PROMPT_VERSIONS, COMPRENSION_PROMPT, REDACTOR_PROMPT, GUARDIAN_PROMPT } from './consultationAgentPrompts';
import { consultationAgentSchemas } from './consultationAgentSchemas';

// Existing identities, verified read-only on 2026-11-06. Prompt versions and
// provider revision counters are separate. No runtime, credentials or apply path.
const roles = [
  { role: 'comprension', key: 'victoriosas-comprension-v1', definitionId: 'def_8835b6965628102b5c96', systemPrompt: COMPRENSION_PROMPT, schema: consultationAgentSchemas.understanding },
  { role: 'redactor', key: 'victoriosas-redactor-v1', definitionId: 'def_4ff4069cf7cf2092974c', systemPrompt: REDACTOR_PROMPT, schema: consultationAgentSchemas.draft },
  { role: 'guardian', key: 'victoriosas-guardian-v1', definitionId: 'def_a88e4d58d9d9cb94ba02', systemPrompt: GUARDIAN_PROMPT, schema: consultationAgentSchemas.guardian },
] as const;

export function buildConsultationAgentManifest() {
  return {
    version: 'offline-review-1', source: 'src/storefront/consultationAgentPrompts.ts',
    decision: 'no_send', remoteApplyAuthorized: false,
    definitions: roles.map(({ role, key, definitionId, systemPrompt, schema }) => ({
      role, key, definitionId, model: AGENT_MODEL, promptVersion: AGENT_PROMPT_VERSIONS[role],
      promptSha256: createHash('sha256').update(systemPrompt, 'utf8').digest('hex'),
      systemPrompt, output: { schema }, builtins: [], mcpServers: [],
    })),
  };
}

// Accept only a local, minimized snapshot of definitions. Never print prompts or
// provider messages: the report contains only fixed identities and comparisons.
export function compareConsultationDefinitions(snapshot: unknown) {
  if (!Array.isArray(snapshot)) throw Error('DEFINITION_SNAPSHOT_INVALID');
  return buildConsultationAgentManifest().definitions.map(expected => {
    const matches = snapshot.filter(v => v && typeof v === 'object' && v.id === expected.definitionId);
    const actual = matches.length === 1 ? matches[0] : undefined;
    return {
      role: expected.role, definitionId: expected.definitionId,
      matches: !!actual && actual.model === expected.model && actual.systemPrompt === expected.systemPrompt &&
        Array.isArray(actual.builtins) && actual.builtins.length === 0 &&
        Array.isArray(actual.mcpServers) && actual.mcpServers.length === 0,
    };
  });
}
