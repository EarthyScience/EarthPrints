import { setWorkerUrl } from "maplibre-gl";

if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs");
}
