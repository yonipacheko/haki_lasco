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

The demo supports starter scaffold generation, bay/lift/unit selection, snapped component placement, scaffold configuration, and a level/parts comparison panel. State is session-only; no construction validation or verified calculations are provided.

Keep the current visual style and working features when refining contextual editing. Do not restore an always-visible Properties inspector or put routine settings in a centered dialog. Place compact, temporary controls near the selection when there is room, otherwise in a nearby clear area; never cover the selected object. Label each action's scope explicitly. Detailed choices open only after an action is chosen and close after applying or cancelling. Scaffold-changing actions preview their result before Apply, Add bay offers only available directions, and completed edits can be undone. Preserve the interactive rendering fallback when WebGL is unavailable.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
