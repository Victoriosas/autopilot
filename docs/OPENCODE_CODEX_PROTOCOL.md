# OpenCode → Codex Governor Protocol

## Purpose

OpenCode is the implementation worker. Codex is the independent governor. Neither agent receives unrestricted production authority.

## Branch contract

OpenCode MUST:

1. Read the assigned task and acceptance criteria.
2. Work only on `agent/<task-id>-<slug>` branches.
3. Never push directly to `main`.
4. Never add or rotate secrets.
5. Run the repository typecheck and build before requesting review.
6. Open a pull request that explains scope, tests, risks, and rollback.

## Codex review contract

Codex evaluates every development PR against:

- correctness and acceptance criteria;
- architecture and unwanted coupling;
- authentication/authorization boundaries;
- secret handling;
- external side effects;
- payment, purchasing, refund, deployment, and database risks;
- tests/typecheck/build status;
- migrations and rollback safety;
- fabricated or unverified commercial data.

Codex returns one of:

- `APPROVE`: safe to proceed to the next policy gate;
- `REQUEST_CHANGES`: remediable issues must be fixed before approval;
- `REJECT`: approach violates a non-negotiable policy or is unsafe.

Codex approval does NOT itself authorize high-impact production actions. `merge_main`, `deploy_production`, `modify_secrets`, refunds, and purchases outside configured limits remain subject to the Policy Engine and, where defined, explicit human approval.

## Required PR metadata

Every OpenCode PR should include:

```text
Task ID:
Goal:
Files changed:
Behavior changed:
Tests/typecheck/build:
External side effects:
Database migration:
Secrets touched: NO
Rollback plan:
Known risks:
```

## Evidence rules

Commercial or supplier facts must carry provenance. Data should be represented as one of:

- `VERIFIED`: obtained from an authoritative API or persisted trusted source;
- `OBSERVED`: read directly from a source but not independently verified;
- `INFERRED`: AI/model inference;
- `GENERATED`: synthetic content created by an agent;
- `UNKNOWN`: unavailable.

`INFERRED` or `GENERATED` values may not silently become authoritative price, stock, supplier reliability, payment, tracking, or compliance facts.

## Merge policy

A PR is merge-eligible only when:

1. CI passes.
2. Codex Governor returns APPROVE.
3. No unresolved high/critical findings remain.
4. Human approval is present for any action classified by policy as human-gated.

This protocol is intentionally conservative while Autopilot v4 is in alpha.
