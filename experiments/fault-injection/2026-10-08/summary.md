# Fault-injection results (RQ2, no LLM)

- Date: 2026-10-08; seed 20261008; max 15 mutants per operator (split over both specs)
- Tool commit: c9c67f7081a2261749fe4735d6ca050a320e1e45
- `git diff --stat exp-freeze-v1.1 -- packages/parser/src`: packages/parser/src/fsf/l2Check.ts | 13 +++++++++----
 1 file changed, 9 insertions(+), 4 deletions(-) (L2 stats collector / leaf flag only; no diagnostic change)
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
| C | 64 | 18 | 27 | 19 | 0 | 0 | 0 | 0 | 0 |

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
| C2 | 16 | 1 | 0 | 15 | 0 | 0 | 0 | 0 | 0 |
| C3 | 16 | 0 | 12 | 4 | 0 | 0 | 0 | 0 | 0 |
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
| C2 derived | 13 | 0 | 0 | 13 | 0 | 0 | 0 | 0 | 0 |
| C2 original | 3 | 1 | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| C3 derived | 12 | 0 | 12 | 0 | 0 | 0 | 0 | 0 | 0 |
| C3 original | 4 | 0 | 0 | 4 | 0 | 0 | 0 | 0 | 0 |
| C4 derived | 13 | 0 | 13 | 0 | 0 | 0 | 0 | 0 | 0 |
| C4 original | 3 | 1 | 2 | 0 | 0 | 0 | 0 | 0 | 0 |

## By layer that caught class C
- C1: {"parser":0,"L1":16,"L2":0}
- C2: {"parser":0,"L1":1,"L2":0}
- C3: {"parser":0,"L1":0,"L2":12}
- C4: {"parser":16,"L1":1,"L2":0}

