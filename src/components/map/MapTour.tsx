"use client";

import { useCallback, useEffect, useState } from "react";
import { Joyride, type Step, type TooltipRenderProps } from "react-joyride";
import {
  EMPTY_CELL_HINT,
  tourSpotlightFor,
  tourStepsFor,
  tourTargetFor,
} from "@/lib/constants/tour";
import { getSidebarState, setSidebarState } from "@/lib/sidebar";
import {
  hasFiniteValues,
  hasSeenGuide,
  isDesktopViewport,
  MOBILE_MEDIA_QUERY,
  markGuideSeen,
  stepUnlocked,
  subscribeGuideRequests,
  type TourGateState,
} from "@/lib/tour";

type MapTourProps = {
  hasSelection: boolean;
  loadingSeries: boolean;
  seriesValues: Float32Array | null;
  /** The mobile bottom sheet is open. Ignored above the desktop breakpoint. */
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
};

/** Above the icon tooltips at z-200, which are the highest thing in the app. */
const TOUR_Z_INDEX = 300;

/** Breathing room between the target and the lit edge. */
const SPOTLIGHT_PADDING = 8;

/** Pulse box, in px. Kept in sync with the `h-4 w-4` on the span below. */
const PULSE_SIZE = 16;

/** Matches the scrim behind the mobile drawer, so the dim reads as the app's. */
const OVERLAY_COLOR = "rgba(0, 0, 0, 0.55)";

const BUTTON_BASE =
  "rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors focus-visible:outline-offset-1 focus-visible:[outline:2px_solid_var(--accent-solid)]";

/** Secondary: the panel's plain bordered button. */
const BACK_BUTTON = `${BUTTON_BASE} border border-editor-border bg-editor-bg-primary text-editor-fg-primary hover:border-editor-border-strong`;

/** Primary: solid accent, matching the plot tabs and the selected year chips. */
const PRIMARY_BUTTON = `${BUTTON_BASE} border border-transparent bg-accent text-white hover:opacity-90`;

