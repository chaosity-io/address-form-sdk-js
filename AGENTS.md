# AGENTS.md

Notes for anyone — human or coding agent — working in this repository. It covers
what is expensive to rediscover; `README.md` covers usage and `RELEASING.md` the
release procedure.

`@chaosity/address-form` is a drop-in address-capture UI: a form with
autocomplete, a map with a draggable marker, and country filtering, built on
`@chaosity/location-client-react`. It ships in two shapes — a React library and
a standalone bundle for pages that are not React apps.

## Commands

```bash
npm run dev              # vite dev server
npm run storybook        # Storybook on :6006
npm test                 # vitest run --coverage
npm run build            # BOTH builds: lib, then standalone
npm run build:lib        # tsc -b && vite build
npm run build:standalone # tsc -b && vite build --config vite.config.standalone.ts
npm run lint             # eslint . AND prettier --check .
npm run lint:fix         # eslint --fix . && prettier --write .
```

`npm test` always collects coverage — there is no faster bare-run script.
`npm run lint` runs Prettier too, so a formatting-only problem fails lint; use
`lint:fix`.

### The push gate

`.husky/pre-push` runs `npm ci --dry-run` (lockfile drift), `npm run lint`,
`npm test`, then **`npm run build`** — which here is BOTH builds, lib and standalone, so a
push takes a while and fails if either bundle breaks. Type errors that vitest
tolerates are stopped here.

## Two entry points, two builds

| Entry                     | Built by           | For                                        |
| ------------------------- | ------------------ | ------------------------------------------ |
| `lib/main.tsx`            | `build:lib`        | the React library — the published package  |
| `lib/main-standalone.tsx` | `build:standalone` | a self-mounting bundle exposing `render()` |

`npm run build` runs both, and **both must be run before publishing** —
`prepublishOnly` does this for you. Building only the lib silently ships a
stale standalone bundle.

The standalone entry imports `maplibre-gl/dist/maplibre-gl.css` and the
package's own stylesheet, because a non-React host has no bundler step to do it.
The library entry deliberately does **not**: a React consumer controls its own
CSS pipeline, and importing global CSS from a library entry breaks SSR builds.

Source lives in `lib/`. `src/` holds Storybook stories only — it is not the
package.

## The `__`-prefixed exports are not public API

`lib/main.tsx` exports `__AddressForm` and `__AddressFormMap` from
`./components/AddressForm`. The underscore prefix is the signal: they exist for
the standalone bundle and internal composition, and are not part of the
supported surface. Consumers want `AddressForm` from
`./components/AddressFormReact`. Do not document the `__` names, and do not
treat a change to them as breaking.

## `IntendedUse` is not ours to send

The Location Service decides the AWS pricing bucket; it never forwards
`IntendedUse` (or `Key`) to Amazon Location. A request carrying
`IntendedUse: "Storage"` is answered exactly as one without it, and the service
caches both under the same entry — so issuing a second lookup "for storage
rights" buys nothing and is billed as a second request.

This form used to do precisely that on submit. It was removed in 0.4.0 along
with `getData`'s `intendedUse` argument. Do not reintroduce either.

## Version floors that exist for a reason

**`@headlessui/react` must stay at or above `2.2.10`.** Versions up to `2.2.9`
throw a `DataInteractive` Fragment error on cold loads under React 19 with a
React-Server-Components host — which is exactly how this SDK gets consumed. The
manifest range is `^2.2.2`, so the lockfile is what actually holds the floor; a
lockfile regeneration that resolves lower reintroduces a crash that only appears
on a cold load and will not reproduce locally in a warm dev server.

**React 19 only.** The peer range is `^19.0.0` for both `react` and `react-dom`
— no React 18. That is a deliberate narrowing, not an oversight.

## Peer ranges are open on purpose

```json
"@chaosity/location-client": ">=0.3.0",
"@chaosity/location-client-react": ">=0.2.0"
```

`>=`, not `^`. Both of those are pre-1.0, and npm treats each `0.x` minor as
incompatible — a caret range would refuse every upstream release after the
pinned minor and force a lockstep bump here for each one.

The cost is that npm gives no warning when an upstream break lands; it surfaces
at runtime in a consumer's app. So an upstream change to what this package
consumes needs a matching change here in the same cycle.

This package is itself `0.x`, so **its own breaking changes go in the MINOR** —
`^0.3.0` will never resolve `0.4.0`, and that is the only signal a consumer
gets.

## Conventions

- Styling is **vanilla-extract** (`.css.ts`), compiled at build time. Do not add
  a runtime CSS-in-JS library alongside it.
- State: `zustand` stores in `lib/stores`, forms via `react-hook-form`, server
  state via `@tanstack/react-query`. Reach for the one already in use.
- Tests are vitest with `lib/setup-tests.ts`; `lib/stories.test.tsx` renders the
  Storybook stories, so a broken story fails the suite.
- Prettier runs with `prettier-plugin-organize-imports` — do not hand-sort
  imports.
