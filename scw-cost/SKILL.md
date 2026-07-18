---
name: scw-cost
description: Show Scaleway billing and consumption summary — current month spending, per-product breakdown, and invoice history. Use when the user wants to check their Scaleway costs or billing.
argument-hint: [month in YYYY-MM format, e.g. "2025-03"]
---

Display a clear billing and consumption overview using the `scw` CLI.

## Instructions

Run the billing commands and present a clean cost summary.

If `$ARGUMENTS` is provided and matches a `YYYY-MM` format, show billing for that specific month. Otherwise, show the current month.

## Commands to run

```bash
# Current consumption
scw billing consumption list -o json 2>/dev/null

# Invoices list
scw billing invoice list -o json 2>/dev/null
```

For a specific month (if user provides YYYY-MM):
```bash
scw billing invoice list started-after=<YYYY-MM-01T00:00:00Z> started-before=<YYYY-MM+1-01T00:00:00Z> -o json 2>/dev/null
```

## Output format

Present results as:

```
## Current month consumption (April 2025)

| Product              | Amount (EUR) |
|----------------------|-------------|
| Instance             | 12.50       |
| Kubernetes           | 8.20        |
| Object Storage       | 0.45        |
| Managed Database     | 15.00       |
| ...                  | ...         |
| **Total**            | **36.15**   |

## Recent invoices
| Period       | Amount (EUR) | Status |
|--------------|-------------|--------|
| March 2025   | 42.30       | paid   |
| February 2025| 38.90       | paid   |
```

If the consumption data doesn't break down by product, show total and note that a detailed breakdown is available in the Scaleway console.

Tip: mention that detailed billing is also available at console.scaleway.com/billing.
