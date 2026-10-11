# Held-out draft scaffold

`scenarios/` holds draft gold packages for Study A. Each file is marked:

- `set: held-out`
- `status: draft-gold`
- `partition: held-out`
- `devExample: false`
- `confirmatory: false`

These files are a scaffold so the harness can list and load them. They have not been dual-annotated. Agreement has not been measured. They are not a confirmatory freeze, and they are not evidence about DASR.

Do not copy a `dev/scenarios/` file here and treat the copy as frozen. Do not run a confirmatory model batch on this directory. Listing is the check that the scaffold loads:

```bash
node .harness/study-a.mjs --list ../../research-reframing/study-a/held-out
```

From `packages/studio`, after `node scripts/agent-harness/build.mjs`.

## What is in the scaffold

Fifteen draft scenarios, three kinds, fifteen small-app domains. None are the classroom, delivery, or library demos.

| Kind | Count | Files |
| --- | --- | --- |
| underspecified | 9 | bike-share, community garden, museum tickets, pharmacy pickup (two slots), coworking desks, pet boarding, equipment rental, hostel beds, blood donation |
| clear-control | 3 | swimming pool, farmers market, bakery preorder |
| maintenance | 3 | recycling drop-off, sports court, car wash |

The authorized alternative in each draft slot is a provisional oracle key required by the schema. Annotators replace it if adjudication chooses a different answer. See `../annotation-guide.md` and `../freeze-checklist.md`.

A confirmatory package, later, still needs independent labels, an agreement statistic, and a new git tag cut after DASR has merged. The proposed tag name is `study-a-freeze-v0.1`. `exp-freeze-v1.2` is not that tag.
