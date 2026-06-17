# Earthwise — AroFlo quote extraction runbook

**Goal:** extract all Earthwise quotes (with line-item cost / sell / description)
from AroFlo **now**, park the files, and import them into Captain v2's Job
module **later** (once that module is finalised). Then verify Captain, then
switch AroFlo off.

> Scope: the **full decommission dataset** — clients, jobs/tasks, quotes,
> invoices, timesheets, inventory and attachments. A quotes-only run is also
> available for a quick first canary.

Two extractors are built and tested (both write to `./exports`, git-ignored):

| Command | Covers | Output |
|---|---|---|
| `npm run export:quotes` | quotes + line items only | JSON + 2 CSVs |
| `npm run export:aroflo` | **everything** (clients, jobs, quotes, invoices, timesheets, inventory, attachments) | per-entity JSON + CSV + `manifest.json` |

The Captain importer is **not** built yet — it's written later against
`EWG-Captain/modules/job` once that's finalised, reading these files.

### Full extractor — `npm run export:aroflo`

```bash
npm run export:aroflo                              # all entities, all history
npm run export:aroflo -- --since=2023-07-01        # only modified since date
npm run export:aroflo -- --entities=clients,jobs,quotes,invoices
npm run export:aroflo -- --download-attachments    # also pull file binaries
```

Output lands in `exports/aroflo-<timestamp>/` with one `.json` + `.csv` per
entity, plus `manifest.json` (counts + dollar totals for reconciliation).

---

## What you need

**Earthwise's AroFlo API credentials** (Earthwise is a different AroFlo org to
Pulse, so these are Earthwise-specific). AroFlo's API uses **HMAC-SHA512** auth
and the page shows **four** values — copy ALL of them:

- `AROFLO_UENCODED`  (uEncoded — derived from the username)
- `AROFLO_PENCODED`  (pEncoded / API Key)
- `AROFLO_ORGENCODED`  (orgEncoded)
- `AROFLO_SECRET_KEY`  (API Secret Key — shown **once**, copy it before Save)
- `AROFLO_BASE_URL` (default `https://api.aroflo.com`)
- `AROFLO_HOSTIP` (optional; leave blank when running from cloud/serverless)

Get them from AroFlo: **Site Administration → Settings → General → AroFlo API**
(API access must be enabled on the plan; click *Generate Secret Key*, copy all
fields, then *Save*). Do this **while the subscription is live** — API access
ends when AroFlo is cancelled.

> **Auth & API model** (verified against <https://apidocs.aroflo.com>, June 2026
> — the earlier draft of `src/lib/aroflo.ts` was written against a guessed model
> and has been fully rewritten): single endpoint `https://api.aroflo.com/?zone=…`,
> HMAC-SHA512 signature, pipe-delimited filters `and|field|op|value`, responses
> under `zoneresponse.<zone>`. **Every zone defaults to the last 30 days unless
> an explicit `where` is passed** — the extractor passes a broad date override
> so you get full history.

---

## How to run

### Option A — locally (recommended)

```bash
# in the project folder
cp .env.example .env.local        # then fill the AROFLO_* values
npm install
npm run export:quotes             # canary: all quotes + line items
npm run export:aroflo -- --download-attachments   # full decommission dataset
```

### Option B — have me run it

Add the `AROFLO_*` values as **environment secrets** on this remote session
(don't paste secrets into chat), tell me they're set, and I'll run the extract
and hand back the files.

> **Agreed plan:** *I validate, you run local.* Once the secrets are set here I
> run a small canary, fix any field/zone mismatches against real data, commit
> the corrections, then you do the full archived run locally next to Captain v2.
> After your local run, **rotate the AroFlo Secret Key** so the credential that
> touched the cloud is retired.

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
   — adjust the field readers in `src/lib/aroflo.ts` (quotes) and
   `scripts/aroflo-export/entities.ts` (other zones) against the Postman
   collection at <https://apidocs.aroflo.com>, then re-run.

---

## Then

1. Park `exports/` somewhere durable (it's git-ignored on purpose — PII).
2. When Captain v2 `modules/job` is finalised, build the importer there to read
   `quotes-<ts>.json` (give this session access to `tradewisegroup/EWG-Captain`
   and I'll write it).
3. Reconcile in Captain, run in parallel, **then** decommission AroFlo —
   keeping the raw export + quote PDFs as a cold archive.
