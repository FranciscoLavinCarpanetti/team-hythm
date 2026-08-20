# Remediation plan — Agent Performance Hub (post-audit)

The full audit is in the chat message. This plan covers only the fixes; approve it if you want me to start executing (P0 first).

## P0 — Blockers before any real WFM use

1. **Remove the corporate email list from the public bundle.** `src/components/wfm/AccessGate.tsx` ships 5 real `@telpark.com` addresses to any visitor of the public Pages site. Replace with real authentication (Lovable Cloud auth with an allowlist table, or an internal host behind Entra ID). Until then, at minimum: private repo + no hardcoded addresses.
2. **Stop indexing.** `public/robots.txt` currently allows every crawler; switch to `Disallow: /` plus `noindex` while the app is publicly reachable.
3. **Fix the expected/idle time model** (`aggregateAgents` in `src/lib/wfm/aggregate.ts`): configurable daily active hours, handling for partial days, and surfacing over-performance instead of clamping `idleSeconds` at 0.
4. **Close load-category gaps** (`categorize`, `DEFAULT_CATEGORIES`): values in 55–55.01 / 59.99–60 / 75–75.01 and occupancy > 100% currently fall into "Sin categoría". Use half-open ranges and cap/flag > 100%.
5. **Decouple Operación from the Agentes filters** (`src/routes/index.tsx`): KPIs, distribution and shift analysis are computed from `visibleAgents`, so a search/filter silently changes the exported report.

## P1 — Correctness and data trust

6. Duration/date parsing edge cases in `src/lib/wfm/time.ts`: the `raw < 10` "Excel fraction" heuristic misreads small numeric durations; the serial-date branch mixes UTC math with local `getHours()` used for shift assignment.
7. Deduplication key `sessionId|agent` (`src/lib/wfm/excel.ts`) can drop legitimate rows when session ids repeat across days — include the operational date/timestamps.
8. Anomalous rows (`productiveSeconds > sessionSeconds`) are warned about but still aggregated; decide and document whether they are excluded or capped.
9. History persistence (`src/lib/wfm/history.ts`): the quota fallback silently discards session rows. Add explicit user feedback and a real export (XLSX/CSV) so history is not the only copy.
10. Move Excel parsing to a Web Worker with progress and a size guard; memoise `shiftBreakdown`/`detectShift` and debounce the agent search.

## P2 — Product, UX, accessibility

11. Date-range filter (not only single day / all), per-day drill-down, CSV/XLSX export next to the PNG report, confirmation on "Vaciar datos".
12. `lang="en"` in `src/routes/__root.tsx` on a Spanish UI; generic root title/`author: Lovable`/`twitter:site: @Lovable` metadata; absolute `/favicon.ico` and `<a href="/">` break under the Pages sub-path.
13. Accessibility: `role="button"` on `<tr>` in `AgentTable.tsx`, focus management in `AgentDetail`, contrast checks for the orange/yellow states, mobile behaviour of the 900px-wide table.
14. SharePoint embedding: verify storage partitioning (config/history may not persist in an iframe), `allow-downloads` for the PNG export, and iframe height behaviour with the sticky header.
15. Engineering hygiene: unit tests for `time.ts`/`excel.ts`/`aggregate.ts`, and a typecheck + lint gate in `.github/workflows/deploy-pages.yml` (which also uses `npm install` while the repo ships `bun.lock`).
