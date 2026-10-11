# DASR spec delta (Gate 2)

1. Link acceptance is `proposed | accepted | withdrawn`. `rejected` stays a decision status only. A stored link acceptance of `rejected` loads as `withdrawn`. Provenance remains `human | model | system | import` because `DASR-method-spec.md` in `JaredYe04/agile-sofl-paper` was HTTP 404 from this token, so those values were not changed. Stricter fail-closed rule, intentional: an unresolved decision with no active links blocks confirmed writes. The paper method-spec must adopt that clause. This token cannot open a paper PR.

2. The decision gate refuses commitment `override` when automatic mode or auto-approve is on, even with a role and a reason. A human override with role and reason is allowed only when automatic mode is off. Auto mode still skips only the Apply click.

3. `projectTemplate`, `lspSpawn`, and the AgentPanel ledger line stay unverified here. They are not reported as passing.
