import type { SpotlightPadding } from "react-joyride";
import type { TourGate } from "@/lib/tour";

export type TourStepSpec = {
  id: string;
  /** Where the card anchors. */
  target: string;
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
    title: "Start with a place",
    body: [
      "Click anywhere on land, or search for a place or coordinates.",
    ],
    gate: "none",
    interactive: true,
  },
  {
    id: "record",
    target: '[data-tour="record"]',
    title: "What a click fetches",
    body: [
      "Your click snapped to the nearest 0.05° cell, roughly 5km across, and the panel now holds that cell's record: an hourly estimate of net ecosystem exchange, the balance between the carbon a place takes in and the carbon it breathes back out.",
    ],
    gate: "selection",
  },
  {
    id: "plots",
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
    target: '[data-tour="years"]',
    title: "Widen the window",
    body: [
      "Add years by clicking them, or shift-click for a range. Each year adds another block of columns, and one cycle becomes a record you can read across seasons: wet years against dry ones, an early spring against a late one.",
    ],
    gate: "series",
  },
  {
    id: "controls",
    target: '[data-tour="controls"]',
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
