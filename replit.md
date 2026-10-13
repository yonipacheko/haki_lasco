# HAKI Lasco Workspace

An interactive desktop-first UX demonstration of scaffold design around a simple building.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

The user explicitly requested a UX demonstration, not production scaffolding or engineering software. Keep the 3D model visible, dock routine tools and settings outside it, and clearly label all sample counts, dimensions and indicators as illustrative.

The demo supports starter scaffold generation, bay/lift/unit selection, snapped component placement, scaffold configuration, and a level/parts comparison panel. It starts fresh on reload. Explicit Save concept and Open concept actions use one validated, versioned browser-local snapshot; saving replaces the previous save and excludes active previews. Opening is undoable. This is not server-backed storage or collaboration, and no construction validation or verified calculations are provided.

Keep the current visual style and working features when refining contextual editing. Do not restore an always-visible Properties inspector or put routine settings in a centered dialog. Place compact, temporary controls near the selection when there is room, otherwise in a nearby clear area; never cover the selected object. Label each action's scope explicitly. Detailed choices open only after an action is chosen and close after applying or cancelling. Scaffold-changing actions preview their result before Apply, Add bay offers only available directions, and completed edits can be undone. Preserve the interactive rendering fallback when WebGL is unavailable.

Keep the entire scaffold, including blue preview geometry, framed in the unobstructed canvas when contextual actions or Levels & Parts open. Preserve the orbit angle and a steady view when panels close rather than restoring an earlier camera. Layout checks should not apply demo edits.

Add bay choices are the actual free neighboring slots, shown with outlined positions and attached controls. Distinguish extending the current run from adding on its outer or inner side. Compass directions are secondary world references, never screen-left/right placement rules. Controls must follow their intended slot through orbit, retain readable screen size during zoom, and keep the selection and nearby details clear. Preview the exact chosen slot before Apply; hide occupied positions. Add bay refinements must preserve the compass, deep-part selection, and the other Bay, Lift, and Unit actions.

The persistent compass shows project orientation, not measured geographic North. Keep its North accent blue, its letter labels upright and high contrast, and its screen size independent of zoom. Its needles follow camera rotation without changing scaffold orientation or editing interactions.

Select inside is a temporary part-inspection mode, separate from normal Bay/Lift/Unit selection. Reveal hidden components through reversible translucency and identify a specific part by type, level, bay, elevation, and position. If parts overlap under the pointer, offer the actual hit parts rather than invisible selection volumes. Exit must restore normal materials. Base jack height is an illustrative, session-only setting: Apply/Cancel do not change scaffold geometry, perform engineering calculations, or alter saved concepts. Preserve Add bay, the compass, and the existing Bay/Lift/Unit actions.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
