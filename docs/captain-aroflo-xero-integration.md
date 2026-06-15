# AroFlo → Captain → Xero: quotes, won/loss & projects

How Pulse Plumbing's quote data moves from **AroFlo** (where quotes are
authored) into **Captain** (pipeline / forecast / won-loss) and, when a quote
is **won**, into **Xero** as a quote and/or project.

> **Status:** Phase 1 (AroFlo → Captain export) is implemented in this repo.
> Captain's ingest interface and the Xero write-path are specified here but
> not yet built — Captain is being developed in a separate session, so the
> exact ingest format (file upload / REST / DB) is still **TBD**.

---

## 1. The constraint that drives the design

The **native AroFlo ↔ Xero integration does _not_ sync quotes.** It only
pushes: client/supplier **contacts, invoices, supplier invoices, purchase
orders, payments, credit notes, and timesheets** (with tracking-centre data).
Source: <https://aroflo.com/integrations/xero-integration>.

Consequences:

- Quote data (incl. line-item **cost / sell / description**) can only leave
  AroFlo via its **REST API** (<https://apidocs.aroflo.com>) or a manual
  list/report export.
- A quote only reaches Xero **as an invoice**, and only **after** it's won and
  converted to a job/invoice in AroFlo.
- To get a real **Xero _quote_** (or **Xero Project**), something other than
  the native integration must call the **Xero API**. That something is
  **Captain**.

---

## 2. Target architecture

```
┌──────────┐   API export   ┌──────────┐   on WON    ┌──────────────────┐
│  AroFlo  │ ─────────────► │ Captain  │ ──────────► │ Xero API          │
│ (quotes) │   (Phase 1)    │ pipeline │  (Phase 3)  │  • POST /Quotes   │
│          │                │ forecast │             │  • Projects API   │
└────┬─────┘                │ won/loss │             └──────────────────┘
     │                      └──────────┘
     │  job completed → invoice (native AroFlo→Xero integration, unchanged)
     └──────────────────────────────────────────────► Xero (invoice)
```

**Authority rules (avoid duplicates in Xero):**

| Object | System of record | Reaches Xero via |
|---|---|---|
| Quote | AroFlo (authoring) → Captain (pipeline) | Captain → Xero Quotes API |
| Won/loss & forecast | **Captain** | — (Captain is the analytics hub) |
| Project | Captain → Xero Projects (on won) | Captain → Xero Projects API |
| **Invoice** | **AroFlo** | **native** AroFlo→Xero integration |

Keeping invoices on the existing AroFlo→Xero path means Captain never writes
invoices to Xero, so there's no double-invoicing.

---

## 3. Phase 1 — AroFlo → Captain export (implemented)

### Code

- `src/lib/aroflo.ts`
  - `fetchAllQuotes({ where, pageLimit })` — paged pull of quote headers.
  - `fetchQuoteLineItems(quoteId)` — line items for one quote.
  - `exportAllQuotes({ where, includeLineItems, concurrency })` — orchestrates
    the full pull and returns normalised `QuoteRecord[]`.
- `scripts/export-quotes.ts` — CLI that writes Captain-ready artefacts to
  `./exports` (git-ignored — contains client PII):
  - `quotes-<ts>.json` — full nested records.
  - `quote-headers-<ts>.csv` — one row per quote (pipeline / won-loss).
  - `quote-line-items-<ts>.csv` — one row per line (cost / sell / description).

### Run it

```bash
# 1. credentials (see .env.example)
cp .env.example .env.local   # fill AROFLO_USERNAME / PASSWORD / SECRET_KEY

# 2. full historical export
npm run export:quotes

# variants
npm run export:quotes -- --since=2024-01-01    # only quotes modified since
npm run export:quotes -- --no-line-items       # headers only (much faster)
```

### Normalised `QuoteRecord` → Captain field map

| Captain field | QuoteRecord | AroFlo source |
|---|---|---|
| Opportunity ID | `quoteNumber` / `quoteId` | `quotenumber` / `quoteid` |
| Account | `clientName` / `clientId` | `clientname` / `clientid` |
| Stage / outcome | `outcome` (`won`/`lost`/`open`/`other`) | derived from `status` |
| Raw status | `status` | `status` |
| Forecast value | `totalSell` | quote total |
| Cost | `totalCost` | quote cost |
| Margin % | `marginPct` | derived |
| Line description | `lineItems[].description` | line `description` |
| Line cost / sell | `lineItems[].unitCost` / `unitSell` | line `cost` / `sell` |
| Open/close dates | `dateCreated` / `dateModified` | `datecreated` / `datemodified` |

`outcome` normalisation (`toOutcome`): `won` ← won/accepted/approved;
`lost` ← lost/declined/rejected/unsuccessful; `other` ← expired/cancelled;
`open` ← pending/draft/sent/new.

> ⚠️ **Field-name caveat.** AroFlo's JSON keys for quote line items vary by
> zone/version. The readers in `aroflo.ts` try several spellings via the
> central `FIELD` map. **Before the first production run, confirm the keys
> against the Postman collection at <https://apidocs.aroflo.com>** and adjust
> `FIELD` if the export comes back empty or with zero costs.

---

## 4. Phase 2 — wire the export to Captain (TBD)

Captain's ingest mechanism decides the last mile. Three options, all already
supported by the Phase-1 output:

1. **File upload** — hand Captain `quote-headers.csv` + `quote-line-items.csv`
   (joined on `quoteNumber`). Zero extra code.
2. **REST / webhook** — add a `pushToCaptain(records)` that POSTs the JSON to
   Captain's endpoint. Needs Captain's URL + auth.
3. **Database** — write `QuoteRecord[]` into Captain's tables. A **Supabase**
   MCP is available in the workspace if Captain is Supabase-backed.

Recommended once Captain exists: a small scheduled job calling
`exportAllQuotes({ where: "datemodified>'<lastSync>'" })` for **incremental**
sync, plus the one-off full backfill from Phase 1.

---

## 5. Phase 3 — won quotes → Xero quote / project (TBD)

When Captain marks a quote **won**:

1. **Create a Xero quote** — `POST /Quotes` (Xero Accounting API) with
   `Status: ACCEPTED`, mapping each `lineItem` to a Xero `LineItem`
   (`Description`, `Quantity`, `UnitAmount` = `unitSell`, `AccountCode`,
   `TaxType`). Cost isn't stored on a Xero quote line — keep cost/margin in
   Captain for reporting.
2. **Optionally create a Xero Project** — Projects API, so time/expenses can
   be tracked against the won work. From an accepted quote Xero can later
   generate the project invoice. See
   <https://central.xero.com/s/article/Create-an-invoice-from-an-accepted-quote-in-Projects>.
3. **Leave invoicing to AroFlo** — when the job completes, the existing
   AroFlo→Xero integration pushes the invoice. Match it back to the
   project/quote in Xero by quote number reference.

Auth note: the Xero **MCP** currently connected to the workspace is
financial-reporting scoped (P&L, cash, receivables) — **read-only**. Writing
quotes/projects needs a Xero **OAuth2 app** with `accounting.transactions` +
`projects` scopes, driven from Captain.

### Won/loss & forecast in Captain

- **Win rate** = `won / (won + lost)` by period / client / service type.
- **Forecast** = Σ `totalSell` of `open` quotes, optionally probability-weighted
  by historical win rate per stage.
- **Margin at risk** = Σ `(totalSell − totalCost)` of `open` quotes.

All three are computable directly from the exported `QuoteRecord` fields.

---

## 6. Open questions

- [ ] Captain ingest format: file / REST / DB? (drives Phase 2)
- [ ] Confirm AroFlo quote line-item JSON keys vs the `FIELD` map.
- [ ] Xero: create **quote**, **project**, or both on won?
- [ ] Sync cadence (nightly incremental vs real-time on status change).
- [ ] How to reference AroFlo quote number on the Xero invoice for matching.
