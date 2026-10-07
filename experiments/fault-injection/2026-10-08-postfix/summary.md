# Fault-injection results (RQ3, no LLM)

- Date: 2026-10-08; seed 20261008; up to 8 mutants per operator per spec (--max 15 split over 2 specs, rounded up), i.e. 16 per operator
- Tool commit: 468e3016c6257f9ffa5789bd381b211f1b09cd44
- `git diff --stat exp-freeze-v1.1 -- packages/parser/src`: packages/parser/src/diagnostics/codes.ts |  2 ++
 packages/parser/src/fsf/l1Check.ts       | 13 ++++++++++++-
 packages/parser/src/fsf/l2Check.ts       | 13 +++++++++----
 3 files changed, 23 insertions(+), 5 deletions(-) (L2 stats collector / leaf flag only; no diagnostic change)
- Rules: sofl/kb/paper-input/fault-injection-rules.md v0.1
- Specs: classroom-reference.asfl, delivery-reference.asfl
- Derived processes: 92 generated, 92 valid (0 errors, all T encoded) — see derived.csv

## Negative controls (unmutated original + derived leaf processes in the base specs)
120 processes, 0 with errors.

## By class
| group | n | detected | detected-by-other-layer | missed | equivalent | equivalent (but flagged!) | L2 unknown/unsupported | unparseable | FP mutants |
|---|---|---|---|---|---|---|---|---|---|
| A | 48 | 48 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| B | 48 | 40 | 0 | 0 | 7 | 0 | 1 | 0 | 0 |
| C | 64 | 49 | 15 | 0 | 0 | 0 | 0 | 0 | 0 |

## By operator
| group | n | detected | detected-by-other-layer | missed | equivalent | equivalent (but flagged!) | L2 unknown/unsupported | unparseable | FP mutants |
|---|---|---|---|---|---|---|---|---|---|
| A1 | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| A2 | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| A3 | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| B1 | 16 | 8 | 0 | 0 | 7 | 0 | 1 | 0 | 0 |
| B2 | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| B3 | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C1 | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C2 | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C3 | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C4 | 16 | 1 | 15 | 0 | 0 | 0 | 0 | 0 | 0 |

## By operator and original/derived
| group | n | detected | detected-by-other-layer | missed | equivalent | equivalent (but flagged!) | L2 unknown/unsupported | unparseable | FP mutants |
|---|---|---|---|---|---|---|---|---|---|
| A1 derived | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| A2 derived | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| A3 derived | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| B1 derived | 15 | 8 | 0 | 0 | 7 | 0 | 0 | 0 | 0 |
| B1 original | 1 | 0 | 0 | 0 | 0 | 0 | 1 | 0 | 0 |
| B2 derived | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| B3 derived | 16 | 16 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C1 derived | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C1 original | 4 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C2 derived | 13 | 13 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C2 original | 3 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C3 derived | 12 | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C3 original | 4 | 4 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| C4 derived | 13 | 0 | 13 | 0 | 0 | 0 | 0 | 0 | 0 |
| C4 original | 3 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |

## By layer that caught class C
- C1: {"parser":0,"L1":16,"L2":0}
- C2: {"parser":0,"L1":16,"L2":0}
- C3: {"parser":0,"L1":16,"L2":0}
- C4: {"parser":16,"L1":1,"L2":0}

## Non-detected mutants
- classroom-C4-02 SubmitHomework_dg (derived) C4 [D1 line 741: 'assignments' -> 'undeclared_assignments']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- classroom-C4-03 CourseStatistics_dc (derived) C4 [D1 line 649: 'has' -> 'undeclared_has']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- classroom-C4-04 RecordScore_d2 (derived) C4 [D1 line 558: 'scores' -> 'undeclared_scores']: detected-by-other-layer; parser=ASFL_SCOPE_001 ASFL_FSF_003(w) L1=- L2=-
- classroom-C4-05 AddClass_dc (derived) C4 [D1 line 404: 'classes' -> 'undeclared_classes']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- classroom-C4-06 RecordScore_dg (derived) C4 [D1 line 574: 'scores' -> 'undeclared_scores']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- classroom-C4-07 GradeHomework_dg (derived) C4 [D1 line 795: 'assignments' -> 'undeclared_assignments']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- classroom-C4-08 QueryStudent_d3 (derived) C4 [D1 line 343: 'found' -> 'undeclared_found']: detected-by-other-layer; parser=ASFL_SCOPE_001 ASFL_FSF_003(w) L1=- L2=-
- delivery-B1-09 CancelOrder (original) B1 [remove others branch]: L2 unknown/unsupported; parser=ASFL_FSF_003(w) L1=- L2=-
- delivery-C4-09 RejectOrder_d3 (derived) C4 [D1 line 407: 'orders' -> 'undeclared_orders']: detected-by-other-layer; parser=ASFL_SCOPE_001 ASFL_FSF_003(w) L1=- L2=-
- delivery-C4-10 GrabOrder_dc (derived) C4 [D1 line 529: 'deliveries' -> 'undeclared_deliveries']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- delivery-C4-11 ConfirmDelivered (original) C4 [D1 line 543: 'deliveries' -> 'undeclared_deliveries']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- delivery-C4-12 ConfirmDelivered_dc (derived) C4 [D1 line 587: 'deliveries' -> 'undeclared_deliveries']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- delivery-C4-13 PlaceOrder_dc (derived) C4 [D1 line 159: 'orders' -> 'undeclared_orders']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- delivery-C4-14 GrabOrder_dg (derived) C4 [D1 line 517: 'deliveries' -> 'undeclared_deliveries']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- delivery-C4-15 ConfirmReceipt_d2 (derived) C4 [D1 line 247: 'orders' -> 'undeclared_orders']: detected-by-other-layer; parser=ASFL_SCOPE_001 ASFL_FSF_003(w) L1=- L2=-
- delivery-C4-16 GrabOrder (original) C4 [D1 line 485: 'deliveries' -> 'undeclared_deliveries']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)

## Note
Post-fix rerun (commit 468e301: L1 F1 fix + ASFL_FSF_105), same seed and therefore the same mutants as ../2026-10-08/.
This is NOT the frozen-tool result. The fixes were designed after seeing those mutants, so C2/C3 here are not an independent
estimate. A fresh mutant set (new seed or new operators) would be needed for that. Primary RQ3 numbers: ../2026-10-08/summary.md.
