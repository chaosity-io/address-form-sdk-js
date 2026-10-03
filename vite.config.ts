import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import path, { resolve } from "path";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";
import { maplibreWorker } from "./vite-plugin-maplibre-worker";

export default defineConfig({
  plugins: [
    react(),
    vanillaExtractPlugin(),
    // For the dev page (index.html), which runs the standalone entry.
    maplibreWorker(),
    dts({
      include: ["lib"],
      // Test helpers are not the package: lib/test/utils.d.ts shipped, and named
      // @testing-library, which no consumer installs (#33).
      exclude: [
        "lib/main-standalone.tsx",
        "lib/**/*.css.ts",
        "lib/setup-tests.ts",
        "lib/test/**",
        "**/*.test.{ts,tsx}",
      ],
      tsconfigPath: "./tsconfig.lib.json",
    }),
  ],

  build: {
    outDir: "dist/lib",

    lib: {
      // Two entries (#34). The main one is a client module: its components
      // create React contexts, so it carries "use client" (the banner below)
      // and a Server Component can render <AddressForm>. `/data` carries no
      // directive, so a Server Component can read `countries` as a value.
      entry: {
        "address-form-sdk": resolve(__dirname, "lib/main.tsx"),
        data: resolve(__dirname, "lib/main-data.ts"),
      },
      // Both, and `exports` in package.json routes each consumer to its own
      // (#29). With CommonJS alone, an application's `import` of a package that
      // ships separate import and require builds loaded one copy while this
      // library's `require` loaded the other. For client-react that is two
      // contexts, and the provider the application renders is not the one the
      // form reads. `scripts/smoke-dist.mjs` holds the built package to it.
      // `.mjs`, not `.js`: this package is not `"type": "module"`, so Node
      // would read a `.js` file as CommonJS.
      formats: ["es", "cjs"],
      fileName: (format, entry) => (format === "es" ? `${entry}.mjs` : `${entry}.${format}.js`),
    },

    // Every external is a package package.json declares, as a dependency or a
    // peer: an external is an import the consumer's install has to satisfy.
    // Anything else is bundled. `npm run test:dist` holds the built files to
    // package.json both ways (#33).
    rolldownOptions: {
      external: [
        "@chaosity/location-client",
        "@chaosity/location-client-react",
        "@headlessui/react",
        // Holds a React context. Bundled, it was a private copy: the exported
        // Typeahead and LocateButton could not see an application's
        // QueryClientProvider at all (#29).
        "@tanstack/react-query",
        "react",
        "react-dom",
        "maplibre-gl",
        "@vis.gl/react-maplibre",
        "react/jsx-runtime",
        // The stores' declarations name it, so it is declared, and so not
        // bundled as a second copy.
        "zustand",
      ],
      output: {
        // First in the file, where a directive has to be. Only the main
        // entry: a shared chunk is imported by it, and is client code there,
        // but a Server Component reads it as values through `/data`.
        banner: (chunk) => (chunk.isEntry && chunk.name === "address-form-sdk" ? '"use client";' : ""),
      },
    },
  },

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./lib/setup-tests.ts",

    // Every test file runs in parallel against however many cores the machine has,
    // and the heaviest AddressForm render crosses vitest's 5 s default under that
    // contention — passing every time in isolation, failing intermittently in a
    // full run. It blocked a release on 2026-08-23 and would have failed CI too,
    // where runners have fewer cores than a dev machine.
    //
    // This changes no assertion: the tests check exactly what they checked. It
    // stops a loaded machine being reported as a broken test. The real fix is to
    // make that render cheaper, which is scoped in location-service-client#12.
    testTimeout: 15_000,
    hookTimeout: 15_000,
    server: {
      deps: {
        inline: ["@chaosity/location-client", "@chaosity/location-client-react"],
      },
    },

    coverage: {
      include: ["lib/**"],
      reportsDirectory: path.join(__dirname, "coverage"),
      reporter: ["text", "json-summary"],
    },
  },
});
