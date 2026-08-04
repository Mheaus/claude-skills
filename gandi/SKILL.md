---
name: gandi
description: Manage Gandi.net through the Gandi Public API v5 — list and inspect domains, check availability and price, read and edit LiveDNS records (A, AAAA, CNAME, MX, TXT, SRV, CAA...), manage nameservers, glue records, web forwarding, DNSSEC, autorenew, transfers, and SSL certificates. Use whenever the user mentions Gandi, or wants to change DNS or domain settings on a domain hosted at Gandi.
argument-hint: <what you want to do with Gandi>
---

You drive the Gandi Public API v5 with the `gandi` helper in this skill folder.

## The helper

```
~/.claude/skills/gandi/gandi [--sandbox] [-r] <METHOD> <PATH> [JSON_BODY] [curl opts...]
```

It adds the base URL, the `Authorization: Bearer` header and the JSON headers,
formats the answer with `jq`, and exits non-zero on any HTTP code outside 2xx.
The token comes from `GANDI_PAT`, or from the macOS keychain item
`gandi-api-key`. Never print the token, and never paste it into a command.

```bash
G=~/.claude/skills/gandi/gandi
"$G" GET /v5/organization/user-info
"$G" GET "/v5/domain/domains?per_page=200"
"$G" GET "/v5/domain/check?name=example.com"
```

Quote any PATH that holds a `?` or `&`. Use `--sandbox` to try a risky call
against the sandbox first — the sandbox needs its own token.

## Rules

1. **Confirm before you spend money.** These calls charge the prepaid account or
   the card: register a domain, renew, restore, transfer in, buy or renew a
   certificate. Before any of them:
   - read the price first (`GET /v5/domain/check`,
     `GET /v5/domain/domains/{domain}/renew`, `GET /v5/certificate/packages`),
   - read the balance (`GET /v5/billing/info`),
   - state the exact amount and duration to the user and wait for a clear yes.
   The reference marks these endpoints with **€**.
2. **Read the zone before you write it.** `PUT .../records` replaces the whole
   zone and `DELETE .../records` empties it. Before a bulk change, take a
   snapshot: `POST /v5/livedns/domains/{fqdn}/snapshots`. Say the snapshot id to
   the user. To change one entry, use the
   `/records/{rrset_name}/{rrset_type}` path, never the zone-wide path.
3. **Show the diff before a DNS write.** Print the current rrset and the new
   one, then apply.
4. **A failed record create is usually a 409.** The rrset exists — switch from
   `POST` to `PUT` on the `{rrset_name}/{rrset_type}` path.
5. **Do not touch nameservers casually.** `PUT .../nameservers` and
   `POST .../livedns` move the whole domain's DNS. Confirm first.
6. Prefer `jq` on the helper output over reading raw JSON by eye. List
   endpoints paginate — pass `per_page` (max 1000 on most) and check the
   `Total-Count` header with `-D /dev/stderr` when a count matters.

## Traps, all confirmed against the live API

- **`GET /v5/livedns/domains` returns `[]` even when zones exist.** That route
  only lists zones that somebody created straight in LiveDNS. To find the zones
  of the account, use `GET /v5/domain/domains?nameserver=livedns`. A single zone
  answers fine on `GET /v5/livedns/domains/{fqdn}`.
- **Gandi adds the quotes of a TXT value.** Send
  `"rrset_values":["v=spf1 ..."]` without quotes inside the string. The read
  back shows `"\"v=spf1 ...\""`. When you copy a value from a read to a write,
  strip the outer quotes first, or the record gets double quotes.
- **`PUT` on an rrset answers `{"message":"DNS Record Created"}`**, the same text
  as a `POST`. The message does not tell a create from an update. Read the rrset
  again to confirm the new values.
- **`sharing_id` gives a 403 when the token belongs to one organization only.**
  Leave the parameter out unless a sharing really exists.
- **A `{rrset_name}` with a `*` is URL-encoded as `%2A` in the `rrset_href`.**
  Encode the star yourself when you build such a path by hand.

## Common tasks

**Find the zones that LiveDNS serves** (`/v5/livedns/domains` does not work, see
the traps above):

```bash
"$G" GET "/v5/domain/domains?nameserver=livedns&per_page=200" | jq -r '.[].fqdn'
```

**Every domain with its expiry date, soonest first:**

```bash
"$G" GET "/v5/domain/domains?per_page=200" |
  jq -r '.[] | [.fqdn, .dates.registry_ends_at, (.autorenew|tostring)] | @tsv' |
  sort -k2
```

**Read a whole zone as a zone file:**

```bash
"$G" -r GET "/v5/livedns/domains/example.com/records" -H "Accept: text/plain"
```

**Add or change one record:**

```bash
# Create — fails with 409 when the rrset already exists.
"$G" POST /v5/livedns/domains/example.com/records \
  '{"rrset_name":"www","rrset_type":"A","rrset_ttl":3600,"rrset_values":["192.0.2.1"]}'

# Replace the values of an existing rrset.
"$G" PUT /v5/livedns/domains/example.com/records/www/A \
  '{"rrset_ttl":3600,"rrset_values":["192.0.2.2"]}'

# Delete it.
"$G" DELETE /v5/livedns/domains/example.com/records/www/A
```

**Point a domain at a host, apex and www:**

```bash
"$G" PUT /v5/livedns/domains/example.com/records/@/A \
  '{"rrset_ttl":3600,"rrset_values":["203.0.113.10"]}'
"$G" PUT /v5/livedns/domains/example.com/records/www/CNAME \
  '{"rrset_ttl":3600,"rrset_values":["example.com."]}'
```

**Snapshot, then roll back:**

```bash
"$G" POST /v5/livedns/domains/example.com/snapshots
"$G" GET /v5/livedns/domains/example.com/snapshots
"$G" GET /v5/livedns/domains/example.com/snapshots/<id> |
  jq '{items: .records}' > /tmp/zone.json
"$G" PUT /v5/livedns/domains/example.com/records "$(cat /tmp/zone.json)"
```

**Certificates that expire soon:**

```bash
"$G" GET "/v5/certificate/issued-certs?status=valid&sort_by=ends_at" |
  jq -r '.[] | [.cn, .ends_at, .package] | @tsv'
```

**Turn autorenew on:**

```bash
"$G" PATCH /v5/domain/domains/example.com/autorenew '{"enabled":true,"duration":1}'
```

## Endpoint reference

`references/endpoints.md` in this skill folder holds every route for the domain,
LiveDNS, certificate, billing and organization sections, with the body shapes,
the query parameters and the error codes. Read it when you need a route that the
tasks above do not cover. The live doc is <https://api.gandi.net/docs/>.

## Instructions

If `$ARGUMENTS` is set, treat it as the task. Otherwise ask what the user wants
to do on Gandi.

Work in this order:

1. Read the current state with a `GET` before you change anything.
2. Show the user what you plan to change, and the price when money is involved.
3. Apply the change, then read the resource again to confirm the new state.
4. For DNS, remind the user that the TTL of the old record delays propagation.
