// Provider-enforced output contracts for the isolated synthetic evaluator.
// Semantic guards remain independent: a valid object does not authorize sending.
type Schema = {
  type: string; const?: unknown; enum?: readonly unknown[]; maxLength?: number;
  maxItems?: number; pattern?: string; items?: Schema;
  properties?: Record<string, Schema>; required?: readonly string[]; additionalProperties?: boolean;
};
const text = { type: 'string', maxLength: 4000 };
const boolean = { type: 'boolean' };
const list = (items: Schema) => ({ type: 'array', items, maxItems: 80 });
const texts = list(text);
const object = (properties: Record<string, Schema>) => ({
  type: 'object', properties, required: Object.keys(properties), additionalProperties: false,
});
const enumeration = (...values: string[]) => ({ type: 'string', enum: values });
const status = enumeration('APTO_PARA_REVISION_HUMANA', 'REQUIERE_CORRECCION', 'REQUIERE_VICTORIA', 'BLOQUEADO');
const variant = object({ status, findings: list(object({ code: text, quote: text, fix: text })) });

export const consultationAgentSchemas = {
  understanding: object({
    schema_version: { const: 'comprension-1.0', type: 'string' },
    language: enumeration('es', 'en', 'otro'),
    intents: object({ primary: text, secondary: texts }),
    questions: list(object({ id: {type:'string', pattern:'^q[1-9][0-9]*$'}, text,
      type: enumeration('precio','disponibilidad','resultado','proceso','contraindicacion','ubicacion','contacto','otro'),
      answerable_with_general_info: boolean })),
    services: object({ mentioned: text, candidates: list(object({ name: text, reason: text })), ambiguous: boolean }),
    provided_data: list(object({ field: text, value: text, kind: enumeration('hecho') })),
    missing_info: list(object({ field: text, why_needed: text, minimal_ask: text })),
    ambiguities: texts, contradictions: texts, risks: list(object({ code: text, detail: text })),
    needs_clarification: boolean, requires_victoria: boolean,
    confidence: object({ level: enumeration('alta','media','baja'), observable_reasons: texts }),
  }),
  draft: object({
    schema_version: { type:'string', const:'1.0' }, questions: texts, services_candidates: texts,
    knowledge_gaps: texts, variants: object({personalizada:text, breve:text, orientacion:text}),
    used_evidence: list(object({id:text, version:text})), pending_questions: texts,
    guardian: object({status:{type:'string',const:'REQUIERE_VICTORIA'},reasons:texts}),
    action: {type:'string',const:'BORRADOR_NO_ENVIADO'},
  }),
  guardian: object({
    schema_version: {type:'string',const:'guardian-1.0'}, global_status: status,
    variants: object({personalizada:variant,breve:variant,orientacion:variant}),
    unanswered_questions:texts,evidence_problems:texts,summary_reasons:texts,
  }),
} as const;

// Validate the same bounded JSON-schema subset we send to the provider. A
// provider declaring structured output is not proof that it honored the schema.
export function matchesAgentSchema(value: unknown, schema: Schema): boolean {
  if (Object.hasOwn(schema, 'const') && value !== schema.const) return false;
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === 'string') return typeof value === 'string' &&
    (schema.maxLength === undefined || value.length <= schema.maxLength) &&
    (!schema.pattern || new RegExp(schema.pattern).test(value));
  if (schema.type === 'boolean') return typeof value === 'boolean';
  if (schema.type === 'array') return Array.isArray(value) && !!schema.items &&
    (schema.maxItems === undefined || value.length <= schema.maxItems) &&
    value.every(item => matchesAgentSchema(item, schema.items!));
  if (schema.type !== 'object' || !value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>, properties = schema.properties ?? {};
  return (schema.required ?? []).every(key => Object.hasOwn(record, key)) &&
    Object.keys(record).every(key => Object.hasOwn(properties, key)
      ? matchesAgentSchema(record[key], properties[key]) : schema.additionalProperties !== false);
}
