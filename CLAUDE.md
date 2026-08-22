# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`hello-pear-bare` — Holepunch boilerplate for a **Bare** (not Node.js) CLI that embeds `pear-runtime` in a Bare worker to get peer-to-peer OTA updates, and ships as a standalone per-platform binary via `bare-build`.

## Commands

```sh
npm start              # bare bin.mjs --no-updates (dev; updates off so local binaries aren't swapped)
npm start -- --updates # dev run with the OTA updater enabled
npm test               # brittle-bare test/index.js
npm run lint           # prettier --check && lunte
npm run format         # prettier --write
npm run make           # detect host platform-arch, delegate to make:<host>
npm run make:win32-x64 # (and darwin/linux × arm64/x64) -> out/<host>/
```

Run a single test with brittle's filter: `npx brittle-bare test/index.js -s "<test name>"`.
Tests execute under the Bare runtime (`brittle-bare`), not Node — `brittle` (Node) will not have the `Bare` global.

`npm start` fails with `INVALID_URL` until `package.json`'s `upgrade` field holds a real `pear://` link (`pear touch` generates one). The placeholder is `pear://<YOUR_KEY_HERE>`.

## Runtime rules

- Application code runs in **Bare**, so use the `bare-*` shims (`bare-os`, `bare-path`, `bare-process`, `bare-storage`) — never Node core modules. The `Bare` global supplies `Bare.argv`, `Bare.IPC`, `Bare.exit()`, `Bare.exitCode`.
- Mixed module systems on purpose: `bin.mjs` is ESM (and imports `package.json` directly); `app.js` and `workers/main.js` are CJS. `scripts/make.js` is the only file that runs under **Node**, so it uses Node builtins.
- `bin.mjs` decides dev vs. standalone by checking whether `Bare.argv[0]` is the `bare`/`bare.exe` binary. That flag drives three things: the argv slice offset (`slice(2)` in dev, `slice(1)` when standalone), the storage dir (tmp in dev, `bare-storage` persistent dir otherwise), and whether the running executable path is handed to the updater. Changing the launch shape means revisiting all three.

## Architecture

`bin.mjs` (CLI, arg parsing via `paparam`, logging, signal handling)
 → `app.js` `App extends ReadyResource` (`_open` spawns, `_close` tears down)
 → `PearRuntime.run('workers/main.js', [...])` — a Bare worker
 → `workers/main.js` is a one-liner: `require('hello-pear-worker')`.

The actual backend (Hyperswarm + Corestore + `pear-runtime` updater) lives in the **`hello-pear-worker` npm dependency**, not in this repo. That module is shared with mobile and desktop parents, so behavior changes to networking/storage/updates belong upstream in `holepunchto/hello-pear-worker`; this repo owns only the CLI parent.

### Worker contract

Two coupled pieces to keep in sync when touching either side:

1. **Positional argv.** `App._open` passes `[updates, version, upgrade, name, dir, app]` as strings; the worker reads them by index (with an offset for BareKit/mobile, where `argv[0]`/`argv[1]` are absent). Order is the whole protocol — an inserted argument silently shifts everything.
2. **Framed string IPC** (`framed-stream` over `Bare.IPC`). Worker→parent: `updating`, `updated`, `pear:updateApplied`; anything else is re-emitted as `App`'s `message` event. Parent→worker: `pear:applyUpdate`, which `app.js` sends automatically on `updated`.

`App` re-emits the lifecycle as events (`message`, `updating`, `updated`, `update-applied`, `error`); `bin.mjs` only logs them.

## Conventions

- Prettier with `prettier-config-holepunch` (no semicolons, single quotes, 2-space, 100 cols) plus `lunte`. Run `npm run format` before committing; CI runs `npm run lint`.
- `.gitattributes` forces LF — do not commit CRLF.
- `out/` and `dist/` are build output and gitignored.
