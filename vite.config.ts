import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import path, { resolve } from "path";
import dts from "vite-plugin-dts";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    react(),
    vanillaExtractPlugin(),
    dts({
      include: ["lib"],
      exclude: ["lib/main-standalone.tsx", "lib/**/*.css.ts", "lib/setupTests.ts", "**/*.test.{ts,tsx}"],
      tsconfigPath: "./tsconfig.lib.json",
    }),
  ],

  build: {
    outDir: "dist/lib",

    lib: {
      entry: resolve(__dirname, "lib/main.tsx"),
      formats: ["cjs"],
      fileName: (format) => `address-form-sdk.${format}.js`,
    },

    rolldownOptions: {
      external: [
        "@chaosity/location-client",
        "@chaosity/location-client-react",
        "@headlessui/react",
        "@vanilla-extract/css",
        "react",
        "react-jsx/runtime",
        "react-dom",
        "react-hook-form",
        "react-map-gl",
        "maplibre-gl",
        "@vis.gl/react-maplibre",
        "react/jsx-runtime",
      ],
    },
  },

  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./lib/setup-tests.ts",

    // 30 test files run in parallel against however many cores the machine has,
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
