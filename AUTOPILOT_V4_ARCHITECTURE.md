# Victoriosa Autopilot Core v4

## Mission
Turn Autopilot into a governed agent control plane. Agents may plan and execute low-risk work, while deterministic policies and Codex review protect production, money, secrets, and `main`.

## Core components

- `src/autopilot/modelRouter.ts`: task-aware provider/model selection. Groq is preferred for fast workloads; OpenRouter supplies flexible fallback and reranking; Cerebras is available for deeper analysis; Codex is the code-review governor.
- `src/autopilot/policyEngine.ts`: deny-by-default authorization for autonomous actions.
- `src/autopilot/orchestrator.ts`: task lifecycle and audit trail.
- `src/autopilot/codexGovernor.ts`: deterministic merge gate consuming Codex/CI evidence.

## Development workflow

1. A goal becomes an orchestrator task.
2. OpenCode works only on `agent/*`, `opencode/*`, or another non-main feature branch.
3. CI executes typecheck, build, tests, and security checks.
4. Codex reviews the diff and produces findings.
5. `codexGovernor` applies hard policy to the evidence.
6. A clean low-risk change may be approved; secrets, payments, production deployment, or policy-sensitive actions require a human gate.
7. Every decision is recorded in the audit trail.

## Model routing strategy

- Classification / extraction: Groq first.
- Structured product analysis: Groq, then Cerebras.
- Deep reasoning: Cerebras, then OpenRouter.
- Reranking: OpenRouter reranker configured through `OPENROUTER_RERANK_MODEL`.
- Code review: Codex governor.

Model IDs are environment-configurable. Do not hard-code pricing assumptions or treat a currently free model as permanently free.

## Trust model for business data

All future product/supplier facts should carry provenance:

- `VERIFIED`: returned by an authoritative API or operator.
- `OBSERVED`: directly extracted from a source but not independently verified.
- `INFERRED`: model-derived estimate.
- `GENERATED`: synthetic copy or creative content.
- `UNKNOWN`: unavailable.

AI estimates must never silently become authoritative supplier, inventory, pricing, shipping, warranty, rating, or compliance facts.

## Non-negotiable controls

- No autonomous secret modification.
- No agent writes directly to `main`.
- Production deployment is governed.
- Payment/refund changes require human approval.
- Autonomous purchasing is disabled by default (`AUTOPILOT_PURCHASE_LIMIT_USD=0`).
- High/critical-risk catalog decisions are never auto-published.

## Next implementation slice

1. Wire model-router status into `/api/health`.
2. Replace generic AI calls with task-aware routing.
3. Add persistent task/audit storage in Supabase.
4. Add reranker adapter after confirming the provider's current API contract.
5. Add GitHub Actions CI and Codex PR review workflow.
6. Split `server.ts` into route modules without changing behavior.
