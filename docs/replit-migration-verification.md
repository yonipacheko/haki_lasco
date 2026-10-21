# Replit independence verification — 2026-10-21

Environment: Codex Cloud, Linux x64, Node.js 24.19.0, pnpm 10.34.0, system Chromium driven with Python Playwright. No Replit environment variables or application secrets were supplied. Application source, styles, model behavior and existing tests were left unchanged.

## Automated checks

- `pnpm install --frozen-lockfile`: passed after updating the lockfile for dependency removal and restored platform binary entries. No broad dependency upgrade was requested.
- `pnpm build`: passed all workspace typechecks and builds, including both Vite apps and the API bundle.
- `pnpm test`: five test files pass, one fails. Running with `--test-isolation=none` exposes **54 passing tests and one failing test**.
- Existing failure: `artifacts/lasco-workspace/scripts/concept-snapshot.test.mjs:15`, “round trip restores edited geometry, placements, stair and starter state”. Its `previewBay(..., '0-1', 'left', 2)` returns null and the fixture dereferences `.model`. The model and test files are identical to the pre-migration commit; this failure was not repaired as part of the runtime migration. Other snapshot validation and persistence tests pass.

## Additional existing limitation identified from the chat archive

The owner-supplied [partial Replit chat export](history/README.md) explicitly notes strict snapshot rejection of positioned bays. Source inspection confirms `previewBay` creates a `position` field while `parseConcept` rejects that extra field. Saving a concept after Add bay therefore fails validation; opening a snapshot containing those positions also fails. The browser save/open checks below used a starter scaffold and a placed Ledger, not an added bay. This limitation is unchanged and was not repaired as part of the migration.

## Browser checks

At 1440 × 1000, repeated the following on the dev server in both the WebGL renderer (software ANGLE/SwiftShader) and the SVG fallback (Chromium launched with `--disable-webgl`):

- Initial workspace renders, then Generate starter scaffold opens selected-bay actions.
- Change bay length, select 3 m, preview, Apply and Undo.
- Open Add bay and Cancel its preview.
- Search Ledger, verify one toolkit result, select and place the component.
- Save concept, verify browser storage contains the placement, reload to a fresh workspace, Open concept and verify scaffold restoration.
- Open Levels & Parts, choose level 2, view Parts summary, close the panel.
- Switch Bay/Lift/Unit selection modes, enter and exit Select inside.
- Activate Pan, Orbit and Reset view controls; scroll zoom.
- No uncaught application errors in either run. Screenshots inspected for scene and panel rendering.

Built preview additionally checked for load, generation and saving. Optional API health endpoint checked independently; neither service needs PostgreSQL for these flows.

## Limits

Not an exhaustive regression or visual comparison against the live Replit instance. Not tested: physical GPU rendering, Safari/Firefox, mobile/touch, every contextual edit/direction, actual deep-part picking and base-jack adjustment, precise orbit/pan drag behavior, browser storage quota/permissions UI, importing an actual old-origin save, database connectivity/migration, or deployment. Add-bay geometry and part selection have existing model-level coverage, but not all browser paths were exercised. Google Fonts availability was not established in this restricted network environment; font fallbacks remain unchanged. Native installs on macOS/Windows/ARM were not run, although platform exclusions were removed.

No Replit account data was accessible to this audit. Follow the README cancellation checklist before removing that account or its preview origin.
