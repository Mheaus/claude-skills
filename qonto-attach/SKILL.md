---
name: qonto-attach
description: Attach one or many files (receipts/invoices) to Qonto transactions via the Qonto MCP upload flow. Use whenever you need to upload/attach a justificatif/document to a Qonto transaction, or run a batch of {transaction → file} attachments reliably.
argument-hint: [path to a batch JSON of {tx,file,ct,name}]
---

Attach files to Qonto transactions using the Qonto MCP server. This is the reliable, reusable upload primitive (used by the `qonto-justificatifs` skill).

## Prerequisites

- The `qonto-mcp` MCP server must be connected. Load its tools first (they are usually deferred):
  `ToolSearch("select:mcp__qonto-mcp__request_attachment_upload,mcp__qonto-mcp__upload_attachment,mcp__qonto-mcp__get_transaction")`
- Accepted files: `application/pdf`, `image/jpeg`, `image/png`, ≤ 15 MB.

## The 3-step flow (per file)

For each `(transaction_id, file, content_type)`:

1. **Request** an upload slot:
   `mcp__qonto-mcp__request_attachment_upload(file_name=<basename or a clean name>, content_type=<ct>, size_bytes=<bytes>)`
   → returns `upload_url` (presigned S3 PUT, **expires in ~15 min**) and `blob_ref`.
2. **PUT** the raw bytes (Bash) — keep the URL in **single quotes** to protect `&`,`%`,`=`:
   ```bash
   curl -s -o /dev/null -w "%{http_code}" -X PUT \
     -H "Content-Type: <ct>" --data-binary @"<file>" '<upload_url>'
   ```
   Must print `200`. On `ExpiredToken`/`403`, redo step 1 for a fresh URL and retry once.
3. **Attach** to the transaction:
   `mcp__qonto-mcp__upload_attachment(blob_ref=<blob_ref>, target="transaction", transaction_id=<tx>)`

Do steps 1→2→3 **back-to-back per file** (the presigned URL is short-lived). Multiple files may target the **same** transaction (e.g. an invoice + its payment receipt, or a client invoice + a Malt commission) — that's fine, just attach each.

## Batch pattern (recommended for >3 files)

Put the work in a JSON array file, one object per file:
```json
[{"tx":"<uuid>","desc":"Slack 44.83","file":"/abs/path.pdf","ct":"application/pdf","name":"2025-12-25_Slack_44.83EUR.pdf"}]
```
Then run the flow inside an **execution subagent** (Agent tool, `general-purpose`). This keeps the large presigned URLs out of the main context. Give the subagent: the batch path, the ToolSearch line above, the 3-step flow, and "return ONLY a compact JSON array `{desc,put_http,upload_ok}` (or `error`)". Get file size with `stat -f "%z" "<file>"`.

## Verify & gotchas

- Confirm with `mcp__qonto-mcp__get_transaction(id=<tx>)` → `attachment_ids` should be non-empty.
- `attachment_required` stays `true` even after attaching — it means "a receipt is expected", not "missing". The webapp "justificatifs manquants" counter lags; the file is attached regardless. Tell the user to refresh and open the transaction's **Justificatif** panel.
- Double-check every `transaction_id` is real before batching — a wrong UUID PUTs to S3 (200) but fails `upload_attachment` with 404.
- This server never moves money; attaching is safe and reversible (`mcp__qonto-mcp__remove_transaction_attachment`).
