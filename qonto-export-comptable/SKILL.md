---
name: qonto-export-comptable
description: Assemble the monthly accounting package for the comptable — Qonto statement, every justificatif split between ventes and achats, a recap CSV that ties to the statement, and a cover note. Use when the user wants a monthly export for their accountant, to send the pièces justificatives of a month, or to close a month's bookkeeping.
argument-hint: [mois YYYY-MM]
---

Build one month's accounting package from a Qonto account and a documents folder.
Companions: `qonto-justificatifs` (reconcile what is missing) and `qonto-attach`
(upload).

**Ask for the month if the user did not give one.** Default to the last complete
month. Do not widen to several months without an explicit request.

## Read the local reference first

`reference.local.md`, next to this file, is gitignored and holds everything specific to
the entity: legal identity, `bank_account_id`, the date of the first transaction, the
Drive root, the folder map, the accounting firm, the recurring overrides and the
recurring amounts. **Read it before step 1.** This SKILL.md deliberately stays generic,
so without it you must ask the user for the account and the folder map.

## Prerequisites

- `qonto-mcp` connected. Load the tools once (they are deferred):
  `ToolSearch("select:mcp__qonto-mcp__get_organization,mcp__qonto-mcp__list_transactions,mcp__qonto-mcp__get_transaction,mcp__qonto-mcp__list_transaction_attachments,mcp__qonto-mcp__request_attachment_upload,mcp__qonto-mcp__upload_attachment")`
- Confirm the main `bank_account_id` with `get_organization`. Do not chase a month
  before the account was opened.
- `pdftotext` is available. Use it to read a PDF cheaply instead of the Read tool.
- Three environment values drive every script:
  - `MONTH` — `YYYY-MM`
  - `EXPORT` — `<documents root>/factures-justificatifs/export-comptable/$MONTH`
  - `WORK` — a scratchpad dir for the working files

## Target layout

```
export-comptable/YYYY-MM/
├── LISEZ-MOI.md
├── recap-YYYY-MM.csv
├── releve/YYYY-MM_releve-compte-Qonto_<ENTITE>.pdf
└── justificatifs/
    ├── ventes/
    └── achats/
```

## Workflow

### 1. Statement first

The monthly statement is usually already synced in the documents folder (see the local
reference for the path); `list_statements` / `get_statement` are the fallback. Copy it
into `$EXPORT/releve/`. Read its header with `pdftotext -layout` and note **Entrées**,
**Sorties** and both balances — these are the reference for every later check.

### 2. Pull the transactions on the settled_at basis

**Use `settled_at`, never `emitted_at`.** The statement uses the date de valeur. A
transaction emitted late in month N-1 can settle in month N and it belongs to this
month's package. This is not a corner case: the first month built this way had one such
debit, and on the emitted basis the debit total came out short by exactly its amount.

```
list_transactions(bank_account_id, settled_at_from:"YYYY-MM-01T00:00:00Z",
                  settled_at_to:"YYYY-MM-<last>T23:59:59Z",
                  sort_by:"settled_at:asc", per_page:100)
```

The result **overflows the context and is saved to a file**. Never read it in. Use
`jq` on that file to write `$WORK/tx.json`:

```
jq '[.transactions[] | {id, emitted_at, settled_at, side, amount, currency,
     operation_type, counterparty: (.clean_counterparty_name // .label), label,
     attachment_ids, attachment_lost}] | sort_by(.settled_at)' <file> > $WORK/tx.json
```

Then check the sums against the statement before you go further. They must match to
the cent. If they do not, a transaction is missing — diff the emitted and settled
sets to find it.

### 3. Download the pieces from Qonto, not from the Drive

`list_transaction_attachments` gives the file already reconciled to its transaction,
so no amount or vendor matching is needed. Its `url` is a presigned S3 link that is
~2000 characters long and expires in 30 minutes.

**Delegate this batch to a `general-purpose` subagent** so the URLs stay out of the
main context. Give it a TSV manifest (`txId, date, side, amount, counterpartySlug,
attachmentCount`) built from `$WORK/tx.json`, and ask it to:

1. call `list_transaction_attachments` per transaction, ~6 in parallel;
2. `curl -sS -f -o "<dest>/<name>" "<url>"` straight away;
3. name each file `YYYY-MM-DD_Fournisseur_MontantEUR.ext`, date = `emitted_at`,
   suffix `-1` / `-2` only when a transaction has several attachments;
4. write `$WORK/downloaded.tsv` — `txId, newName, originalName, bytes`;
5. return only the counts and any failure. No prose, no URLs.

### 4. Fill the gaps from the Drive

For every transaction with no Qonto attachment, look elsewhere in the Drive and
record each find in `$WORK/supplements.tsv` — `txId, newName, sourcePathRelativeToWork,
comment`. Copy the file into `$EXPORT/justificatifs/`.

**The local reference holds the folder map** — where the payroll declaration, the
accounting fees, the social contributions, the health cover and the client invoices
live. Ask the user for it when the reference is absent.

Two habits that pay off whatever the folder map:

- **The monthly payroll declaration (DSN) is a strong justificatif.** Its "Total des
  cotisations" lines carry the employer social contributions and the pension amounts
  that are debited the month after, so one file can justify several debits. Grep it
  with `pdftotext -layout` rather than reading it.
