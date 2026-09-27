/**
 * A cookie rather than localStorage, and read on the client rather than in a
 * server component: touching cookies on the server would opt the map route out
 * of the static prerender it gets today. Functional preference only, no
 * personal data, so it carries no consent obligation.
 */
const GUIDE_COOKIE = "earthprints_guide_seen";
const GUIDE_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

/** What a step needs to exist before it can be shown. */
export type TourGate = "none" | "selection" | "panel" | "series";

export type TourGateState = {
  hasSelection: boolean;
  loadingSeries: boolean;
  /** Series loaded and holding at least one real number. */
  hasData: boolean;
  /** Below the desktop breakpoint, where the readout is a bottom sheet. */
  isMobile: boolean;
  /** That sheet is open. Always irrelevant on desktop, where the panel is in flow. */
  panelOpen: boolean;
};

/**
 * Whether the readout is on screen at all. On desktop it always is; on mobile
 * it is a sheet that starts closed and that picking a cell does not open, so
 * every step pointing into it has to wait for the user to open it.
 */
function readoutVisible(state: TourGateState): boolean {
  return !state.isMobile || state.panelOpen;
}

/** Pulled out of `document.cookie` so it can be tested without a DOM. */
export function parseGuideSeen(cookie: string): boolean {
  return cookie.split(";").some((part) => part.trim() === `${GUIDE_COOKIE}=1`);
}

export function hasSeenGuide(): boolean {
  if (typeof document === "undefined") return true;
  return parseGuideSeen(document.cookie);
}

export function markGuideSeen(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${GUIDE_COOKIE}=1; path=/; max-age=${GUIDE_COOKIE_MAX_AGE_S}; SameSite=Lax`;
}

const DESKTOP_MIN_VIEWPORT = 901;

export function isDesktopViewport(width: number): boolean {
  return width >= DESKTOP_MIN_VIEWPORT;
}

export const MOBILE_MEDIA_QUERY = `(max-width: ${DESKTOP_MIN_VIEWPORT - 1}px)`;

/**
 * A cell over ocean or bare ground comes back as all NaN rather than empty, so
 * "loaded" is not the same as "has something to show".
 */
export function hasFiniteValues(values: Float32Array | null): boolean {
  if (!values) return false;
  for (let index = 0; index < values.length; index += 1) {
    if (Number.isFinite(values[index])) return true;
  }
  return false;
}

export function stepUnlocked(gate: TourGate, state: TourGateState): boolean {
  switch (gate) {
    case "none":
      return true;
    case "selection":
      return state.hasSelection;
    case "panel":
      return state.hasSelection && readoutVisible(state);
    case "series":
      return (
        state.hasSelection &&
        readoutVisible(state) &&
        !state.loadingSeries &&
        state.hasData
      );
  }
}

type GuideListener = () => void;
const guideListeners = new Set<GuideListener>();

export function requestGuide(): void {
  for (const listener of guideListeners) listener();
}

export function subscribeGuideRequests(listener: GuideListener): () => void {
  guideListeners.add(listener);
  return () => {
    guideListeners.delete(listener);
  };
}
