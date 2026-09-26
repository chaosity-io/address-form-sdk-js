import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vite";
import { maplibreWorker } from "./vite-plugin-maplibre-worker";

export default defineConfig({
  plugins: [react(), vanillaExtractPlugin(), maplibreWorker()],

  build: {
    outDir: "dist/standalone",

    lib: {
      entry: resolve(__dirname, "lib/main-standalone.tsx"),
      formats: ["umd"],
      name: "AddressFormSDK",
      fileName: "address-form-sdk",
    },

    rolldownOptions: {
      // maplibre-gl reads `import.meta.url` only to find its worker file when
      // none is set. This bundle always sets one (main-standalone.tsx), and UMD
      // has no `import.meta`, so the empty object UMD gets is the intent.
      transform: { define: { "import.meta": "{}" } },
    },
  },

  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