- **A file is often filed in an adjacent month.** Match on amount, vendor and date,
  never on the folder it sits in.

### 5. Deduplicate

`node $SKILL/scripts/dedupe.mjs` with `DRY=1` first, then for real. Qonto often holds
the same invoice twice on one transaction, and the monthly Qonto invoice is attached
to every fee transaction. The script keeps one file, points several recap lines at it,
and drops the `-1` suffix when a transaction ends up with a single piece.

Use `$WORK/overrides.json` → `canonical` to give a shared file a meaningful name, for
example `2026-07_Qonto_facture-frais-bancaires.pdf`.

### 6. Split ventes / achats

`node $SKILL/scripts/split.mjs`, `DRY=1` first. It refuses to run when the plan does
not cover the files on disk exactly, and it is safe to run twice.

**The bank side alone gets this wrong.** Two cases need an override in
`$WORK/overrides.json` → `files`:

- **A freelance-platform payout carries one piece of each nature.** The platform issues
  the client invoice in the name and on behalf of the company — that one is a **vente**
  — and its own commission invoice, which is an **achat**. Open both with `pdftotext`
  to get the real totals and rename them accordingly; naming them after the net payout
  is misleading. Net received = client invoice − commission, and it must check to the
  cent.
- **A supplier credit note is a bank credit but stays an achat.** A refund on a
  cancelled subscription is the common case.

Cashback and balance remuneration are Qonto financial products, neither vente nor
achat. Put them in `$WORK/overrides.json` → `categories` as `"Produit financier"`.

### 7. Recap

`node $SKILL/scripts/recap.mjs` writes `$EXPORT/recap-$MONTH.csv` — semicolon
separated, UTF-8 BOM so Excel FR opens it. One line per statement operation, sorted
by date de valeur, plus a TOTAUX line.

Statuses come from `$WORK/statuses.tsv` — `txId, statut, comment`:

- **OK** — the piece is in the export (set automatically when a file is mapped).
- **RELEVE** — Qonto product, no third-party invoice exists; the statement is the piece.
- **PARTIEL** — a piece is supplied but it does not cover the exact amount.
- **A RECUPERER** — to ask the supplier.
- **PORTAIL** — to download from an administrative portal.

### 8. LISEZ-MOI.md

Write the cover note in French. It must carry:

- identity block (SIREN, TVA, IBAN) and the folder table;
- the rapprochement table (both balances, entrées, sorties) and the statement that
  the recap totals are identical;
- the settled-date rule, and any transaction emitted in the previous month;
- the status legend;
- **Points d'attention**, one numbered item per judgement the accountant must not
  redo. Always spell out the VAT traps you found. Two that recur:
  - Two lines from the same vendor do not carry the same VAT. An insurance premium is
    **exonérée de TVA** while a storage subscription carries VAT at the normal rate.
    Say so, or the VAT gets deducted on the premium.
  - For a platform payout the **turnover to book is the client invoice amount, not the
    net received**; the commission is a separate charge.
- **Reste à fournir**, with the exact count.

### 9. Verify, then report

```
find "$EXPORT" -name .DS_Store -delete
MONTH=… EXPORT=… STATEMENT_DEBIT=… STATEMENT_CREDIT=… node $SKILL/scripts/verify.mjs
```

It exits 1 unless every cited piece exists, no file is orphan, the recap totals match
the statement, `LISEZ-MOI.md` is present and `releve/` holds a PDF. Do not tell the
user the export is ready before it exits 0.

Then report: the tree, the rapprochement, what you recovered and from where, and the
lines still open grouped by reason. Be honest that a strict "0 missing" is out of reach
— tax and social-contribution notices live on portals, not in the documents folder.

## Never attachable from the documents folder

Tax notices (corporate tax, VAT), employer social contributions beyond the DSN, pension
funds beyond the DSN, internal transfers (owner draws, account to account) and salaries
(they need the payslips). Mark them `PORTAIL` or `RELEVE` rather than chasing them. The
local reference lists the ones already identified.

## Gotchas

- `list_transactions` and `get_message` overflow the context. Always `jq` the saved
  file; never read it in.
- `mv` and `cp` prompt when the target exists and the shell is not interactive, which
  hangs the call. Use `cat > file` or `mv -f`.
- Qonto keeps `attachment_required: true` after you attach a file, and the webapp
  "justificatifs manquants" counter lags. Trust `attachment_ids`.
- A subscription receipt often goes to a personal account rather than a company
  mailbox, so the Gmail connector cannot find it. Do not conclude the receipt does not
  exist — send the user to the vendor's purchase history instead. For Apple that is
  `reportaproblem.apple.com` → Historique des achats. Apple also has two separate
  senders: `EMEA_Invoicing@email.apple.com` for hardware orders and
  `no_reply@email.apple.com` "Votre reçu Apple" for subscriptions.
- Screenshot PDFs have no text layer. `pdftotext` returns nothing, so fall back to
  the Read tool for those.
- Check the local reference before you ask a supplier to reissue an invoice in the
  company name: the firm may already accept it in the owner's personal name. The pieces
  may also have to go into the firm's own tool, not only into this export.
