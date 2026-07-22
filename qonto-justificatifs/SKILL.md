---
name: qonto-justificatifs
description: Reconcile Qonto transactions with missing receipts (justificatifs) by matching them to invoice/receipt files in a documents source (e.g. Google Drive), attaching them, and reporting what is left. Use when the user wants to find and add missing expense/income justificatifs on Qonto, or reach "0 missing receipts".
argument-hint: [period or "récent au plus ancien"]
---

End-to-end reconciliation of Qonto transactions against justificatifs found on disk (Google Drive). Companion of the `qonto-attach` skill (does the actual upload). Work **most-recent → oldest, methodically**, and give the user a **regular summary** per month.

## Prerequisites

- `qonto-mcp` connected. Load tools once (deferred): `ToolSearch("select:mcp__qonto-mcp__get_organization,mcp__qonto-mcp__list_transactions,mcp__qonto-mcp__get_transaction,mcp__qonto-mcp__list_transaction_attachments,mcp__qonto-mcp__request_attachment_upload,mcp__qonto-mcp__upload_attachment,mcp__qonto-mcp__list_client_invoices")`
- A documents source folder. Ask the user for it if not given.
- A scratchpad dir for working JSON/TSV files.

## Workflow

### 1. Scope the account
`mcp__qonto-mcp__get_organization` → the main `bank_account_id`. Note the account open date — there are no transactions before it (don't chase pre-Qonto files).

### 2. Pull transactions & find the ones missing a receipt
`list_transactions(bank_account_id, sort_by:"emitted_at:desc", per_page:100, page:N)` for every page.
**The output is large** and gets saved to a file — do NOT read it into context. Use `jq` on the file. Combine pages, then filter:
`select((.attachment_ids|length)==0 and .attachment_lost==false)`
Keep `{id, emitted_at, side, amount, currency, operation_type, clean_counterparty_name, label}`. Group counts by month.

### 3. Discover the documents (build a file map)
Expense receipts are usually foldered by month, but **a file is often filed in an adjacent month** — always match by amount+vendor+date, not by folder. Client invoices (income) live under project folders. Also mine non-obvious folders (URSSAF, DSN, mutuelle, JPA/compta, formations) for taxes/social. For the Sakuga layout see the memory `project_sakuga_justificatifs_qonto`.

### 4. Extract file metadata (parallel subagents — read-only)
Spawn one `general-purpose` subagent per folder/month. Each reads every PDF/image with the Read tool (**one file per Read call** — batched reads mis-associate filenames) and returns ONLY a JSON array:
`{file, vendor, doc_date (YYYY-MM-DD), total_ttc (number), currency, type (facture_fournisseur|facture_client|unknown), direction (expense|income), dup_of, notes}`.
This keeps big PDF content out of the main context. Save each array to a metadata file.

### 5. Match files → transactions
- Match by **vendor + amount + date (same month)**. Vendors repeat monthly, so never match on amount alone across months.
- **Foreign currency**: SaaS often invoiced in USD but debited in EUR. Match by vendor + approximate EUR (USD × ~0.85–0.88 for the period). The transaction's `local_amount`/`local_currency` confirms it.
- **Invoice + receipt duplicates**: many vendors ship both an invoice and a payment receipt for one charge — attach one (or both), count once.
- **Income via Malt/Mangopay**: net payout = client (Royal Canin) invoice gross − Malt service fee. Attach BOTH the client invoice and the Malt commission invoice to the income transaction.
- **Only act on transactions currently missing an attachment.** If a vendor's file exists but its transaction already has `attachment_ids`, skip (already done).
- Qonto `list_client_invoices` only returns invoices issued *in Qonto* (often recent) — historical client invoices usually live in the Drive instead.

### 6. Attach — use the `qonto-attach` skill
Build a batch JSON `[{tx,file,ct,name}]` and run it through `qonto-attach` (execution subagent). Prefer a meaningful `name` (see naming convention below). Attaching is safe/reversible.

### 7. Report (every batch / month)
Give the user a running summary: a table of what was attached (month, transaction, file), plus **everything still missing**, grouped:
- **Impôts & cotisations** (URSSAF employeur, DGFIP/IS-TVA, retraite Malakoff) → justificatif = online portal, not in the Drive.
- **Mouvements internes** (owner draws, inter-account transfers, salaries → payslips) → mark "no receipt required" in Qonto.
- **Frais/produits Qonto** (fees, cashback, account remuneration, 1€ card checks) → justified by the Qonto statement.
- **Petites dépenses tierces sans fichier** → the only "actionable" ones the user can still fetch.
- **Revenus sans facture retrouvée**.
Be honest that a strict "0 missing" is usually unreachable from Drive files alone.

## Naming convention (optional rename step)
Rename attached originals to `YYYY-MM-DD_Fournisseur_MontantEUR.ext` (date = transaction date; `Fournisseur` = counterparty slug, ASCII, no spaces). Special cases: URSSAF appel → `2026_URSSAF_appel-cotisations.pdf`; Malt pairs → `..._facture-client.pdf` / `..._commission.pdf`. Always **dry-run first** (print old→new, check for collisions), then `mv` in place, logging old↔new to a TSV so it's reversible. Renaming a Drive original does NOT affect the already-uploaded Qonto copy.

## Gotchas
- `list_transactions` output overflows context → always `jq` the saved file.
- Extraction/upload subagents can hit session limits — retry after the reset; the main-loop MCP calls still work inline as a fallback.
- Verify a sample with `get_transaction` (`attachment_ids` populated); the webapp counter lags.
