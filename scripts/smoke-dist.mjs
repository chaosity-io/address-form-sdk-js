/**
 * Loads the PUBLISHED SHAPE of the package the way an application does, and
 * renders the README's React example with it (#29).
 *
 *   npm run build && npm run test:dist             # this repository, packed
 *   node scripts/smoke-dist.mjs <spec>             # anything `npm pack` takes,
 *                                                  # e.g. @chaosity/address-form@0.5.0
 *
 * The library used to ship CommonJS only. An application's `import` of
 * `@chaosity/location-client-react` got that package's ESM build, while the
 * library's `require` got its CJS build: two copies, so two contexts, and the
 * README's example threw "useLocationClient must be used within
 * LocationClientProvider" with the provider right there in the tree. The unit
 * suite cannot see that. Vitest compiles `lib/` from source and never loads
 * `dist/` through the package's `exports`.
 *
 * So this packs the package, which is exactly what npm would publish, `files`
 * and `exports` included, and unpacks it into a scratch `node_modules` beside
 * links to this repository's installed dependencies, which is how a deduped
 * install shares one copy of each. Then it runs one consumer per module
 * system:
 *
 * - ESM renders the README tree, resolves the stylesheet the README's example
 *   imports, and renders the exported `Typeahead` under the application's own
 *   providers. It then fails on any package the library
 *   requires through its `require` build when it also has an `import` build:
 *   that is a second copy, and a second copy of anything holding a React
 *   context splits it. A dependency the library bundles instead is a copy the
 *   application cannot reach at all, which the `Typeahead` case catches for
 *   `@tanstack/react-query`.
 * - CJS renders the README tree through `require`, which must keep working.
 *
 * Rendering is `renderToString`: it runs every hook a first render runs, and
 * no effect, so `getConfig` is never called and nothing touches the network.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NAME = "@chaosity/address-form";

/** The README's React example (README.md, "Usage"), without JSX. */
const README_TREE = `
const pending = () => new Promise(() => {});
const input = (name) => h("input", { "data-type": "address-form", name });
const readmeTree = () =>
  h(LocationClientProvider, { getConfig: pending },
    h(AddressForm, { onSubmit: async () => {} },
      h(Flex, { direction: "row", flex: true },
        h(Flex, { direction: "column" },
          input("addressLineOne"), input("addressLineTwo"), input("city"),
          input("province"), input("postalCode"), input("country"),
          h(Flex, { direction: "row" },
            h("button", { "data-type": "address-form", type: "submit" }, "Submit"),
            h("button", { "data-type": "address-form", type: "reset" }, "Reset"))),
        h(AddressForm.Map, { mapStyle: ["Standard", "Light"], workerUrl: "/maplibre/maplibre-gl-worker.mjs" }))));

let failed = false;
const check = (label, element, expect) => {
  try {
    const html = renderToString(element());
    if (!expect.test(html)) throw new Error("rendered, but without " + expect);
    console.log("ok      " + label);
  } catch (error) {
    failed = true;
    console.log("FAILED  " + label + ": " + (error instanceof Error ? error.message : error));
  }
};
`;

const ESM_CONSUMER = `
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { LocationClientProvider } from "@chaosity/location-client-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Through the namespace rather than named imports: a CommonJS build's named
// exports are only as visible to Node as its lexer can see, and a failure here
// has to be about which copy was loaded, not about that.
const library = await import("@chaosity/address-form");
const { AddressForm, Flex, Typeahead } = library.default ?? library;

${README_TREE}

check("ESM: README tree, provider from @chaosity/location-client-react", readmeTree, /name="addressLineOne"/);

// The stylesheet the README's example imports, resolved through \`exports\` as a
// bundler resolves it: the library build extracts its CSS and imports none (#29).
const readme = readFileSync(join(dirname(fileURLToPath(import.meta.resolve("@chaosity/address-form/package.json"))), "README.md"), "utf8");
const stylesheet = readme.match(new RegExp('^import "(@chaosity/address-form/[^"]+[.]css)";$', "m"))?.[1];
try {
  if (!stylesheet) throw new Error("the README's React example imports no stylesheet");
  if (!existsSync(fileURLToPath(import.meta.resolve(stylesheet)))) throw new Error(stylesheet + " is not in the package");
  console.log("ok      ESM: the README's stylesheet resolves: " + stylesheet);
} catch (error) {
  failed = true;
  console.log("FAILED  ESM: the README's stylesheet: " + (error instanceof Error ? error.message : error));
}

check(
  "ESM: exported Typeahead under the application's QueryClientProvider",
  () =>
    h(QueryClientProvider, { client: new QueryClient() },
      h(LocationClientProvider, { getConfig: pending },
        h(Typeahead, { name: "addressLineOne", apiName: "autocomplete", value: "", onChange() {}, onSelect() {} }))),
  /name="addressLineOne"/,
);

// Does a conditions object route "import" and "require" to different files?
const splits = (conditions) =>
  !!conditions &&
  typeof conditions === "object" &&
  (("import" in conditions && "require" in conditions) || Object.values(conditions).some(splits));

const manifestOf = (file) => {
  for (let dir = dirname(file); dir !== dirname(dir); dir = dirname(dir)) {
    const path = join(dir, "package.json");
    if (!existsSync(path)) continue;
    const manifest = JSON.parse(readFileSync(path, "utf8"));
    // A build directory's own package.json ({"type": "commonjs"}) has no name.
    if (manifest.name) return manifest;
  }
};

// Only what the library itself requires. A dependency's own CommonJS requires
// (the AWS SDK loads its core that way) happen just the same when the
// application imports that dependency directly, and are not this package's.
// \`children\`, not each module's \`parent\`: a parent is only whoever required it
// first, and client-react's own CommonJS build gets to the client before the
// library does.
const libraryDist = join(dirname(realpathSync(fileURLToPath(import.meta.resolve("@chaosity/address-form/package.json")))), "dist") + sep;
const required = Object.values(createRequire(import.meta.url).cache)
  .filter((module) => module.filename.startsWith(libraryDist))
  .flatMap((module) => module.children.map((child) => child.filename))
  .filter((file) => !file.startsWith(libraryDist));
const loadedTwice = new Set();
for (const file of required) {
  const manifest = manifestOf(file);
  const { exports } = manifest ?? {};
  const entry =
    exports && typeof exports === "object" && !Object.keys(exports).some((key) => key.startsWith("."))
      ? exports
      : exports?.["."];
  if (splits(entry)) loadedTwice.add(manifest.name);
}
if (loadedTwice.size > 0) {
  failed = true;
  console.log("FAILED  ESM: loaded through require although each has an import build: " + [...loadedTwice].sort().join(", "));
} else {
  console.log("ok      ESM: no package loaded through its require build");
}

process.exitCode = failed ? 1 : 0;
`;

