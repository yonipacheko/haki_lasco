# Prototype verification handover

## Scope

Focused desktop browser smoke test of the existing HAKI Lasco prototype, followed
by two small fixes. No features, geometry changes, design changes, broad
refactors, dependency changes, or deployment changes.

The user authorized proceeding after being told that a hard $5 spending cap
could not be enforced. Actual spend was not available or verified. Testing was
limited; a slow targeted recheck was stopped rather than allowed to continue.

## Browser checks performed

Fresh isolated browser context at 1440 × 900, using development preview `/`.
The initial pass ended at 12 bays across three lifts.

| Interaction | Observed result |
| --- | --- |
| Generate starter scaffold | Passed: 12 bays across three lifts. |
| Bay / Lift / Unit mode buttons | Passed: each mode activated; Bay 1 · East selected through the Levels reference selector. This does not establish spatial picking coverage in every mode. |
| Add bay, North along-run | Passed: snapped preview, Apply to 13 bays, Undo to 12. |
| Add bay, East outer-side | Passed: preview then Cancel left 12 bays. |
| Decking | Passed: preview of None, then Cancel restored Included. Apply/Undo was not exercised in the browser. |
| Toolkit | Passed: search for jack, open Base jack placement preview, cancel without placement. |
| Select inside | Selected the Bay 03 North Level 1 inner-edge start-post Base jack from the actual overlap list. Applied a 300 mm illustrative session setting; exit restored normal mode. A pointer interception bug required keyboard selection before the fix below. |
| Save baseline | Passed for the unextended 12-bay scaffold. |
| Save extended scaffold | Failed before fix: Save at 13 bays reported “Saved concept is malformed. Current concept unchanged.” |
| View controls | Orbit/Pan/Reset controls activated; Pan notification appeared and compass stayed visible. Actual orbit/pan dragging and a clear wheel zoom scale change were not verified in this pass. |
| Browser console | No application errors observed in the completed pass. |

Only isolated test-browser storage was used. No published deployment or user
concept storage was exercised.

## Fixes made

### 1. Save/Open rejected added bays

**Reproduction:** generate starter, select East Bay 01, add the North along-run
bay, Apply, then Save concept. The live scaffold had 13 bays but Save rejected
the concept.

**Cause:** added bays have an optional `position: { x, z }`; snapshot validation
only accepted the original five bay fields.

**Fix:** accept and preserve the optional position, require exactly numeric
finite `x` and `z` coordinates, and retain strict rejection of malformed or
unexpected fields. Older snapshots without a position still parse. Snapshot
version and storage key are unchanged. Existing application actions are
unchanged.

Updated the outdated round-trip test fixture from screen-relative `left` to the
current world-direction `North`. Added tests for saving/reopening an added bay
at its exact position, detached loaded data, legacy saves, and malformed
position rejection.

### 2. Levels toggle intercepted an overlap chooser row

**Reproduction:** in Select inside, open the overlap list near the lower canvas
edge and click the Bay 03 base-jack row. The Levels toggle could intercept the
pointer; keyboard focus plus Enter selected the correct row.

**Fix:** elevate the existing inside overlay only while its chooser is open,
above the Levels toggle. The overlay remains pointer-transparent outside its
existing controls. No layout, geometry, chooser content, or normal-mode
behavior was changed.

## Verification after fixes

Passed:

```sh
pnpm --filter @workspace/lasco-workspace test
# 57 tests passed, 0 failed

pnpm --filter @workspace/lasco-workspace run typecheck

PORT=18258 BASE_PATH=/ pnpm --filter @workspace/lasco-workspace run build
```

The managed frontend workflow was restarted once after the fix batch and
started successfully. Logs showed no new frontend application errors.
The production build still reports the pre-existing large JavaScript chunk
warning; optimization was outside scope.

## Not verified / next checks

- A targeted browser recheck was started for Save → reload → Open of the
  positioned 13th bay and an unforced mouse click on the previously obstructed
  chooser row. It did not return a completed result and was stopped to limit
  cost. **Do not treat either fix as browser-reverified.**
- Save/Open position preservation and validation are covered by passing unit
  tests. The chooser layering fix has not received a completed post-fix
  browser confirmation.
- Post-fix browser state was not confirmed after stopping that recheck; use a
  fresh test context for the next verification.
- Actual orbit/pan drags, clear zoom behavior, spatial picking in every normal
  selection mode, decking Apply/Undo, all part placement variants, removal
  flows, and lift addition/removal were not comprehensively exercised.
- No mobile, cross-browser, fresh-clone, non-Linux, production, backend,
  database, collaboration, or engineering verification was performed.
- The full monorepo build/typecheck was not run; checks above target the
  frontend artifact.

## Running the existing frontend

Use Node.js 24 and pnpm from the repository root. The Vite configuration requires
both `PORT` and `BASE_PATH`:

```sh
pnpm install --frozen-lockfile
PORT=3000 BASE_PATH=/ pnpm --filter @workspace/lasco-workspace run dev
```

This demo is frontend-driven. Saved concepts remain browser-local, and base-jack
illustrative settings are session-only; neither is an engineering calculation.
See `replit.md` for the existing product constraints. Cross-platform package
overrides and broader portability cleanup were not changed in this task.
