# Schedule filters

The schedule timeline can be narrowed using **Filters** in the header.

## How rules work

- Each rule is “field **is** / **is not** values”.
- **All active rules must match** (AND logic).
- People rules (department, role, person, person tag, person type) filter which rows appear.
- Allocation rules (project, client, project tag, stage, work/leave) require at least one matching allocation in the visible date range.

## Person type

**Employee**, **Contractor**, and **Placeholder** describe how someone is set up in Alloc8. Filter by **Person type** to focus on contractors, for example.

## Empty schedule

If nobody appears after filtering:

1. Check active filter rules — they may be too narrow.
2. Check the date range — people without allocations in that window may still show, but allocation-based rules need matching work in view.
3. Clear filters or remove one rule at a time.

## Starred filters

Save your current filter set as a starred preset from the filter menu for quick access later.
