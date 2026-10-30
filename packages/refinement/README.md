# @agile-sofl/refinement

The **requirement-level typed refinement structure** — the research core of the effort-aware
refinement work (P2 design in `research/effort-aware-refinement/research/conceptual-model.md`,
implemented tests-first in P3).

Headless, pure, deterministic. No Electron, no I/O, no LLM. The Studio agent layer (P4) exposes thin
tools over this core; the experiment harness (P5) consumes the selector + readiness.

## What it is

A typed refinement layer **above** the existing Agile-SOFL process tree: a primary `refines` tree
(AND/OR/optional/`n_of_m`) plus typed cross-links (`depends_on`, `constrains`, `conflicts_with`,
`satisfies`, `traces_to`). Its center of gravity is **first-class, explainable refinement
obligations**, each naming its detector class:

- `mechanical` — a deterministic checker opens and auto-discharges it (no LLM, no decision).
- `llm_candidate` — an LLM may only *raise* it; it discharges via a decision (confirm/dismiss).
- `user_decision` — cannot be auto-discharged; requires a real (or explicitly simulated) actor.

Also: a node lifecycle state machine, a cost-aware clarification selector (a hypothesis under test,
RQ3), a readiness policy (the explicit stop mechanism), decision provenance + propagation, an
append-only replayable event log, and schema-versioned serialization with additive, crash-safe
migration.

## The anti-fabrication invariant (structural, not conventional)

An LLM guess can **never** become `user_confirmed`. Provenance is enforced in exactly one place
(`provenance.ts`), and every record path (`DecisionStore.record`, `ObligationEngine.discharge`)
funnels through it, so there is no code path from a simulated actor (or a guess) to a confirmed
decision or an auto-closed decision-gated obligation. A *simulated* stakeholder answer is
`simulated_user_answer` — an interaction *proxy*, reported as such (task book §7.3).

## Layout

| Module | Responsibility |
|---|---|
| `types.ts` | Domain entities + enums (pure data) |
| `id.ts` | Stable, injectable IDs (random / deterministic) |
| `graph.ts` | `RequirementGraph` + invariants (no cycles, no dangling, unique ids, one refines parent) |
| `lifecycle.ts` | Node state machine (draft/needs_clarification/ready/deferred/blocked/invalidated) |
| `provenance.ts` | Anti-fabrication enforcement (single choke point) |
| `obligations.ts` | Obligation engine + deterministic mechanical detectors |
| `decisions.ts` | Decision store + withdrawal propagation (never silently re-approves) |
| `selector.ts` | Cost-aware clarification selection + minimum-risk gate |
| `readiness.ts` | Readiness assessment (budget exhaustion ≠ READY) |
| `serialize.ts` | Versioned document, additive migration, crash recovery |
| `events.ts` | Append-only replayable event log |

## Build & test

```bash
npm run build --workspace @agile-sofl/refinement
npm run test  --workspace @agile-sofl/refinement
```
