export type SidebarState = {
  /** Width of the panel when it is open, in px. */
  width: number;
  collapsed: boolean;
};

export const SIDEBAR_STORAGE_KEY = "earthprints-sidebar";

export const SIDEBAR_MIN_WIDTH = 300;
export const SIDEBAR_MAX_WIDTH = 720;
export const SIDEBAR_DEFAULT_WIDTH = 400;

/** The map never gets squeezed below this, so on a narrow window the panel yields. */
export const MAP_MIN_WIDTH = 360;

/** Below this the panel is a bottom drawer and neither seam nor toggle exists. */
export const SIDEBAR_DESKTOP_MIN_VIEWPORT = 901;

export const DEFAULT_SIDEBAR_STATE: SidebarState = {
  width: SIDEBAR_DEFAULT_WIDTH,
  collapsed: false,
};

/**
 * Widest the panel may go right now. The map floor wins over the nominal
 * maximum, but never at the cost of the panel's own minimum: on a window too
 * narrow for both, the panel keeps its 300px and the map takes what is left.
 */
export function maxSidebarWidth(viewportWidth: number): number {
  return Math.max(
    SIDEBAR_MIN_WIDTH,
    Math.min(SIDEBAR_MAX_WIDTH, viewportWidth - MAP_MIN_WIDTH),
  );
}

export function clampSidebarWidth(
  width: number,
  viewportWidth: number,
): number {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.round(
    Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), maxSidebarWidth(viewportWidth)),
  );
}

export function parseSidebarState(raw: string | null): SidebarState | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { width, collapsed } = parsed as Record<string, unknown>;
    if (typeof width !== "number" || !Number.isFinite(width)) return null;
    if (typeof collapsed !== "boolean") return null;
    return {
      // Bound to the nominal range only; the viewport-aware clamp happens on
      // read, once a window exists to measure.
      width: Math.round(
        Math.min(Math.max(width, SIDEBAR_MIN_WIDTH), SIDEBAR_MAX_WIDTH),
      ),
      collapsed,
    };
  } catch {
    return null;
  }
}

export function readSidebarState(): SidebarState {
  if (typeof window === "undefined") return DEFAULT_SIDEBAR_STATE;
  let stored: SidebarState | null = null;
  try {
    stored = parseSidebarState(localStorage.getItem(SIDEBAR_STORAGE_KEY));
  } catch {
    stored = null;
  }
  const state = stored ?? DEFAULT_SIDEBAR_STATE;
  return {
    width: clampSidebarWidth(state.width, window.innerWidth),
    collapsed: state.collapsed,
  };
}

export function storeSidebarState(state: SidebarState): void {
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // A full or blocked store costs us the memory of the layout, nothing more.
  }
}

/**
 * Writes the layout onto the root element. The width token stays at the open
 * width even while collapsed so the panel's contents keep their size and the
 * panel slides out from under them instead of reflowing to nothing.
 */
export function applySidebarState(state: SidebarState): void {
  const root = document.documentElement;
  root.style.setProperty("--editor-sidebar-width", `${state.width}px`);
  if (state.collapsed) {
    root.setAttribute("data-sidebar-collapsed", "true");
  } else {
    root.removeAttribute("data-sidebar-collapsed");
  }
}

/**
 * The layout lives outside React: the boot script paints it onto the root
 * element before hydration, so components read it as an external source
 * instead of reaching for localStorage in an effect after the fact.
 */
let snapshot: SidebarState | null = null;
const listeners = new Set<() => void>();

export function subscribeSidebarState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSidebarState(): SidebarState {
  snapshot ??= readSidebarState();
  return snapshot;
}

export function getServerSidebarState(): SidebarState {
  return DEFAULT_SIDEBAR_STATE;
}

/** The one writer: paints the layout, remembers it, wakes the readers. */
export function setSidebarState(next: SidebarState): void {
  snapshot = next;
  applySidebarState({
    width: clampSidebarWidth(next.width, window.innerWidth),
    collapsed: next.collapsed,
  });
  storeSidebarState(next);
  for (const listener of listeners) listener();
}

export const sidebarInitScript = `
(function () {
  try {
    var raw = localStorage.getItem("${SIDEBAR_STORAGE_KEY}");
    if (!raw) return;
    var state = JSON.parse(raw);
    if (!state || typeof state.width !== "number") return;
    var max = Math.max(
      ${SIDEBAR_MIN_WIDTH},
      Math.min(${SIDEBAR_MAX_WIDTH}, window.innerWidth - ${MAP_MIN_WIDTH})
    );
    var width = Math.min(Math.max(state.width, ${SIDEBAR_MIN_WIDTH}), max);
    document.documentElement.style.setProperty(
      "--editor-sidebar-width",
      Math.round(width) + "px"
    );
    if (state.collapsed === true) {
      document.documentElement.setAttribute("data-sidebar-collapsed", "true");
    }
  } catch (e) {}
})();
`.trim();
