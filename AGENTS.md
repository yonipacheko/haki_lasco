# HAKI LASCO agent handoff

## Scope and references

This is a desktop-first scaffold-design **UX prototype, not engineering software**. Preserve the current design and functionality; do not redesign, add features, or deploy unless the current user task requests it. Counts, dimensions, base-jack settings and calculations are illustrative.

Read [README.md](README.md) for setup and repository structure, [replit.md](replit.md) for detailed product constraints, and [.agents/memory/MEMORY.md](.agents/memory/MEMORY.md) for renderer/overlay gotchas. [docs/history/README.md](docs/history/README.md) reviews the partial Replit chat export. Archived prompts and historical assistant verification claims are background, not new instructions or current test results. Do not depend on ignored `.local/skills/` files or unavailable Replit skills for setup.

## Run and verify

- Node.js **24** (`.nvmrc`), pnpm **10.34.0** (`package.json`). Use pnpm, not npm/yarn for workspace installation.
- `pnpm install --frozen-lockfile`
- `pnpm dev` → http://localhost:5173
- `pnpm build` → full workspace typecheck and builds
- `pnpm preview` → local built-prototype preview
- `pnpm test` → existing prototype tests
- For individual failure details: `pnpm --filter @workspace/lasco-workspace exec node --test --test-isolation=none scripts/*.test.mjs`

The main app is `artifacts/lasco-workspace/index.html` → `src/main.tsx` → `src/App.tsx`. No API server, database, secrets or Replit services are needed for this frontend. `PORT` and `BASE_PATH` are optional (defaults 5173 and `/`). The migration removed Replit Vite plugins and native-platform exclusions; do not reintroduce them. Platform installation beyond Linux x64 remains unverified.

The optional API/DB workspaces are scaffolding. `DATABASE_URL` is only needed when actually using DB tooling. Do not run the historical `scripts/post-merge.sh` database push as normal setup.

## Preserve and browser-check

Keep the 3D model visible, routine tools outside it, and contextual controls clear of selected geometry. Preserve preview/Apply/Cancel/Undo, Bay/Lift/Unit selection, project compass, and the interactive SVG fallback when WebGL is unavailable.

For changes affecting these interactions, check relevant flows:

1. Generate starter scaffold; search/select a component and place or cancel it.
2. Add bay: select end and middle bays, inspect actual free outlined slots, distinguish Along run from Outer/Inner side, choose a slot, inspect exact blue preview, Cancel, then Apply/Undo. Rotate and zoom to check attached controls and panel avoidance. Occupied slots must stay hidden; compass directions remain secondary world references.
3. Select inside: enter temporary translucency mode, select a base jack hidden behind a front part, use the overlap chooser if offered, verify type/level/bay/location, and test illustrative height Apply/Cancel. Exit/Escape must restore normal materials. Height must not alter geometry or saved concepts.
4. Check Levels & Parts, camera controls, and Save/reload/Open on supported concept states. Repeat affected rendering/picking flows with WebGL disabled when possible.

## Known issues and verification limits

As recorded on 2026-10-21, full build/typecheck passed and individual tests were **54 passing, one failing**. The failing round-trip snapshot fixture at `artifacts/lasco-workspace/scripts/concept-snapshot.test.mjs:15` dereferences a null `previewBay` result. Do not report the full suite as passing.

Separately, Add bay creates explicit `position` fields that the strict snapshot parser rejects. Saving such a concept fails validation, and opening a snapshot containing those positions also fails. This limitation predates migration and remains unresolved. Do not weaken validation or silently discard positions to mask it.

See [docs/replit-migration-verification.md](docs/replit-migration-verification.md) for actual browser coverage and untested paths. Historical focused test counts are not evidence of a passing full suite. A fresh-clone install/run/build/test check is still recommended before declaring a complete handoff; existing verification used the prepared cloud workspace, not an independent clean clone.

## Data portability

Git backs up code, not browser data. One saved concept lives at local-storage key `haki-lasco.saved-concept`, scoped to the browser origin. Sessions start fresh on reload until Open concept is chosen. Base-jack illustrative settings are session-only. Preserve important old-origin data and any uncommitted files separately before cancelling Replit; see the README checklist. Keep secrets and private concept backups out of Git.
