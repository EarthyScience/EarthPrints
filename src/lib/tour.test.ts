import { describe, expect, it } from "vitest";
import {
  TOUR_STEPS,
  tourStepsFor,
  tourTargetFor,
} from "@/lib/constants/tour";
import {
  hasFiniteValues,
  isDesktopViewport,
  parseGuideSeen,
  stepUnlocked,
  type TourGateState,
} from "@/lib/tour";

const state = (overrides: Partial<TourGateState> = {}): TourGateState => ({
  hasSelection: false,
  loadingSeries: false,
  hasData: false,
  isMobile: false,
  panelOpen: false,
  ...overrides,
});

describe("parseGuideSeen", () => {
  it("finds the flag among other cookies", () => {
    expect(
      parseGuideSeen("earthprints-sidebar=x; earthprints_guide_seen=1; a=b"),
    ).toBe(true);
  });

  it("treats an absent or empty cookie jar as a first visit", () => {
    expect(parseGuideSeen("")).toBe(false);
    expect(parseGuideSeen("earthprints-sidebar=x")).toBe(false);
  });

  // A cookie whose name merely ends with ours would otherwise match a naive
  // `includes`, and the guide would never show.
  it("does not match a cookie that only ends with the same name", () => {
    expect(parseGuideSeen("not_earthprints_guide_seen=1")).toBe(false);
  });
});

describe("isDesktopViewport", () => {
  it("switches at the same width the layout switches at", () => {
    expect(isDesktopViewport(900)).toBe(false);
    expect(isDesktopViewport(901)).toBe(true);
  });
});

describe("hasFiniteValues", () => {
  it("reads an all-NaN series as having nothing to show", () => {
    expect(hasFiniteValues(new Float32Array([NaN, NaN, NaN]))).toBe(false);
  });

  it("accepts a series with a single real number among the gaps", () => {
    expect(hasFiniteValues(new Float32Array([NaN, -1.5, NaN]))).toBe(true);
  });

  it("treats a series that has not loaded as empty", () => {
    expect(hasFiniteValues(null)).toBe(false);
  });
});

describe("stepUnlocked", () => {
  it("lets the opening steps run before anything is selected", () => {
    expect(stepUnlocked("none", state())).toBe(true);
  });

  it("holds the record step until a cell is picked", () => {
    expect(stepUnlocked("selection", state())).toBe(false);
    expect(stepUnlocked("selection", state({ hasSelection: true }))).toBe(true);
  });

  // On mobile the readout is a sheet that picking a cell does not open, so
  // every step pointing into it has to wait for the user to open it. On
  // desktop the panel is always in flow and the distinction does not exist.
  it("waits for the mobile sheet before pointing into the readout", () => {
    const picked = { hasSelection: true, isMobile: true };
    expect(stepUnlocked("panel", state(picked))).toBe(false);
    expect(stepUnlocked("panel", state({ ...picked, panelOpen: true }))).toBe(
      true,
    );
    expect(stepUnlocked("panel", state({ hasSelection: true }))).toBe(true);
  });

  it("lets the step that opens the sheet run while it is still closed", () => {
    expect(
      stepUnlocked("selection", state({ hasSelection: true, isMobile: true })),
    ).toBe(true);
  });

  // The plot area swaps between skeleton, error and chart, so a step anchored
  // to the chart has to wait for the load rather than for the selection.
  it("holds the plot steps through the load", () => {
    const loading = state({ hasSelection: true, loadingSeries: true });
    expect(stepUnlocked("series", loading)).toBe(false);
    expect(
      stepUnlocked("series", state({ hasSelection: true, hasData: true })),
    ).toBe(true);
  });

  it("holds the plot steps on a cell that came back empty", () => {
    expect(
      stepUnlocked("series", state({ hasSelection: true, hasData: false })),
    ).toBe(false);
  });
});

describe("TOUR_STEPS", () => {
  // MapSideControls renders a hidden duplicate of several nav controls at every
  // width, so an unscoped `[aria-label=...]` would spotlight a zero-size node.
  it("targets only explicit tour anchors, never aria labels or classes", () => {
    for (const step of TOUR_STEPS) {
      for (const target of [step.target, step.mobileTarget]) {
        if (!target) continue;
        expect(target).toMatch(/^(body|#editor-controls|\[data-tour="[a-z-]+"\])$/);
      }
    }
  });

  it("gives every step a title and at least one non-empty paragraph", () => {
    for (const step of TOUR_STEPS) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.body.length).toBeGreaterThan(0);
      expect(step.body.every((paragraph) => paragraph.trim().length > 0)).toBe(
        true,
      );
    }
  });

  // A step that asks the user to act must be followed by one that can detect
  // it, or the tour would sit there with no way forward.
  it("follows every interactive step with a gated one", () => {
    TOUR_STEPS.forEach((step, index) => {
      if (!step.interactive) return;
      expect(TOUR_STEPS[index + 1]?.gate).not.toBe("none");
    });
  });
});

describe("tourStepsFor", () => {
  it("keeps the open-the-sheet step for mobile only", () => {
    expect(tourStepsFor(true).map((s) => s.id)).toContain("open");
    expect(tourStepsFor(false).map((s) => s.id)).not.toContain("open");
  });

  // The sheet has to be open before anything inside it can be pointed at.
  it("puts opening the sheet before the first step inside it on mobile", () => {
    const ids = tourStepsFor(true).map((s) => s.id);
    expect(ids.indexOf("open")).toBeLessThan(ids.indexOf("record"));
  });

  it("follows every interactive step with a gated one, in both layouts", () => {
    for (const isMobile of [true, false]) {
      const steps = tourStepsFor(isMobile);
      steps.forEach((step, index) => {
        if (!step.interactive) return;
        expect(steps[index + 1]?.gate).not.toBe("none");
      });
    }
  });
});

describe("tourTargetFor", () => {
  it("sends the controls step to the floating stack on mobile", () => {
    const controls = TOUR_STEPS.find((s) => s.id === "controls")!;

    expect(tourTargetFor(controls, true)).toBe('[data-tour="controls-mobile"]');
    expect(tourTargetFor(controls, false)).toBe('[data-tour="controls"]');
  });

  it("falls back to the shared target where a step has no mobile one", () => {
    const record = TOUR_STEPS.find((s) => s.id === "record")!;

    expect(tourTargetFor(record, true)).toBe(record.target);
  });
});

describe("mobile sheet handling", () => {
  const byId = (id: string) => TOUR_STEPS.find((step) => step.id === id)!;

  it("brings the sheet down for the step beside it, and up for the ones inside it", () => {
    expect(byId("controls").mobilePanel).toBe("closed");
    for (const id of ["record", "plots", "years"]) {
      expect(byId(id).mobilePanel).toBe("open");
    }
  });

  // The whole point of that step is that the user does it.
  it("leaves the sheet alone on the step that teaches opening it", () => {
    expect(byId("open").mobilePanel).toBeUndefined();
  });

  // A full-viewport target leaves an anchored card nowhere to go but off the
  // bottom edge, and a centred one would cover the map it asks you to tap.
  it("hangs the card off the foot of the map, still lighting all of it", () => {
    const pick = byId("pick");

    expect(pick.mobileTarget).toBe('[data-tour="map-foot"]');
    expect(pick.mobileSpotlightTarget).toBe('[data-tour="map"]');
    expect(pick.mobilePlacement).toBe("top");
  });
});