const CJS_CONSUMER = `
const { createElement: h } = require("react");
const { renderToString } = require("react-dom/server");
const { LocationClientProvider } = require("@chaosity/location-client-react");
const { AddressForm, Flex } = require("@chaosity/address-form");

${README_TREE}

check("CJS: README tree, provider from @chaosity/location-client-react", readmeTree, /name="addressLineOne"/);

process.exitCode = failed ? 1 : 0;
`;

const scratch = mkdtempSync(join(tmpdir(), "address-form-smoke-"));
let failed = false;
try {
  const spec = process.argv[2] ?? root;
  const [{ filename }] = JSON.parse(
    execFileSync("npm", ["pack", spec, "--json", "--ignore-scripts", "--pack-destination", scratch], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    }),
  );
  console.log(`Testing ${spec === root ? "this repository" : spec}, packed as ${filename}\n`);

  // The package itself, unpacked: a real directory, so what it requires
  // resolves through the scratch node_modules like an installed package's.
  const packageDir = join(scratch, "node_modules", NAME);
  mkdirSync(packageDir, { recursive: true });
  execFileSync("tar", ["-xzf", join(scratch, filename), "-C", packageDir, "--strip-components=1"]);

  // Everything else: links to this repository's installed copies. Node resolves
  // a link to its real path, so the application's import and the library's
  // require of one package reach one directory, as they would once deduped.
  const installed = join(root, "node_modules");
  for (const entry of readdirSync(installed)) {
    if (entry.startsWith(".")) continue;
    const children = entry.startsWith("@") ? readdirSync(join(installed, entry)).map((c) => `${entry}/${c}`) : [entry];
    for (const name of children) {
      if (name === NAME) continue;
      const at = join(scratch, "node_modules", name);
      mkdirSync(dirname(at), { recursive: true });
      symlinkSync(join(installed, name), at, "dir");
    }
  }

  // The standalone bundle carries MapLibre, so a page runs the copy it was
  // built with, whatever it installs itself. That copy must be the installed
  // one, and at least 6.4.1: GHSA-jrc7-96c5-q579 is fixed in no earlier release.
  // The bundle names MapLibre's version as one string literal, as it does
  // React's, so this looks for the installed version among them.
  try {
    const maplibre = JSON.parse(readFileSync(join(root, "node_modules/maplibre-gl/package.json"), "utf8")).version;
    const bundle = readFileSync(join(packageDir, "dist/standalone/address-form-sdk.umd.js"), "utf8");
    const [major, minor, patch] = maplibre.split(".").map(Number);
    if (major < 6 || (major === 6 && (minor < 4 || (minor === 4 && patch < 1)))) {
      throw new Error(`the installed maplibre-gl is ${maplibre}, below 6.4.1`);
    }
    if (!bundle.includes(`\`${maplibre}\``) && !bundle.includes(`"${maplibre}"`)) {
      const carried = [...new Set(bundle.match(/[`"]\d+\.\d+\.\d+[`"]/g) ?? [])].join(", ");
      throw new Error(`the standalone bundle does not carry maplibre-gl ${maplibre} (it names ${carried})`);
    }
    console.log("ok      standalone: carries maplibre-gl " + maplibre);
  } catch (error) {
    failed = true;
    console.log("FAILED  standalone: " + (error instanceof Error ? error.message : error));
  }

  writeFileSync(join(scratch, "esm.mjs"), ESM_CONSUMER);
  writeFileSync(join(scratch, "cjs.cjs"), CJS_CONSUMER);

  for (const consumer of ["esm.mjs", "cjs.cjs"]) {
    const { status } = spawnSync(process.execPath, [join(scratch, consumer)], { cwd: scratch, stdio: "inherit" });
    if (status !== 0) failed = true;
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

if (failed) {
  console.error("\nThe built package does not load the way an application loads it. See scripts/smoke-dist.mjs.");
  process.exit(1);
}
