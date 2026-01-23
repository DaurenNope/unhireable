# Repository Structure & Guardrails

This repo is intentionally small so the desktop job tracker stays easy to ship. Keep every contribution inside the structure below unless you have written approval to expand it.

## Root Layout

```
frontend/    # React + Vite UI (TypeScript only)
src-tauri/   # Rust shell, commands, sqlite migrations, assets
docs/        # Product, process, tech, testing, tickets
tools/       # Scripts, helper utilities, local tooling
labs/        # Archived experiments and research (optional)
```

- No additional top-level services or packages.
- Generated artifacts (`node_modules`, `dist`, `target`, `*.db`) must stay out of git.
- Docker, Kubernetes, and cloud infra live outside this repo unless we explicitly reintroduce them.

## Frontend Rules

- Only TypeScript/TSX sources under `frontend/src`.
- `tsconfig.json` enforces `allowJs: false`; do not add plain `.js` files.
- Keep APIs under `frontend/src/api`, UI components under `frontend/src/components`, etc. Remove dead folders when migrating code.

## Tauri Backend Rules

- `src-tauri/` holds Rust code, migrations, and static assets.
- Delete build outputs (`src-tauri/target`, packaged binaries) before committing.
- Keep SQLite migrations under `src-tauri/migrations/sqlite` (or the current path referenced by the app).

## Docs Layout

```
docs/
  product/   # user flows, UX briefs, personas
  tech/      # implementation notes, fixes, architecture
  process/   # status updates, plans, repo rules
  testing/   # guides, reports, tooling notes
  tickets/   # backlog items (flat files with ticket-* naming)
```

- New markdown files start inside one of these folders.
- Use kebab-case filenames (e.g., `docs/product/application-flow.md`).
- Keep root-level markdown limited to `README.md`, `RUN_APP.md`, and `TESTING_GUIDE.md`.

## Tools & Scripts

- Developer scripts live in `tools/scripts/`. Reference them via `./tools/scripts/<name>.sh`.
- Remove unused helpers rather than leaving them at the root.

## Labs

- `labs/` stores archived experiments (automation agents, discovery prototypes, research notes, reference assets).
- Nothing inside `labs/` is considered shipping code; do not import from it.
- Move retired services (e.g., Python intelligence agent) here or delete them entirely.

## Off-Limits Areas

- No new Docker Compose stacks, Prometheus/Grafana configs, or cloud infrastructure directories.
- No resurrection of the legacy Python `intelligence-agent` microservice without an approved plan.
- Do not add new databases beyond the bundled SQLite instance unless the plan is documented in `docs/process/`.

## Adding New Content

1. Decide whether it belongs in `frontend/`, `src-tauri/`, `docs/`, `tools/`, or `labs/`.
2. Follow the folder-specific rules above.
3. Update this document if the canonical layout changes.

These guardrails are mirrored in `.cursorrules`; keep both up to date.