## Non-detected mutants
- classroom-C2-01 AddCourse_d3 (derived) C2 [D1: 3 output/wr refs (courses,timetable,ok) -> input 'op']: missed; parser=ASFL_FSF_003(w) L1=- L2=-
- classroom-C2-02 AddCourse_d2 (derived) C2 [D1: 3 output/wr refs (courses,timetable,ok) -> input 'op']: missed; parser=ASFL_FSF_003(w) L1=- L2=-
- classroom-C2-03 RecordScore_dc (derived) C2 [D1: 2 output/wr refs (scores,ok) -> input 'op']: missed; parser=- L1=- L2=ASFL_FSF_209(w)
- classroom-C2-04 AddClass_dg (derived) C2 [D1: 2 output/wr refs (classes,ok) -> input 'op']: missed; parser=- L1=- L2=ASFL_FSF_209(w)
- classroom-C2-05 UpdateStudent_d3 (derived) C2 [D1: 2 output/wr refs (students,ok) -> input 'op']: missed; parser=ASFL_FSF_003(w) L1=- L2=-
- classroom-C2-07 AssignHomework (original) C2 [D1: 2 output/wr refs (assignments,ok) -> input 'op']: missed; parser=- L1=- L2=ASFL_FSF_209(w)
- classroom-C2-08 DeleteStudent_d2 (derived) C2 [D1: 2 output/wr refs (students,ok) -> input 'op']: missed; parser=ASFL_FSF_003(w) L1=- L2=-
- classroom-C3-01 GradeHomework_dc (derived) C3 [T1 line 806: 'aid' -> '~aid']: detected-by-other-layer; parser=- L1=- L2=ASFL_FSF_209(w) ASFL_FSF_201
- classroom-C3-02 AddStudent (original) C3 [T1 line 200: 'op' -> '~op']: missed; parser=- L1=- L2=ASFL_FSF_209(w)
- classroom-C3-03 AddCourse_dg (derived) C3 [T1 line 445: 'cid' -> '~cid']: detected-by-other-layer; parser=- L1=- L2=ASFL_FSF_209(w) ASFL_FSF_201
- classroom-C3-04 UpdateStudent_dc (derived) C3 [T1 line 278: 'sid' -> '~sid']: detected-by-other-layer; parser=- L1=- L2=ASFL_FSF_209(w) ASFL_FSF_201
- classroom-C3-05 AddTeacher (original) C3 [T1 line 148: 'u' -> '~u']: missed; parser=- L1=- L2=ASFL_FSF_209(w)
- classroom-C3-06 CheckAccess_dg (derived) C3 [T1 line 182: 'c' -> '~c']: detected-by-other-layer; parser=- L1=- L2=ASFL_FSF_209(w) ASFL_FSF_201
- classroom-C3-07 SubmitHomework_dg (derived) C3 [T1 line 741: 'aid' -> '~aid']: detected-by-other-layer; parser=- L1=- L2=ASFL_FSF_209(w) ASFL_FSF_201
- classroom-C3-08 CourseStatistics_d3 (derived) C3 [T1 line 619: 'c' -> '~c']: detected-by-other-layer; parser=ASFL_FSF_003(w) L1=- L2=ASFL_FSF_201 ASFL_FSF_201 ASFL_FSF_202
- classroom-C4-02 SubmitHomework_dg (derived) C4 [D1 line 741: 'assignments' -> 'undeclared_assignments']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- classroom-C4-03 CourseStatistics_dc (derived) C4 [D1 line 649: 'has' -> 'undeclared_has']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- classroom-C4-04 RecordScore_d2 (derived) C4 [D1 line 558: 'scores' -> 'undeclared_scores']: detected-by-other-layer; parser=ASFL_SCOPE_001 ASFL_FSF_003(w) L1=- L2=-
- classroom-C4-05 AddClass_dc (derived) C4 [D1 line 404: 'classes' -> 'undeclared_classes']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- classroom-C4-06 RecordScore_dg (derived) C4 [D1 line 574: 'scores' -> 'undeclared_scores']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- classroom-C4-07 GradeHomework_dg (derived) C4 [D1 line 795: 'assignments' -> 'undeclared_assignments']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- classroom-C4-08 QueryStudent_d3 (derived) C4 [D1 line 343: 'found' -> 'undeclared_found']: detected-by-other-layer; parser=ASFL_SCOPE_001 ASFL_FSF_003(w) L1=- L2=-
- delivery-B1-09 CancelOrder (original) B1 [remove others branch]: L2 unknown/unsupported; parser=ASFL_FSF_003(w) L1=- L2=-
- delivery-C2-09 PlaceOrder_d3 (derived) C2 [D1: 2 output/wr refs (orders,ok) -> input 'cid']: missed; parser=ASFL_FSF_003(w) L1=- L2=-
- delivery-C2-10 GrabOrder_dg (derived) C2 [D1: 4 output/wr refs (deliveries,riders,orders,ok) -> input 'rid']: missed; parser=- L1=- L2=ASFL_FSF_209(w)
- delivery-C2-11 MarkReady_d3 (derived) C2 [D1: 2 output/wr refs (orders,ok) -> input 'mid']: missed; parser=ASFL_FSF_003(w) L1=- L2=-
- delivery-C2-12 ConfirmReceipt_d2 (derived) C2 [D1: 2 output/wr refs (orders,ok) -> input 'cid']: missed; parser=ASFL_FSF_003(w) L1=- L2=-
- delivery-C2-13 AutoComplete (original) C2 [D1: 2 output/wr refs (done,orders) -> input 'now']: missed; parser=ASFL_FSF_003(w) L1=- L2=-
- delivery-C2-14 AcceptOrder_d3 (derived) C2 [D1: 2 output/wr refs (orders,ok) -> input 'mid']: missed; parser=ASFL_FSF_003(w) L1=- L2=-
- delivery-C2-15 MarkReady_d2 (derived) C2 [D1: 2 output/wr refs (orders,ok) -> input 'mid']: missed; parser=ASFL_FSF_003(w) L1=- L2=-
- delivery-C2-16 ConfirmReceipt_dg (derived) C2 [D1: 2 output/wr refs (orders,ok) -> input 'cid']: missed; parser=- L1=- L2=ASFL_FSF_209(w)
- delivery-C3-09 PlaceOrder_d2 (derived) C3 [T1 line 131: 'cid' -> '~cid']: detected-by-other-layer; parser=ASFL_FSF_003(w) L1=- L2=ASFL_FSF_201 ASFL_FSF_202
- delivery-C3-10 AutoComplete_d2 (derived) C3 [T1 line 289: 'now' -> '~now']: detected-by-other-layer; parser=ASFL_FSF_003(w) L1=- L2=ASFL_FSF_201 ASFL_FSF_202
- delivery-C3-11 MarkReady_d3 (derived) C3 [T1 line 455: 'mid' -> '~mid']: detected-by-other-layer; parser=ASFL_FSF_003(w) L1=- L2=ASFL_FSF_201 ASFL_FSF_201 ASFL_FSF_202
- delivery-C3-12 AcceptOrder (original) C3 [T1 line 346: 'oid' -> '~oid']: missed; parser=- L1=- L2=ASFL_FSF_209(w)
- delivery-C3-13 PayOrder (original) C3 [T1 line 171: 'oid' -> '~oid']: missed; parser=- L1=- L2=ASFL_FSF_209(w)
- delivery-C3-14 GrabOrder_d2 (derived) C3 [T1 line 495: 'rid' -> '~rid']: detected-by-other-layer; parser=ASFL_FSF_003(w) L1=- L2=ASFL_FSF_201 ASFL_FSF_202
- delivery-C3-15 AcceptOrder_d3 (derived) C3 [T1 line 361: 'mid' -> '~mid']: detected-by-other-layer; parser=ASFL_FSF_003(w) L1=- L2=ASFL_FSF_201 ASFL_FSF_201 ASFL_FSF_202
- delivery-C3-16 ConfirmDelivered_d3 (derived) C3 [T1 line 563: 'rid' -> '~rid']: detected-by-other-layer; parser=ASFL_FSF_003(w) L1=- L2=ASFL_FSF_201 ASFL_FSF_201 ASFL_FSF_202
- delivery-C4-09 RejectOrder_d3 (derived) C4 [D1 line 407: 'orders' -> 'undeclared_orders']: detected-by-other-layer; parser=ASFL_SCOPE_001 ASFL_FSF_003(w) L1=- L2=-
- delivery-C4-10 GrabOrder_dc (derived) C4 [D1 line 529: 'deliveries' -> 'undeclared_deliveries']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- delivery-C4-11 ConfirmDelivered (original) C4 [D1 line 543: 'deliveries' -> 'undeclared_deliveries']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- delivery-C4-12 ConfirmDelivered_dc (derived) C4 [D1 line 587: 'deliveries' -> 'undeclared_deliveries']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- delivery-C4-13 PlaceOrder_dc (derived) C4 [D1 line 159: 'orders' -> 'undeclared_orders']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- delivery-C4-14 GrabOrder_dg (derived) C4 [D1 line 517: 'deliveries' -> 'undeclared_deliveries']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)
- delivery-C4-15 ConfirmReceipt_d2 (derived) C4 [D1 line 247: 'orders' -> 'undeclared_orders']: detected-by-other-layer; parser=ASFL_SCOPE_001 ASFL_FSF_003(w) L1=- L2=-
- delivery-C4-16 GrabOrder (original) C4 [D1 line 485: 'deliveries' -> 'undeclared_deliveries']: detected-by-other-layer; parser=ASFL_SCOPE_001 L1=- L2=ASFL_FSF_209(w)