function TourCard({
  backProps,
  index,
  isLastStep,
  primaryProps,
  size,
  step,
  tooltipProps,
}: TooltipRenderProps) {
  const waiting = Boolean((step.data as { waiting?: boolean } | undefined)?.waiting);

  return (
    <div
      {...tooltipProps}
      className="w-[min(360px,calc(100vw-2rem))] rounded-editor-md border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-editor-bg-primary p-4 shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
    >
      <p className="text-[13.5px] font-semibold text-editor-fg-primary">
        {step.title}
      </p>

      <div className="mt-2 grid gap-2">
        {(step.content as string[]).map((paragraph) => (
          <p
            key={paragraph}
            className="text-[12.5px] leading-relaxed text-editor-fg-secondary"
          >
            {paragraph}
          </p>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] tabular-nums text-editor-fg-tertiary">
          {index + 1} / {size}
        </span>

        <div className="flex items-center gap-2">
          {index > 0 ? (
            <button {...backProps} type="button" title={undefined} className={BACK_BUTTON}>
              Back
            </button>
          ) : null}
          {/* An interactive step is finished by doing the thing, not by a button. */}
          {waiting ? null : (
            <button
              {...primaryProps}
              type="button"
              title={undefined}
              className={PRIMARY_BUTTON}
            >
              {isLastStep ? "Done" : index === 0 ? "Show me" : "Next"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Replaces the card's arrow. Joyride positions this where the card meets the
 * highlight, which is the one spot that keeps the same relation to the card as
 * targets change size and side, so it never reads as an arbitrary corner.
 */
function TourPulse() {
  return (
    <span className="relative grid h-4 w-4 place-items-center">
      <span className="absolute h-full w-full animate-ping rounded-full bg-accent opacity-75" />
      <span className="relative h-2 w-2 rounded-full bg-accent shadow-[0_0_0_2px_color-mix(in_srgb,var(--accent)_28%,transparent)]" />
    </span>
  );
}

export function MapTour({
  hasSelection,
  loadingSeries,
  seriesValues,
  panelOpen,
  onPanelOpenChange,
}: MapTourProps) {
  // The map subtree is client-only (`ssr: false` in MapExperience), so reading
  // the viewport and the cookie during the first render is safe and avoids an
  // effect that would set state on mount.
  /** Last interactive step the tour advanced out of on its own. */
  const [advancedFrom, setAdvancedFrom] = useState<number | null>(null);
  const [run, setRun] = useState(() => !hasSeenGuide());
  const [isMobile, setIsMobile] = useState(
    () => !isDesktopViewport(window.innerWidth),
  );
  const [stepIndex, setStepIndex] = useState(0);

  const gateState: TourGateState = {
    hasSelection,
    loadingSeries,
    hasData: hasFiniteValues(seriesValues),
    isMobile,
    panelOpen,
  };

  // Steps that only make sense in one arrangement drop out of the other, so
  // the indices below and the "n / m" counter both stay honest.
  const activeSteps = tourStepsFor(isMobile);
  const current = activeSteps[stepIndex];
  const next = activeSteps[stepIndex + 1];
  const wantsPanel = isMobile ? current?.mobilePanel : undefined;

  const start = useCallback(() => {
    setStepIndex(0);
    setRun(true);
  }, []);

  const finish = useCallback(() => {
    setRun(false);
    markGuideSeen();
  }, []);

  useEffect(() => subscribeGuideRequests(start), [start]);

  // Reopening matters on the way back: once the user has learned to open the
  // sheet, a step pointing into it should not stall because they closed it.
  useEffect(() => {
    if (!run || !wantsPanel) return;
    const shouldBeOpen = wantsPanel === "open";
    if (panelOpen !== shouldBeOpen) onPanelOpenChange(shouldBeOpen);
  }, [run, wantsPanel, panelOpen, onPanelOpenChange]);

  // Which arrangement the layout is in decides both the step list and where
  // several steps point, so it has to be watched rather than read once.
  useEffect(() => {
    const query = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // The panel can be collapsed from a previous visit, and at desktop widths a
  // collapsed panel is `visibility: hidden`, so every step from the third on
  // would light up nothing. On mobile the sheet is the user's to open, which is
  // what the "Open the record" step is for.
  useEffect(() => {
    if (!run || isMobile) return;
    if ((current?.gate ?? "none") === "none") return;

    const sidebar = getSidebarState();
    if (sidebar.collapsed) setSidebarState({ ...sidebar, collapsed: false });
  }, [run, isMobile, current]);

  // Interactive steps have no Next button: they end when the app says the user
  // did the thing. That is a fact about the current props rather than a side
  // effect, so it is settled during render instead of in an effect.
  const actionDone = next ? stepUnlocked(next.gate, gateState) : true;

  // Only once per step. The gate stays satisfied after the user acts, so
  // without this, stepping back into an interactive step would bounce straight
  // forward again and the card would never be readable a second time.
  if (
    run &&
    current?.interactive &&
    actionDone &&
    advancedFrom !== stepIndex
  ) {
    setAdvancedFrom(stepIndex);
    setStepIndex(stepIndex + 1);
  }

  if (!run) return null;

  const steps: Step[] = activeSteps.map((spec, index) => {
    const emptyCell =
      spec.id === "pick" &&
      hasSelection &&
      !loadingSeries &&
      !!seriesValues &&
      !hasFiniteValues(seriesValues);

    return {
      target: tourTargetFor(spec, isMobile),
      spotlightTarget: tourSpotlightFor(spec, isMobile),
      // Only when the step overrides it. Joyride picks this key off the step
      // and merges it over `options`, so passing `undefined` on the other
      // steps wiped out the shared padding instead of falling back to it.
      ...(spec.spotlightPadding
        ? { spotlightPadding: spec.spotlightPadding }
        : {}),
      title: spec.title,
      content: emptyCell ? [EMPTY_CELL_HINT] : spec.body,
      placement:
        index === 0
          ? "center"
          : isMobile
            ? (spec.mobilePlacement ?? "auto")
            : "auto",
      data: {
        waiting:
          !!spec.interactive &&
          index === stepIndex &&
          !actionDone,
      },
    };
  });

  return (
    <Joyride
      steps={steps}
      run={run}
      stepIndex={stepIndex}
      continuous
      tooltipComponent={TourCard}
      arrowComponent={TourPulse}
      options={{
        overlayColor: OVERLAY_COLOR,
        spotlightPadding: SPOTLIGHT_PADDING,
        // Put the pulse on the lit border rather than in the gap beside it.
        // Joyride offsets the card by `offset + spotlightPadding + arrowSize`
        // and the arrow box protrudes `arrowSize` back toward the target, so
        // the box centre sits at `offset + spotlightPadding + arrowSize / 2`
        // from the target edge. The border is at `spotlightPadding`, which
        // leaves offset at minus half the arrow. The card still clears the
        // border by `arrowSize / 2`.
        arrowBase: PULSE_SIZE,
        arrowSize: PULSE_SIZE,
        offset: -PULSE_SIZE / 2,
        spotlightRadius: 12,
        zIndex: TOUR_Z_INDEX,
        // Without this the overlay swallows the click the step is asking for.
        blockTargetInteraction: false,
        // No skip button on the card: clicking the dimmed area is the way out.
        // Clicks inside the lit area still reach the app, so the steps that ask
        // for one are unaffected.
        overlayClickAction: "close",
        // Focus is not trapped, so nothing is focused on open and the reader can
        // still tab to the map or the tabs a step is pointing at.
        disableFocusTrap: true,
        skipBeacon: true,
        targetWaitTimeout: 8000,
      }}
      onEvent={(data) => {
        // `error:target_not_found` is not fatal: Joyride emits it while it
        // polls for a target that has not mounted or is not visible yet, and
        // `targetWaitTimeout` decides when to give up. Ending the tour here
        // killed it whenever a step advanced a frame before its target
        // committed, which is exactly what happens when a pick populates the
        // panel.
        if (data.status === "finished" || data.status === "skipped") {
          finish();
          return;
        }

        if (data.type !== "step:after") return;

        if (data.action === "close" || data.action === "skip") {
          finish();
          return;
        }
        if (data.action === "prev") {
          setStepIndex((index) => Math.max(0, index - 1));
          return;
        }
        if (stepIndex >= activeSteps.length - 1) {
          finish();
          return;
        }
        setStepIndex((index) => index + 1);
      }}
    />
  );
}
