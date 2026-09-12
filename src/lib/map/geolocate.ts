// The visitor's own position, from the browser's Geolocation API.

export type UserPosition = {
  lon: number;
  lat: number;
  /** Radius of the fix in metres, as the browser reports it. */
  accuracy: number;
};

/** The subset of `navigator.connection` the warm-up decision reads. */
export type ConnectionHint = {
  saveData?: boolean;
  effectiveType?: string;
};

// A cell is about 5.5 km across, so GPS-grade precision buys nothing and costs
// a battery wake and seconds of delay. A fix up to five minutes old is fine.
const POSITION_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  timeout: 10_000,
  maximumAge: 300_000,
};

const SLOW_CONNECTIONS = new Set(["slow-2g", "2g", "3g"]);

// Numeric codes from the spec, so the pure helpers do not depend on the
// browser-only `GeolocationPositionError` global.
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

export function isGeolocationAvailable(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }
  // Browsers only expose a position to secure contexts; localhost counts, a
  // bare-IP dev server on the LAN does not.
  return window.isSecureContext && "geolocation" in navigator;
}

export function requestPosition(): Promise<UserPosition> {
  return new Promise((resolve, reject) => {
    if (!isGeolocationAvailable()) {
      reject({ code: POSITION_UNAVAILABLE });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) =>
        resolve({
          lon: coords.longitude,
          lat: coords.latitude,
          accuracy: coords.accuracy,
        }),
      reject,
      POSITION_OPTIONS,
    );
  });
}

export function describeGeolocationError(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? (error as { code: unknown }).code
      : null;
  switch (code) {
    case PERMISSION_DENIED:
      return "Location access is blocked. Allow it in your browser's site settings to use this.";
    case TIMEOUT:
      return "Finding your location took too long. Try again.";
    default:
      return "Your location is not available right now.";
  }
}

/**
 * Whether granting location may start a background download of that cell.
 * No hint at all means the browser does not report one, which is not evidence
 * of a slow link.
 */
export function shouldWarmCache(connection: ConnectionHint | undefined): boolean {
  if (!connection) return true;
  if (connection.saveData) return false;
  return !SLOW_CONNECTIONS.has(connection.effectiveType ?? "");
}

export function readConnectionHint(): ConnectionHint | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: ConnectionHint }).connection;
}

export function describeAccuracy(metres: number): string {
  if (!Number.isFinite(metres) || metres <= 0) return "Your location";
  if (metres < 1000) {
    return `Your location, accurate to about ${Math.max(10, Math.round(metres / 10) * 10)} m`;
  }
  return `Your location, accurate to about ${Math.round(metres / 1000)} km`;
}
