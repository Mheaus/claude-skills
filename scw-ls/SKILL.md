---
name: scw-ls
description: List all running Scaleway resources — gives a quick overview of instances, k8s clusters, serverless, databases, storage, and more. Use when the user wants to see what's currently deployed on Scaleway.
argument-hint: [namespace to filter, e.g. "k8s" or "instance"]
---

Run a broad overview of all active Scaleway resources using the `scw` CLI.

## Instructions

Run the commands below **in parallel** (use multiple Bash calls simultaneously). Collect all results, then present a clean summary organized by category.

For each category, show a table or list with the key info. If a category returns nothing, skip it silently.

If `$ARGUMENTS` is provided, limit the overview to that namespace only (e.g. if user passes "k8s", only list k8s resources).

## Commands to run

**Compute:**
```bash
scw instance server list -o json 2>/dev/null
```

**Kubernetes:**
```bash
scw k8s cluster list -o json 2>/dev/null
```

**Serverless Containers:**
```bash
scw container namespace list -o json 2>/dev/null
scw container container list -o json 2>/dev/null
```

**Serverless Functions:**
```bash
scw function namespace list -o json 2>/dev/null
scw function function list -o json 2>/dev/null
```

**Serverless Jobs:**
```bash
scw jobs job-definition list -o json 2>/dev/null
```

**Databases:**
```bash
scw rdb instance list -o json 2>/dev/null
scw redis cluster list -o json 2>/dev/null
scw mongodb instance list -o json 2>/dev/null
```

**Storage:**
```bash
scw object bucket list -o json 2>/dev/null
scw block volume list -o json 2>/dev/null
```

**Container Registry:**
```bash
scw registry namespace list -o json 2>/dev/null
```

**Networking:**
```bash
scw vpc private-network list -o json 2>/dev/null
scw lb lb list -o json 2>/dev/null
```

**AI / Inference:**
```bash
scw inference deployment list -o json 2>/dev/null
```

## Output format

Present results grouped by category. For each resource include at minimum: name, ID (shortened if long), status, zone/region, and any key metric (size, node count, etc.).

Example format:
```
## Instances (2)
| Name        | ID           | Type    | Zone      | Status  |
|-------------|--------------|---------|-----------|---------|
| my-server   | abc123...    | DEV1-S  | fr-par-1  | running |

## Kubernetes (1)
| Name        | Version | Nodes | Zone     | Status |
|-------------|---------|-------|----------|--------|
| my-cluster  | 1.31    | 3     | fr-par-1 | ready  |
```

End with a one-line summary: total resource count and monthly estimated spend if billing data is available.
