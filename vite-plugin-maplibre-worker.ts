import { createRequire } from "node:module";
import { build, type Plugin } from "vite";

const ID = "virtual:maplibre-worker";

/**
 * maplibre-gl's worker, as one self-contained ES module in a string, for the
 * standalone bundle (`import source from "virtual:maplibre-worker"`).
 *
 * maplibre-gl 6 runs its worker from a module file, `maplibre-gl-worker.mjs`,
 * which imports `maplibre-gl-shared.mjs` from beside it, and it finds that file
 * from its own `import.meta.url`. The standalone bundle is one classic script,
 * usually served from a CDN. Neither file sits beside it, and a UMD build has
 * no `import.meta` at all (the build replaces it with `{}`), so the map mounted
 * and drew no tile. This bundles the worker and the chunk it imports into one
 * module, and `main-standalone.tsx` hands MapLibre a `blob:` URL of it. The
 * worker then comes from the bundle itself, as maplibre 5's UMD worker did, so
 * a page with a Content Security Policy needs `worker-src blob:`, as it did then.
 *
 * Built once per Vite process, from whichever maplibre-gl is installed, so it
 * always matches the copy the bundle carries.
 */
export function maplibreWorker(): Plugin {
  let source: Promise<string> | undefined;
  return {
    name: "maplibre-worker",
    resolveId: (id) => (id === ID ? `\0${ID}` : undefined),
    async load(id) {
      if (id !== `\0${ID}`) return undefined;
      source ??= bundleWorker();
      return `export default ${JSON.stringify(await source)};`;
    },
  };
}

async function bundleWorker(): Promise<string> {
  const entry = createRequire(import.meta.url).resolve("maplibre-gl/dist/maplibre-gl-worker.mjs");
  const result = await build({
    configFile: false,
    logLevel: "warn",
    build: {
      write: false,
      emptyOutDir: false,
      minify: true,
      lib: { entry, formats: ["es"], fileName: "maplibre-gl-worker" },
      // Vite keeps whitespace in an ES library build; this worker is not a
      // library anyone imports, so strip it (about 16 KB gzipped of the bundle).
      rolldownOptions: { output: { minify: true } },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => ("output" in r ? r.output : []));
  const chunks = outputs.filter((o) => o.type === "chunk");
  if (chunks.length !== 1) {
    throw new Error(`maplibre-worker: expected one chunk, got ${chunks.map((c) => c.fileName).join(", ")}`);
  }
  return chunks[0].code;
}
