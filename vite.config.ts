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
