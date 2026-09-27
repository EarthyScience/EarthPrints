import { setMaxParallelImageRequests, setWorkerUrl } from "maplibre-gl";

const MAX_PARALLEL_IMAGE_REQUESTS = 32;

if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre-gl-worker.mjs");
  setMaxParallelImageRequests(MAX_PARALLEL_IMAGE_REQUESTS);
}
