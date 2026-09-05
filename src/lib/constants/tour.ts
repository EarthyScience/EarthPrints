import type { SpotlightPadding } from "react-joyride";
import type { TourGate } from "@/lib/tour";

export type TourStepSpec = {
  id: string;
  /** Where the card anchors. */
  target: string;
  /** Anchor below the desktop breakpoint, where the control moved. */
  mobileTarget?: string;
  /** Restricts the step to one arrangement of the layout. */
  only?: "mobile" | "desktop";
  /** Where the light falls below the desktop breakpoint. */
  mobileSpotlightTarget?: string;
  /** Overrides automatic placement below the desktop breakpoint. */
  mobilePlacement?: "center" | "top";
  /** Overrides the padding around the lit area below the desktop breakpoint. */
  mobileSpotlightPadding?: SpotlightPadding | number;
  /** What the mobile sheet should be doing while this step is on screen. */
  mobilePanel?: "open" | "closed";
  /** Where the light falls, when that is a larger region than the anchor. */
  spotlightTarget?: string;
  /** Overrides the default even padding around the lit area. */
  spotlightPadding?: SpotlightPadding;
  title: string;
  /** One card, two short paragraphs. */
  body: string[];
  gate: TourGate;
  /**
   * The step asks the user to do something on the page. Clicks pass through the
   * cutout and the card carries no Next button; the tour advances when the app
   * state says the thing happened.
   */
  interactive?: boolean;
};

/** Shown in place of step two's body when the picked cell holds no data. */
export const EMPTY_CELL_HINT =
  "That cell is empty, which happens over water and bare ground. Try one over vegetation.";

export const TOUR_STEPS: TourStepSpec[] = [
  {
    id: "intro",
    target: "body",
    title: "What this shows",
    body: [
      "EarthPrints maps the carbon that land takes in and gives back, hour by hour.",
      "Pick any point on land and you get that place's full record, drawn as a fingerprint. This guide covers choosing one and reading it, and takes about a minute.",
    ],
    gate: "none",
  },
  {
    id: "pick",
    target: '[data-tour="map"]',
    // The map is the whole screen on a phone. Anchoring the card to the foot
    // of it keeps the card on screen and leaves the map above it tappable,
    // which a centred card would cover.
    mobileTarget: '[data-tour="map-foot"]',
    mobileSpotlightTarget: '[data-tour="map"]',
    mobilePlacement: "top",
    // The map runs to the edge of the screen, so the usual outward padding
    // would push its lit border past the viewport, where the overlay clip
    // trims it away. Hugging the map exactly keeps the border on screen.
    mobileSpotlightPadding: 0,
    title: "Start with a place",
    body: [
      "Click anywhere on land, or search for a place or coordinates.",
    ],
    gate: "none",
    interactive: true,
  },
  {
    id: "open",
    target: '[data-tour="panel-toggle"]',
    // The button, not the island it sits in, and hugging it.
    mobileSpotlightPadding: 4,
    only: "mobile",
    title: "Open the record",
    body: [
      "Tap here. The numbers for the cell you picked live in a panel that slides up from the bottom.",
    ],
    gate: "selection",
    interactive: true,
  },
  {
    id: "record",
    mobilePanel: "open",
    target: '[data-tour="record"]',
    title: "What a click fetches",
    body: [
      "Your click snapped to the nearest 0.05° cell, roughly 5km across, and the panel now holds that cell's record: an hourly estimate of net ecosystem exchange, the balance between the carbon a place takes in and the carbon it breathes back out.",
    ],
    gate: "panel",
  },
  {
    id: "plots",
    mobilePanel: "open",
    target: '[data-tour="plot"]',
    title: "Two views of the same numbers",
    body: [
      "Line is the daily mean, one point per day. Fingerprint keeps all 24 hours: columns are days, rows are hours, blue for uptake and red for release.",
      "Download a zip: a PDF report, the hourly numbers as XLSX and CSV, and both plots as images.",
    ],
    gate: "series",
  },
  {
    id: "years",
    mobilePanel: "open",
    target: '[data-tour="years"]',
    title: "Widen the window",
    body: [
      "Add years by clicking them, or shift-click for a range. Each year adds another block of columns, and one cycle becomes a record you can read across seasons: wet years against dry ones, an early spring against a late one.",
    ],
    gate: "series",
  },
  {
    id: "controls",
    // The sheet covers most of a phone screen, and these controls sit beside
    // it, so it comes down before the last step.
    mobilePanel: "closed",
    target: '[data-tour="controls"]',
    // The same controls live in a floating stack beside the map on mobile.
    mobileTarget: '[data-tour="controls-mobile"]',
    // A short, wide row of buttons. Even padding leaves it looking loose above
    // and below, so the light hugs it vertically.
    spotlightPadding: { top: 3, bottom: 3, left: 8, right: 8 },
    title: "The map controls",
    body: [
      "Switch between the flat map and the globe, recenter and zoom in on your cell.",
      "Toggle the dashed box around your cell, the 40x40 patch that came down with the click.",
    ],
    gate: "selection",
  },
];

/** The steps that apply to one arrangement of the layout. */
export function tourStepsFor(isMobile: boolean): TourStepSpec[] {
  return TOUR_STEPS.filter(
    (spec) => !spec.only || (spec.only === "mobile") === isMobile,
  );
}

/** Where a step anchors in that arrangement. */
export function tourTargetFor(spec: TourStepSpec, isMobile: boolean): string {
  return (isMobile && spec.mobileTarget) || spec.target;
}

/** The padding around the lit area for one arrangement. */
export function tourSpotlightPaddingFor(
  spec: TourStepSpec,
  isMobile: boolean,
): SpotlightPadding | number | undefined {
  if (isMobile && spec.mobileSpotlightPadding !== undefined) {
    return spec.mobileSpotlightPadding;
  }
  return spec.spotlightPadding;
}

/** What the light falls on, when that differs from the anchor. */
export function tourSpotlightFor(
  spec: TourStepSpec,
  isMobile: boolean,
): string | undefined {
  return (isMobile && spec.mobileSpotlightTarget) || spec.spotlightTarget;
}
