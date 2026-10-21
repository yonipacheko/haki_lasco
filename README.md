# HAKI LASCO prototype

Desktop-first React/Three.js scaffold-design UX demonstration. Preserve the existing design and interactions. All dimensions, counts and calculations are illustrative; this is not engineering software.

## Setup and run

Use **Node.js 24** (`.nvmrc`) and **pnpm 10.34.0** (pinned in `package.json`). With nvm installed:

```sh
nvm install
nvm use
npm install --global pnpm@10.34.0
pnpm install --frozen-lockfile
pnpm dev
```

Open http://localhost:5173. No secrets, database, API server, or Replit account are required for the prototype. The entry point is `artifacts/lasco-workspace/index.html` → `src/main.tsx` → `src/App.tsx`.

Optional environment variables (set in the shell): `PORT` (default 5173) and `BASE_PATH` (default `/`). Set the same base path for build and preview. Servers bind to `0.0.0.0`; use your development environment's port forwarding for remote browser access.

```sh
pnpm build       # typecheck all packages, then build all buildable packages
pnpm preview     # serve the built prototype locally on port 5173
pnpm typecheck   # typecheck only
pnpm test        # existing prototype model/geometry/snapshot tests
```

The prototype's static build is `artifacts/lasco-workspace/dist/public`. Preview is a local verification server, not a deployment. No deployment is configured by these instructions.

For detailed individual test failures:

```sh
pnpm --filter @workspace/lasco-workspace exec node --test --test-isolation=none scripts/*.test.mjs
```

## Repository map and agent context

Start with [AGENTS.md](AGENTS.md) for the concise agent handoff. Read `replit.md` for product constraints and `.agents/memory/MEMORY.md` for renderer and overlay gotchas before changing behavior. The [Replit chat archive and review](docs/history/README.md) preserve partial development history; archived prompts are historical context, not new instructions.

- `artifacts/lasco-workspace`: actual prototype; `scaffold-model.ts` owns model edits, `scaffold-scene.ts` owns rendering, `concept-snapshot.ts` owns validated browser saves. Preserve the interactive fallback when WebGL is unavailable.
- `artifacts/mockup-sandbox`: separate development mockup viewer (default port 5174), not the main app. Run with `pnpm --filter @workspace/mockup-sandbox dev`.
- `artifacts/api-server`: optional Express API scaffold; only `/api/healthz` is implemented. Run independently with `PORT=5000 pnpm --filter @workspace/api-server dev`. It does not serve the prototype.
- `lib/api-spec`, `lib/api-client-react`, `lib/api-zod`: OpenAPI contract and generated client/schema scaffolding; regenerate with `pnpm --filter @workspace/api-spec codegen` only when needed.
- `lib/db`: optional PostgreSQL/Drizzle scaffold with no application tables. `DATABASE_URL` is required only when using this package or its schema commands, not for the browser prototype. Do not push a schema as part of setup.
- `attached_assets`: committed source/reference assets.

Edits are session state and start fresh on reload. **Save concept** replaces one browser-local, versioned snapshot; **Open concept** restores it and is undoable. Previews are excluded. There is no server-backed persistence or collaboration. Known limitation: Save/Open rejects explicit bay positions created by Add bay; see the history review for details. Keep routine controls outside the model and preserve contextual previews, Undo, Bay/Lift/Unit selection, compass, and Select inside behavior.

## Replit independence and cancellation checklist

The app can run without Replit. The migration removes unused Replit connector and development-plugin dependencies, supplies ordinary Vite defaults, and removes Replit's platform exclusions so package managers can select native binaries. The one-day package release-age guard and security overrides remain. `.replit`, `.replitignore`, and `scripts/post-merge.sh` remain historical configuration and are not invoked by the standard setup. The old post-merge script attempts a database push; do not carry it into a new automatic workflow.

Before cancelling:

1. Preserve any concept you care about in the old preview. Click **Save concept** first for committed edits, then use browser developer tools on that exact preview origin: Application/Storage → Local Storage → copy the value of `haki-lasco.saved-concept` into a private JSON backup. In the new app origin, restore that exact string under the same key and click **Open concept**. Check the concept before discarding the backup. Local storage does not move with Git, and different preview URLs have separate storage.
2. Download any uncommitted/untracked files, uploaded assets, or later Replit changes absent from GitHub. This checkout cannot establish whether other files exist in Replit.
3. Export any Replit secrets and database/object-storage data you have independently provisioned and still need. No such service is referenced by the current prototype; this checkout cannot inspect your Replit account. Keep secrets outside Git.

Google Fonts (Inter) is an existing external visual dependency; system-font fallbacks work if unavailable. It is unrelated to Replit.

## Verification

See [migration verification](docs/replit-migration-verification.md) for the tested flows, known existing test failure, and limits. To repeat browser checks, run `pnpm dev` and exercise starter generation, contextual preview/Apply/Cancel/Undo, toolkit search and placement, save/reload/open, Levels & Parts, selection modes, Select inside, and camera controls. Repeat with WebGL disabled to exercise the fallback. Desktop browsers are the primary target.