## Findings and interpretation (written after the run; tool unchanged during the run)

Run at commit c9c67f7 (= 35fe4d8 rebased onto origin/main bd8ea6c; parser `src` identical — the only diff vs exp-freeze-v1.1 is the L2 stats collector / leaf flag, which does not change diagnostics). A first run at 35fe4d8 produced a byte-identical results.csv.

Class A / B substrate. Original bottom processes give almost no A/B material: 16+9 bottom processes, of which only QueryAttendance (3 enum scenarios, no others) and CancelOrder (2 scenarios + others, composite types → L2 unsupported) have ≥2 scenarios. So A/B mutants are almost all on *derived* processes (split on a numeric input boundary K=10/K2=20; T only mentions that input, so L2 encodes it fully). Detection on derived processes therefore shows that L2 decides integer-interval guards correctly; it does not show coverage of the real specs' guards, which are mostly map/composite/function predicates that L2 cannot encode (see l2-coverage.mjs).
Only 1 original A/B mutant was sampled (CancelOrder B1 → L2 unsupported, composed type). Ground truth for derived mutants is brute-force enumeration (independent of Z3); 7 B1 mutants on `_dc` (others redundant) are equivalent and were not flagged (correct).

F1 (tool bug, L1 102 false negative → C2: 15/16 missed). L1 accepted a defining condition as "constraining an output" if it mentioned `~v` for any ext var `v` (l1Check.ts: `extAll.has(r.name) && r.old`). C2 mutants keep `~orders`/`~assignments` on the right-hand side, so D no longer constrains any output yet passes. The initial value is not an output; the rule is wrong. Fixed after the run (separate commit).

F2 (tool gap, C3: 0/16 by L1). L1 has no rule for `~` on a non-ext variable (input/output). 12/16 C3 mutants (all on derived processes) were caught by L2 only incidentally: `~x` is encoded as a fresh unconstrained variable, so the split guards overlap / leave gaps (201/202). On original processes (guards not L2-encodable) all 4 were missed. Added L1 ASFL_FSF_105 after the run (separate commit).

F3 (type checker leniency, not fixed). C1 replaced a nat input by the bool output `ok` (no same-type output exists in any bottom process: all outputs are bool/sets/records, inputs are ids), and C2 introduced `mid = true` (nat = bool); the type checker reported neither (no ASFL_TYPE error). L1 caught all C1 mutants anyway (101). Type-compatibility checks of comparison/equality operands are a separate improvement; out of scope for the frozen L1/L2.

C4 (undeclared variable): 16/16 caught, 15 by the scope resolver (ASFL_SCOPE_001, "detected-by-other-layer" per the rules' L1 expectation) and 1 additionally by L1 102 (renamed output was the only output reference). This is the expected layer for undeclared names in practice.

False positives: 0 mutants with new errors at other processes; negative controls 0/120 processes with errors (both specs plus all 92 derived processes).

Post-fix rerun: see ../2026-10-08-postfix/summary.md.
