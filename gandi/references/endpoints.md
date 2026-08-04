# Gandi Public API v5 — endpoint reference

Base URL: `https://api.gandi.net` — sandbox: `https://api.sandbox.gandi.net`
Auth header: `Authorization: Bearer <PAT>` (the `Apikey` scheme is deprecated).

Every path below is copied from the official reference pages
(<https://api.gandi.net/docs/>). Rows marked **€** cost money.

Common query parameters on list endpoints: `page`, `per_page`, `sort_by`
(prefix with `-` for descending), `sharing_id` (target another organization).

---

## Domain — `/v5/domain`

| Method | Path | Purpose |
|---|---|---|
| GET | `/v5/domain/domains` | List domains. Filters: `fqdn`, `tld`, `nameserver` (`abc`, `livedns`, `other`) |
| POST | `/v5/domain/domains` | **€** Register a domain |
| GET | `/v5/domain/domains/{domain}` | Domain details |
| DELETE | `/v5/domain/domains/{domain}` | Delete a domain (restricted) |
| GET | `/v5/domain/check` | Availability and price. Required: `name`. Optional: `processes` (default `["create"]`), `currency`, `country`, `grid`, `period`, `max_duration`, `duration_unit`, `extension`, `lang`, `sharing_id` |
| GET | `/v5/domain/domains/{domain}/renew` | Renewal terms and price (safe, read only) |
| POST | `/v5/domain/domains/{domain}/renew` | **€** Renew. Body: `{"duration": 1}` |
| GET | `/v5/domain/domains/{domain}/restore` | Restore terms and price (safe) |
| POST | `/v5/domain/domains/{domain}/restore` | **€** Restore an expired domain |
| PATCH | `/v5/domain/domains/{domain}/autorenew` | Autorenew settings. Body: `{"enabled": true, "duration": 1}` |
| GET | `/v5/domain/domains/{domain}/status` | Domain status |
| PATCH | `/v5/domain/domains/{domain}/status` | Set the transfer lock. Body: `{"clientTransferProhibited": true}` |
| GET | `/v5/domain/domains/{domain}/createstatus` | Registration progress |
| PUT | `/v5/domain/domains/{domain}/authinfo` | Reset the transfer authorization code |
| GET | `/v5/domain/domains/{domain}/transferout` | Transfer-out status |
| GET | `/v5/domain/domains/{domain}/reachability` | Owner email check status |
| GET | `/v5/domain/domains/{domain}/claims` | Trademark claims |
| GET | `/v5/domain/tlds` | List the TLDs that Gandi sells |
| GET | `/v5/domain/tlds/{name}` | TLD rules (min/max duration, IDN, ...) |

### Nameservers, glue records and LiveDNS attach

| Method | Path | Purpose |
|---|---|---|
| GET | `/v5/domain/domains/{domain}/nameservers` | Current nameservers |
| PUT | `/v5/domain/domains/{domain}/nameservers` | Replace them. Body: `{"nameservers":["ns1.example.net","ns2.example.net"]}` |
| POST | `/v5/domain/domains/{domain}/livedns` | Move the domain to LiveDNS nameservers |
| GET | `/v5/domain/domains/{domain}/livedns` | LiveDNS attach status |
| GET | `/v5/domain/domains/{domain}/hosts` | List glue records |
| POST | `/v5/domain/domains/{domain}/hosts` | Create a glue record. Body: `{"name":"ns1","ips":["192.0.2.1"]}` |
| GET | `/v5/domain/domains/{domain}/hosts/{name}` | Glue record details |
| PUT | `/v5/domain/domains/{domain}/hosts/{name}` | Replace the IPs of a glue record |
| DELETE | `/v5/domain/domains/{domain}/hosts/{name}` | Delete a glue record |

### DNSSEC (registry side)

| Method | Path | Purpose |
|---|---|---|
| GET | `/v5/domain/domains/{domain}/dnskeys` | List the DS/DNSKEY records at the registry |
| POST | `/v5/domain/domains/{domain}/dnskeys` | Add a key |
| PUT | `/v5/domain/domains/{domain}/dnskeys` | Replace all keys |
| DELETE | `/v5/domain/domains/{domain}/dnskeys/{id}` | Delete a key |
| GET | `/v5/domain/domains/{domain}/livedns/dnssec` | LiveDNS DNSSEC state |
| POST | `/v5/domain/domains/{domain}/livedns/dnssec` | Enable DNSSEC on LiveDNS |
| DELETE | `/v5/domain/domains/{domain}/livedns/dnssec` | Disable it |

### Web forwarding

| Method | Path | Purpose |
|---|---|---|
| GET | `/v5/domain/domains/{domain}/webredirs` | List the redirections |
| POST | `/v5/domain/domains/{domain}/webredirs` | Create one. Body: `{"host":"www","type":"http301","url":"https://target.example"}`. `type` is `cloak`, `http301` or `http302` |
| GET | `/v5/domain/domains/{domain}/webredirs/{host}` | Redirection details |
| PATCH | `/v5/domain/domains/{domain}/webredirs/{host}` | Change one |
| DELETE | `/v5/domain/domains/{domain}/webredirs/{host}` | Delete one |

### Contacts and owner change

| Method | Path | Purpose |
|---|---|---|
| GET | `/v5/domain/domains/{domain}/contacts` | Owner, admin, bill and tech contacts |
| PATCH | `/v5/domain/domains/{domain}/contacts` | Change the non-owner contacts |
| PUT | `/v5/domain/domains/{domain}/contacts/owner` | Change the owner data |
| POST | `/v5/domain/changeowner/{domain}` | Start an owner change |
| GET | `/v5/domain/changeowner/{domain}` | Owner change status |
| POST | `/v5/domain/changeowner/{domain}/foa` | Send the approval mails again |

### Transfer in

| Method | Path | Purpose |
|---|---|---|
| POST | `/v5/domain/transferin` | **€** Start a transfer to Gandi |
| GET | `/v5/domain/transferin/{domain}` | Transfer status |
| PUT | `/v5/domain/transferin/{domain}` | Relaunch the transfer |
| POST | `/v5/domain/transferin/{domain}/available` | Check that the domain can be transferred |
| PUT | `/v5/domain/transferin/{domain}/authinfo` | Send the authorization code again |
| POST | `/v5/domain/transferin/{domain}/foa` | Send the approval mails again |

### Tags

`GET`, `POST`, `PUT`, `PATCH`, `DELETE` on `/v5/domain/domains/{domain}/tags`.

---

## LiveDNS — `/v5/livedns`

| Method | Path | Purpose |
|---|---|---|
| GET | `/v5/livedns/domains` | Lists only the zones created straight in LiveDNS. It answers `[]` for zones attached to a domain — use `GET /v5/domain/domains?nameserver=livedns` instead |
| POST | `/v5/livedns/domains` | Add a zone. Body: `{"fqdn":"example.com"}` |
| GET | `/v5/livedns/domains/{fqdn}` | Zone details |
| PATCH | `/v5/livedns/domains/{fqdn}` | Change zone properties (for example `automatic_snapshots`) |
| GET | `/v5/livedns/domains/{fqdn}/nameservers` | The nameservers to set at the registrar |
| GET | `/v5/livedns/dns/rrtypes` | Record types that LiveDNS accepts |

### Records

| Method | Path | Purpose |
|---|---|---|
| GET | `/v5/livedns/domains/{fqdn}/records` | All records. Add `?rrset_type=MX` to filter, or header `Accept: text/plain` for the zone file |
| POST | `/v5/livedns/domains/{fqdn}/records` | Create one rrset. Fails when it exists |
| PUT | `/v5/livedns/domains/{fqdn}/records` | **Replace the whole zone.** Body: `{"items":[ ... ]}` |
| DELETE | `/v5/livedns/domains/{fqdn}/records` | Delete every record |
| GET | `/v5/livedns/domains/{fqdn}/records/{rrset_name}` | All records for one name |
| PUT | `/v5/livedns/domains/{fqdn}/records/{rrset_name}` | Replace all records for one name |
| DELETE | `/v5/livedns/domains/{fqdn}/records/{rrset_name}` | Delete all records for one name |
| GET | `/v5/livedns/domains/{fqdn}/records/{rrset_name}/{rrset_type}` | One rrset |
| POST | `/v5/livedns/domains/{fqdn}/records/{rrset_name}/{rrset_type}` | Create that rrset |
| PUT | `/v5/livedns/domains/{fqdn}/records/{rrset_name}/{rrset_type}` | Replace the values of that rrset |
| PATCH | `/v5/livedns/domains/{fqdn}/records/{rrset_name}/{rrset_type}` | Change that rrset. Read the doc page first, the semantics differ from PUT |
| DELETE | `/v5/livedns/domains/{fqdn}/records/{rrset_name}/{rrset_type}` | Delete that rrset |

Record body shape:

```json
{
  "rrset_name": "www",
  "rrset_type": "A",
  "rrset_ttl": 3600,
  "rrset_values": ["192.0.2.1"]
}
```

- `rrset_name` is `@` for the apex, and a relative label otherwise (`www`, not
  `www.example.com`).
- `rrset_ttl` is optional. The range is 300 to 2592000 seconds.
- `rrset_values` is always an array, even for one value.
- For a TXT record, Gandi adds the double quotes. Send the bare text. A read
  gives the value back with the quotes inside the string.
- MX values keep the priority: `["10 spool.mail.gandi.net.", "50 fb.mail.gandi.net."]`.
- Keep the trailing dot on the target of CNAME, MX, NS and SRV records.
- Types: A, AAAA, ALIAS, CAA, CDS, CNAME, DNAME, DS, HTTPS, KEY, LOC, MX,
  NAPTR, NS, OPENPGPKEY, PTR, RP, SOA, SPF, SRV, SSHFP, SVCB, TLSA, TXT, WKS.

### Zone snapshots — the safety net before a bulk edit

| Method | Path | Purpose |
|---|---|---|
| GET | `/v5/livedns/domains/{fqdn}/snapshots` | List snapshots |
| POST | `/v5/livedns/domains/{fqdn}/snapshots` | Take a snapshot now |
| GET | `/v5/livedns/domains/{fqdn}/snapshots/{id}` | Snapshot content |
| PATCH | `/v5/livedns/domains/{fqdn}/snapshots/{id}` | Rename a snapshot |
| DELETE | `/v5/livedns/domains/{fqdn}/snapshots/{id}` | Delete a snapshot |

To roll back, read the snapshot and send its `records` array to
`PUT /v5/livedns/domains/{fqdn}/records`.

### DNSSEC keys and zone transfer

- Keys: `GET`/`POST` `/v5/livedns/domains/{fqdn}/keys`,
  `GET`/`PATCH`/`DELETE` `/v5/livedns/domains/{fqdn}/keys/{id}`.
- Slave IPs: `GET` `/v5/livedns/domains/{fqdn}/axfr/slaves`,
  `PUT`/`DELETE` `/v5/livedns/domains/{fqdn}/axfr/slaves/{ip}`.
- TSIG: `GET`/`POST` `/v5/livedns/axfr/tsig`, `GET` `/v5/livedns/axfr/tsig/{id}`,
  `GET` `/v5/livedns/axfr/tsig/{id}/config/{software}` (bind, knot, nsd,
  powerdns), and `GET` `/v5/livedns/domains/{fqdn}/axfr/tsig`,
  `PUT`/`DELETE` `/v5/livedns/domains/{fqdn}/axfr/tsig/{id}`.

---

## Certificates — `/v5/certificate`

| Method | Path | Purpose |
|---|---|---|
| GET | `/v5/certificate/issued-certs` | List certificates. Filters: `cn`, `covered_cn`, `package`, `status`, `sort_by` |
| POST | `/v5/certificate/issued-certs` | **€** Buy a certificate |
| GET | `/v5/certificate/issued-certs/{id}` | Certificate details |
| POST | `/v5/certificate/issued-certs/{id}` | **€** Renew a certificate |
| PATCH | `/v5/certificate/issued-certs/{id}` | Change a certificate |
| DELETE | `/v5/certificate/issued-certs/{id}` | Revoke a certificate |
| GET | `/v5/certificate/issued-certs/{id}/crt` | Download the certificate as text |
| PUT | `/v5/certificate/issued-certs/{id}/dcv` | Send the validation mail again |
| PATCH | `/v5/certificate/issued-certs/{id}/dcv` | Change the validation method |
| POST | `/v5/certificate/issued-certs/{id}/dcv_params` | Validation parameters for an existing certificate |
| POST | `/v5/certificate/dcv_params` | Validation parameters for a new certificate |
| GET | `/v5/certificate/packages` | Available packages and prices |
| GET | `/v5/certificate/packages/{name}` | Package details |
| GET | `/v5/certificate/pem/{type}` | Intermediate certificate |
| GET | `/v5/certificate/pem/-/{filename}` | Intermediate certificate by file name |

- `status` values: `pending`, `valid`, `revoked`, `replaced`, `replaced_rev`,
  `expired`.
- `sort_by` values: `created_at`, `updated_at`, `started_at`, `ends_at`,
  `subscription_ends_at`.
- DCV methods: `email`, `dns`, `file`, `http`, `https`.
- Tags: `GET`, `POST`, `PUT`, `PATCH`, `DELETE` on
  `/v5/certificate/issued-certs/{id}/tags`.

---

## Billing and organization

| Method | Path | Purpose |
|---|---|---|
| GET | `/v5/billing/info` | Prepaid account balance of the current user |
| GET | `/v5/billing/info/{sharing_id}` | Balance of one organization |
| GET | `/v5/billing/price/{type}` | Price grid |
| GET | `/v5/organization/user-info` | The authenticated user |
| GET | `/v5/organization/organizations` | Organizations that the token can reach |
| GET | `/v5/organization/organizations/{org_id}` | One organization |
| POST | `/v5/organization/access-tokens` | Renew a personal access token |

A PAT belongs to one organization and cannot be shared across several. When the
token reaches more than one organization through a sharing, pass `sharing_id`.

---

## Error answers

Errors return JSON with `code`, `message`, `object` and `cause`.

| Code | Meaning |
|---|---|
| 401 | The token is absent or wrong |
| 403 | The token expired, or it lacks the permission for this resource |
| 404 | The object does not exist, or the token cannot see it |
| 409 | Conflict — for example the rrset already exists |
| 422 | The body failed validation |
| 429 | Rate limit. Wait and try again |

Long operations answer 202 with a `Location` header. Poll that URL, or poll the
matching status endpoint (`/createstatus`, `/transferin/{domain}`).
