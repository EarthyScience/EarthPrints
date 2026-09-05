import { SIDEBAR_DESKTOP_MIN_VIEWPORT } from "@/lib/sidebar";

/**
 * A cookie rather than localStorage, and read on the client rather than in a
 * server component: touching cookies on the server would opt the map route out
 * of the static prerender it gets today. Functional preference only, no
 * personal data, so it carries no consent obligation.
 */
const GUIDE_COOKIE = "earthprints_guide_seen";
const GUIDE_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

/** What a step needs to exist before it can be shown. */
export type TourGate = "none" | "selection" | "series";

export type TourGateState = {
  hasSelection: boolean;
  loadingSeries: boolean;
  /** Series loaded and holding at least one real number. */
  hasData: boolean;
};

/** Pulled out of `document.cookie` so it can be tested without a DOM. */
export function parseGuideSeen(cookie: string): boolean {
  return cookie
    .split(";")
    .some((part) => part.trim() === `${GUIDE_COOKIE}=1`);
}

export function hasSeenGuide(): boolean {
  if (typeof document === "undefined") return true;
  return parseGuideSeen(document.cookie);
}

export function markGuideSeen(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${GUIDE_COOKIE}=1; path=/; max-age=${GUIDE_COOKIE_MAX_AGE_S}; SameSite=Lax`;
}

/**
 * The guide is desktop-only for now. Below this the panel is a bottom drawer
 * and half the steps would point at something that is not there, so the same
 * constant the layout switches on decides whether the guide exists at all.
 */
export function isDesktopViewport(width: number): boolean {
  return width >= SIDEBAR_DESKTOP_MIN_VIEWPORT;
}

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
    case "series":
      return state.hasSelection && !state.loadingSeries && state.hasData;
  }
}

/**
 * The `?` menu lives in the header and the tour lives inside the map, with no
 * shared ancestor holding state. One module-level subscription is cheaper than
 * threading a callback through the shell, and mirrors how the sidebar store
 * already talks across the same gap.
 */
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
