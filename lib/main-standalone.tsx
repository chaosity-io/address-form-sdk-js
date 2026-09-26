import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import workerSource from "virtual:maplibre-worker";
import "./styles/index.css";

// MapLibre's worker travels inside this bundle: a page loading it from a CDN
// has no worker file to point at (vite-plugin-maplibre-worker.ts says why).
setWorkerUrl(URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" })));

export { render } from "./components/AddressFormReact/render";
