# Earthwise — AroFlo quote extraction runbook

**Goal:** extract all Earthwise quotes (with line-item cost / sell / description)
from AroFlo **now**, park the files, and import them into Captain v2's Job
module **later** (once that module is finalised). Then verify Captain, then
switch AroFlo off.

> Scope of this pass: **quotes only** (headers + line items). Jobs, invoices,
> timesheets, materials and attachments are a later pass — see
> `captain-aroflo-xero-integration.md` for the full decommission dataset.

The tooling is already built and tested:
`src/lib/aroflo.ts` (`exportAllQuotes`) + `scripts/export-quotes.ts`
(`npm run export:quotes`). Nothing else needs writing to extract — the
importer comes once Captain is ready.

---

## What you need

**Earthwise's AroFlo API credentials** (Earthwise is a different AroFlo org to
Pulse, so these are Earthwise-specific):

- `AROFLO_USERNAME`
- `AROFLO_PASSWORD`
- `AROFLO_SECRET_KEY`
- `AROFLO_BASE_URL` (default `https://api.aroflo.com`)

Get them from AroFlo: **Site Administration → Integrations → AroFlo API**
(API access must be enabled on the plan). Do this **while the subscription is
live** — API access ends when AroFlo is cancelled.

---

## How to run

### Option A — locally (recommended)

```bash
# in the project folder
cp .env.example .env.local        # then fill the four AROFLO_* values
npm install
npm run export:quotes             # full extract, all quotes + line items
```

### Option B — have me run it

Add the four `AROFLO_*` values as **environment secrets** on this remote
session (don't paste secrets into chat), tell me they're set, and I'll run the
extract and hand back the files.

---

## What you get (in `./exports`, git-ignored — contains client data)

| File | One row per | Use |
|---|---|---|
| `quotes-<ts>.json` | quote (nested line items) | source of truth for the Captain import |
| `quote-headers-<ts>.csv` | quote | pipeline / won-loss / forecast review |
| `quote-line-items-<ts>.csv` | line item (FK `quoteNumber`) | cost / sell / description detail |

The run prints a summary: quote count, line-item count, won/lost/open split,
and total pipeline vs won dollar value — use this as the **first reconciliation
check** against AroFlo's own quote list.

---

## Sanity check before trusting the data

Run it, then confirm against AroFlo's Quotes list:

1. **Quote count** in the summary ≈ AroFlo's quote count (all statuses).
2. **Line items are populated** with non-zero `unitSell` / `unitCost`.
3. If counts/costs look wrong, the AroFlo JSON field names differ for Earthwise
   — adjust the `FIELD` map in `src/lib/aroflo.ts` against the Postman
   collection at <https://apidocs.aroflo.com>, then re-run.

---

## Then

1. Park `exports/` somewhere durable (it's git-ignored on purpose — PII).
2. When Captain v2 `modules/job` is finalised, build the importer there to read
   `quotes-<ts>.json` (give this session access to `tradewisegroup/EWG-Captain`
   and I'll write it).
3. Reconcile in Captain, run in parallel, **then** decommission AroFlo —
   keeping the raw export + quote PDFs as a cold archive.
