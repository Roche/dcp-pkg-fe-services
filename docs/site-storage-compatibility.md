# Site Storage Compatibility Strategy

## Goal

Use `uiStore.site` as the only source of truth for current site, while keeping backward compatibility for apps that still read/write legacy root fields in `localStorage['ui']`.

## Current Contract (Transitional)

When site changes, `uiStore.setCurrentSite(...)` writes a single `localStorage['ui']` payload containing both:

- Canonical field: `site` object
- Legacy root fields: `siteContext`, `siteShortName`, `siteTimeZoneName`, `siteTimeZOneName`, `siteUTCOffset`

This keeps mixed consumers synchronized during migration.

## Read Priority

`uiStore` maps incoming storage in this order:

1. Site id: `siteContext` first, fallback to `site.id`
2. Site metadata: prefers legacy root fields when present, with fallback to nested `site`

Reason: some ngrx-based apps still update root fields directly.

## Required Usage for Integrating Apps

- Do: call `uiStore.setCurrentSite({ id, name, timeZone, utcOffset })`
- Do not: write `localStorage['ui']` site fields directly in app code

Using a single API avoids split writes and stale reconciliation cycles.

## Decommission Plan

After all apps use top navigation + `uiStore` (and no app syncs site via ngrx/localStorage root fields):

1. Remove legacy writes from `setCurrentSite(...)`
2. Remove legacy reads from `mapStateFromStorage(...)`
3. Keep only `site` object mapping and persistence
4. Delete tests that assert legacy root field compatibility

## Tracking Checklist

- [ ] All site changes go through `uiStore.setCurrentSite(...)`
- [ ] No app writes `siteContext`/`siteShortName`/`siteTimeZoneName`/`siteUTCOffset` directly
- [ ] Cross-app navigation works with `uiStore.site` only
- [ ] Legacy compatibility code removed

