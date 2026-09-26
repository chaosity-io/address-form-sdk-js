/// <reference types="vite/client" />

/** maplibre-gl's worker as one ES module, from vite-plugin-maplibre-worker.ts. */
declare module "virtual:maplibre-worker" {
  const source: string;
  export default source;
}
