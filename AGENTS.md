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
npm run test:dist        # after a build: pack the package and load it as an application does
npm run lint             # eslint . AND prettier --check .
npm run lint:fix         # eslint --fix . && prettier --write .
```

`npm test` always collects coverage — there is no faster bare-run script.
`npm run lint` runs Prettier too, so a formatting-only problem fails lint; use
`lint:fix`.

### The push gate

`.husky/pre-push` runs `npm ci --dry-run` (lockfile drift), `npm run lint`,
`npm test`, then **`npm run build`** — which here is BOTH builds, lib and standalone, so a
push takes a while and fails if either bundle breaks — and last `npm run test:dist`
on what the build produced. Type errors that vitest tolerates are stopped here.

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
So the build extracts all of it, the form's styles and MapLibre's, into
`dist/lib/address-form.css`, and the README's React example imports that file
itself. Without the line, the example rendered its suggestion list over the
fields and the map's controls as bare buttons (#29).

Source lives in `lib/`. `src/` holds Storybook stories only — it is not the
package.

### MapLibre's worker

maplibre-gl 6 runs its worker from a module file, `maplibre-gl-worker.mjs`,
which imports `maplibre-gl-shared.mjs` from beside it. It finds that file from
its own `import.meta.url`, which a bundler rewrites and a UMD build replaces
with `{}`, and without it the map mounts and draws no tile. So:

- the React library cannot know where an application serves the file, and
  `AddressForm.Map` takes `workerUrl`, which react-map-gl hands to
  `setWorkerUrl` before it builds the map. The README's example passes it;
- the standalone bundle carries the worker. `vite-plugin-maplibre-worker.ts`
  bundles it and the chunk it imports into one module string, and
  `main-standalone.tsx` hands MapLibre a `blob:` URL of it. Both Vite configs
  load the plugin, because `npm run dev` serves the standalone entry too. A
  page with a Content Security Policy needs `worker-src blob:`, as it did for
  maplibre 5's UMD build;
- Storybook sets the worker in `.storybook/preview.tsx` with Vite's
  `?worker&url`.

`lib/maplibre-6.test.ts` holds the README's maps to `workerUrl` and the
standalone entry to its `setWorkerUrl` call.

### The library is ESM and CommonJS, and `exports` picks

`build:lib` emits `address-form-sdk.mjs` and `address-form-sdk.cjs.js`, and
`package.json` `exports` sends `import` to the first and `require` to the
second. Until #29 it was CommonJS only, and that broke the README's own
example: client-react ships separate import and require builds, each calling
`createContext`, so the provider an application imported and the one the
form's hooks read were two copies, and the form threw "useLocationClient must
be used within LocationClientProvider" under a provider it could not see. A
dependency the library **bundles** has the same effect by another route: its
copy is private, and nothing the application renders reaches it. That is why
`@tanstack/react-query` is external in `vite.config.ts`. Anything holding a
React context that an application might also provide stays external.

Vitest cannot see any of this: it compiles `lib/` from source. So
`scripts/smoke-dist.mjs` (`npm run test:dist`) packs the package, unpacks it
beside this repo's installed dependencies, renders the README tree from ESM
and from CommonJS, and fails on any package the library loads through its
`require` build while it has an `import` build. It takes any `npm pack` spec
too: `node scripts/smoke-dist.mjs @chaosity/address-form@0.5.0` shows the
failure on the last CommonJS-only release.

`./dist/*` is exported as it stands, so deep imports that worked before an
`exports` map existed keep working, such as the stylesheet at
`@chaosity/address-form/dist/lib/address-form.css`.

**Both conditions share one set of declarations, `dist/lib/main.d.ts`**, and
this package is not `"type": "module"`. So a TypeScript consumer on
`moduleResolution: node16` or `nodenext` that imports from ESM gets the types
as CommonJS. It compiles with `skipLibCheck`, which the Vite and Next.js
templates set. With `skipLibCheck` off it reports one `TS1479` in
`components/Map/index.d.ts`, and it did the same on 0.5.0, before `exports`
existed. Consumers on `bundler` resolution are unaffected. A separate
`main.d.mts` for the `import` condition would need rolled-up declarations,
because a `.d.mts` needs file extensions on its relative imports. Accepted as
it stands (26 Sep 2026); revisit if a `node16` consumer reports it.

## A component that reads the provider handles `client: null`

`useLocationClient()` returns `client: null` twice over: until the provider's
first `getConfig` answers, and after one fails until a retry succeeds. Neither
is a missing provider — `useLocationClient` itself throws for that. So:

- never throw on a null client while rendering. The form used to, and one
  failed `getConfig` unmounted every address field, and under `render()` the
  page's own inputs too (#30). `getData()` rejecting at submit, when `verify`
  has no client to verify with, is a rejection the integrator handles, not a
  render;
- never send with one, or with a token that is not there yet: no query, no
  autofill lookup, no map. The typeahead's query is `skipToken` without a
  client, and the map mounts only once one exists (#25);
- the form says why in its banner (`LocationClientStatus`, mounted by
  `AddressFormProvider`, so both forms carry it), and every field stays a
  plain, typeable input.

## The `__`-prefixed exports are not public API

`lib/main.tsx` exports `__AddressForm` and `__AddressFormMap` from
`./components/AddressForm`. The underscore prefix is the signal: they exist for
the standalone bundle and internal composition, and are not part of the
supported surface. Consumers want `AddressForm` from
`./components/AddressFormReact`. Do not document the `__` names, and do not
treat a change to them as breaking.

## Keeping an address is `verify`, never `IntendedUse`

The Location Service decides the AWS pricing bucket; it never forwards
`IntendedUse` (or `Key`) to Amazon Location. A request carrying
`IntendedUse: "Storage"` is answered exactly as one without it, so a second
lookup "for storage rights" buys nothing and is billed as a second request.
This form used to make exactly that lookup on submit. It was removed in 0.4.0,
along with `getData`'s `intendedUse` argument. Do not reintroduce either.

The storable path is address verification (#21). With `verify` on, `getData()`
sends the chosen PlaceId to `POST /address/verify` as a `VerifyAddressCommand`
through the provider's `send`, and returns `verified` plus `verification`.
`verification` is the one Places result an integrator may store. The service
sets the storage terms itself, so the request carries the PlaceId and nothing
else. `lib/components/AddressFormReact/use-get-data.ts` is the one place that
calls it, and both submit sites (`AddressForm.tsx`, `render.tsx`) use it.
Three rules there cost money or correctness if broken:

- **Once per PlaceId per form.** Every verify is billed, whether or not the
  address verifies. A failure is not kept.
- **Only while the form still reads what set the PlaceId.** The provider
  snapshots the picked fields whenever `placeId` is written: by a pick, or by
  the autofill handler resolving the browser's text to its best match (the
  place the map pin and `addressDetails` already show). A hand edit of those
  fields afterwards means no call: the PlaceId no longer describes what is
  being submitted.
- **Never while typing.** The call is made in `getData()`, which the
  integrator calls.

`placeId` is the PlaceId that was chosen and sent, never the one a GetPlace
response carries: `buildOutput` in the Typeahead takes it as an argument, and
the locate button and the autofill handler keep the one they looked up. Asked
for a unit, Amazon answers with a different PlaceId that every Places route
then fails upstream (a 502, measured 25 Sep 2026). Recording the response's id
made every unit's verification fail. `lib/components/Typeahead/chosen-place-id.test.tsx`
holds the three pick paths to it, and `verify.test.tsx` the autofill one.

It needs `@chaosity/location-client` 0.10.0 or later, the release that added
the command. Any supported `@chaosity/location-client-react` works, because it
goes through `send`.

## Version floors that exist for a reason

**`maplibre-gl` must stay at or above `6.4.1`**, the first release that fixes
GHSA-jrc7-96c5-q579, a critical XSS in the attribution control. There is no 5.x
fix. It is a dependency, so the range is what every React consumer installs,
and the standalone bundle carries whichever copy the lockfile installed.
`lib/maplibre-6.test.ts` holds the range and every lockfile copy to it, and
`npm run test:dist` checks that the built bundle carries the installed copy.

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
"@chaosity/location-client": ">=0.11.0",
"@chaosity/location-client-react": ">=0.9.0"
```

`>=`, not `^`. Both of those are pre-1.0, and npm treats each `0.x` minor as
incompatible — a caret range would refuse every upstream release after the
pinned minor and force a lockstep bump here for each one.

Each floor is the oldest release this package's own code and types work with,
or that this package's own dependencies can install beside, and it moves only
when that changes. The client's went from `0.3.0` to
`0.10.0` with `verify` (#21): `lib/utils/api.ts` imports `VerifyAddressCommand`,
and the published types name `VerifyAddressResponse`, so below `0.10.0` a
submit with `verify` on fails and the declaration files do not compile.
client-react's went from `0.2.0` to `0.8.0` (#16, #30): the map builds its
style from the `apiUrl` the provider puts on its context, which 0.8.0 added,
and the form's banner promises that a failed `getConfig` is retried, which
0.8.0 does. Then both moved again, for a dependency rather than for code:
this package depends on `maplibre-gl` 6, and npm refuses to install it beside
client below `0.11.0` or client-react below `0.9.0`, whose peer ranges admit
only MapLibre 5 (ERESOLVE, measured). So `0.11.0` and `0.9.0` are the oldest
releases an install can have, and the floors say so rather than leaving npm to
name the MapLibre peer.

`@tanstack/react-query` is a peer too, and an ordinary caret one (`^5.25.0`),
because it is past 1.0. It is a peer rather than a dependency so that the
application and the library share one copy: the exported `Typeahead` and
`LocateButton` read the application's `QueryClientProvider`, which a nested
second copy cannot see (#29). The floor is the release that added `skipToken`,
which the typeahead's query uses (#30). The devDependency is what this repo
builds and tests with.

The cost is that npm gives no warning when an upstream break lands; it surfaces
at runtime in a consumer's app. So an upstream change to what this package
consumes needs a matching change here in the same cycle.

This package is itself `0.x`, so **its own breaking changes go in the MINOR** —
`^0.3.0` will never resolve `0.4.0`, and that is the only signal a consumer
gets.

### The devDependencies are moved by hand — and the standalone bundle ships them

`devDependencies` pins both packages with an ordinary caret, and a caret on a
`0.x` version never crosses the minor. So while the peer ranges let every
consumer install the newest releases, this repo builds and tests against
whichever minors the carets were last moved to, and nothing moves them for you
(#20).

Here that is not only a development concern. `vite.config.standalone.ts` has no
`external` — the standalone bundle must be self-contained — so
`dist/standalone/address-form-sdk.umd.js` **contains whatever `@chaosity`
versions the lockfile installed**, and every page that calls `render()` runs
those, whatever it installs itself. (The library build externalises both, so a
React consumer's own versions are the ones used there.)

So before a release, and whenever either upstream package ships a minor:

```bash
npm ci                                                                    # npm outdated reads the installed tree; without one it reports nothing
npm outdated @chaosity/location-client @chaosity/location-client-react   # Wanted ≠ Latest: the range cannot reach the release
npm install -D @chaosity/location-client@latest @chaosity/location-client-react@latest   # writes ^<latest> — `-D`, or they land in dependencies
rm -rf node_modules && npm ci                                             # the lockfile proof
```

At a release, `RELEASING.md` has the order, including the commit `npm version`
needs.

Always move the two together. A client-react old enough to declare the client
as a `dependency` rather than a peer (0.3.x did) installs its own nested copy,
and the standalone bundle then carries two clients. Count them with
`grep -o 'location-client:api' dist/standalone/address-form-sdk.umd.js | wc -l`
— one per client copy, since each registers its own debug namespace.

## Conventions

- Styling is **vanilla-extract** (`.css.ts`), compiled at build time. Do not add
  a runtime CSS-in-JS library alongside it.
- State: `zustand` stores in `lib/stores`, form data in `AddressFormContext`
  (`AddressFormProvider`), server state via `@tanstack/react-query`. Reach for
  the one already in use. `react-hook-form` is declared but nothing imports it
  (#33).
- Tests are vitest with `lib/setup-tests.ts`; `lib/stories.test.tsx` renders the
  Storybook stories, so a broken story fails the suite.
- Prettier runs with `prettier-plugin-organize-imports` — do not hand-sort
  imports.
