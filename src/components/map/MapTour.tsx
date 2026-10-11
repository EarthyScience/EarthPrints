"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Joyride,
  type SpotlightPadding,
  type Step,
  type TooltipRenderProps,
} from "react-joyride";
import {
  EMPTY_CELL_HINT,
  PICKED_FOR_USER_BODY,
  tourSpotlightFor,
  tourSpotlightPaddingFor,
  tourStepsFor,
  tourTargetFor,
} from "@/lib/constants/tour";
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
import { Button } from "@/components/ui/button";

type MapTourProps = {
  pickedForUser: boolean;
  hasSelection: boolean;
  loadingSeries: boolean;
  seriesValues: Float32Array | null;
  panelOpen: boolean;
  onPanelOpenChange: (open: boolean) => void;
  onPanelExpandChange: (expand: boolean) => void;
  onCoverBottomChange: (cover: boolean) => void;
};

const TOUR_Z_INDEX = 300;
const CURSOR_HINT_GAP = 14;

const SHEET_TRANSITION_MS = 420;

function sheetSettled(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, SHEET_TRANSITION_MS));
}

const SPOTLIGHT_PADDING = 8;

const SPOTLIGHT_RADIUS = 12;

type Insets = { top: number; right: number; bottom: number; left: number };

function resolvePadding(value: SpotlightPadding | number | undefined): Insets {
  const fallback = typeof value === "number" ? value : SPOTLIGHT_PADDING;
  const sides = typeof value === "object" ? value : {};
  return {
    top: sides.top ?? fallback,
    right: sides.right ?? fallback,
    bottom: sides.bottom ?? fallback,
    left: sides.left ?? fallback,
  };
}

function CursorHint() {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const [bounds, setBounds] = useState<DOMRect | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const map = document.querySelector<HTMLElement>('[data-tour="map"]');
    if (!map) return;
    const move = (event: PointerEvent) => {
      setBounds(map.getBoundingClientRect());
      setPoint({ x: event.clientX, y: event.clientY });
    };
    const leave = () => setPoint(null);
    map.addEventListener("pointermove", move);
    map.addEventListener("pointerleave", leave);
    return () => {
      map.removeEventListener("pointermove", move);
      map.removeEventListener("pointerleave", leave);
    };
  }, []);

  const measure = useCallback((node: HTMLDivElement | null) => {
    if (node) setSize({ width: node.offsetWidth, height: node.offsetHeight });
  }, []);

  if (!point || !bounds) return null;

  const left = Math.min(point.x + CURSOR_HINT_GAP, bounds.right - size.width);
  const top = Math.min(point.y + CURSOR_HINT_GAP, bounds.bottom - size.height);

  return createPortal(
    <div
      ref={measure}
      aria-hidden
      className="pointer-events-none fixed whitespace-nowrap rounded-md bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md ring-1 ring-border"
      style={{ left, top, zIndex: TOUR_Z_INDEX + 1 }}
    >
      Click to pick a place
    </div>,
    document.body,
  );
}

function SpotlightOutline({
  selector,
  padding,
}: {
  selector: string;
  padding: Insets;
}) {
  const [box, setBox] = useState<Insets | null>(null);

  useEffect(() => {
    const target = document.querySelector(selector);
    if (!target) return;

    // Polled: the panel moves without resizing, which no observer reports.
    let frame = 0;
    let last = "";
    const measure = () => {
      const rect = target.getBoundingClientRect();
      const key = `${rect.top},${rect.left},${rect.width},${rect.height}`;
      if (key !== last) {
        last = key;
        setBox({
          top: rect.top - padding.top,
          left: rect.left - padding.left,
          right: rect.width + padding.left + padding.right,
          bottom: rect.height + padding.top + padding.bottom,
        });
      }
      frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);

    return () => cancelAnimationFrame(frame);
  }, [selector, padding.top, padding.right, padding.bottom, padding.left]);

  if (!box) return null;

  return createPortal(
    <div
      aria-hidden="true"
      className="pointer-events-none fixed border-2 border-[var(--tour-accent)]"
      style={{
        top: box.top,
        left: box.left,
        width: box.right,
        height: box.bottom,
        borderRadius: SPOTLIGHT_RADIUS,
        zIndex: TOUR_Z_INDEX + 1,
      }}
    />,
    document.body,
  );
}

const PULSE_SIZE = 16;

const OVERLAY_COLOR = "rgba(0, 0, 0, 0.55)";

function TourCard({
  backProps,
  index,
  isLastStep,
  primaryProps,
  size,
  step,
  tooltipProps,
}: TooltipRenderProps) {
  const waiting = Boolean(
    (step.data as { waiting?: boolean } | undefined)?.waiting,
  );

  return (
    <div
      {...tooltipProps}
      className="w-[min(360px,calc(100vw-2rem))] rounded-editor-md border border-[color-mix(in_srgb,var(--tour-accent)_45%,transparent)] bg-editor-bg-primary p-4 shadow-lg"
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
            <Button
              {...backProps}
              variant="outline"
              size="sm"
              title={undefined}
            >
              Back
            </Button>
          ) : null}
          {waiting ? null : (
            <Button {...primaryProps} size="sm" title={undefined}>
              {isLastStep ? "Done" : index === 0 ? "Show me" : "Next"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function TourPulse() {
  return (
    <span className="relative grid h-4 w-4 place-items-center">
      <span className="absolute h-full w-full animate-ping rounded-full bg-[var(--tour-accent)] opacity-75" />
      <span className="relative h-2 w-2 rounded-full bg-[var(--tour-accent)] shadow-[0_0_0_2px_color-mix(in_srgb,var(--tour-accent)_28%,transparent)]" />
    </span>
  );
}

export function MapTour({
  pickedForUser,
  hasSelection,
  loadingSeries,
  seriesValues,
  panelOpen,
  onPanelOpenChange,
  onPanelExpandChange,
  onCoverBottomChange,
}: MapTourProps) {
  const [advancedFrom, setAdvancedFrom] = useState<number | null>(null);
  const [run, setRun] = useState(() => !hasSeenGuide());
  const [isMobile, setIsMobile] = useState(
    () => !isDesktopViewport(window.innerWidth),
  );
  const [stepIndex, setStepIndex] = useState(0);

  const hasData = hasFiniteValues(seriesValues);
  const gateState: TourGateState = {
    hasSelection,
    loadingSeries,
    hasData,
    isMobile,
    panelOpen,
  };

  const skipPick = pickedForUser && (loadingSeries || !seriesValues || hasData);
  const activeSteps = tourStepsFor(isMobile).filter(
    (spec) => !(skipPick && spec.id === "pick"),
  );
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

  useEffect(() => {
    if (!run || !wantsPanel) return;
    const shouldBeOpen = wantsPanel === "open";
    if (panelOpen !== shouldBeOpen) onPanelOpenChange(shouldBeOpen);
  }, [run, wantsPanel, panelOpen, onPanelOpenChange]);

  const expandPanel = run && wantsPanel === "open";
  useEffect(() => {
    onPanelExpandChange(expandPanel);
  }, [expandPanel, onPanelExpandChange]);

  const coverBottom = run && isMobile && current?.id === "pick";
  useEffect(() => {
    onCoverBottomChange(coverBottom);
  }, [coverBottom, onCoverBottomChange]);

  useEffect(() => {
    const query = window.matchMedia(MOBILE_MEDIA_QUERY);
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!run || isMobile || current?.mobilePanel !== "open") return;
    if (!panelOpen) onPanelOpenChange(true);
  }, [run, isMobile, current, panelOpen, onPanelOpenChange]);

  const actionDone = next ? stepUnlocked(next.gate, gateState) : true;

  // Once per step, so Back into an interactive step doesn't bounce forward.
  if (run && current?.interactive && actionDone && advancedFrom !== stepIndex) {
    setAdvancedFrom(stepIndex);
    setStepIndex(stepIndex + 1);
  }

  if (!run) return null;

  const paddingFor = (spec: (typeof activeSteps)[number]) =>
    tourSpotlightPaddingFor(spec, isMobile);

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
      // Joyride merges this over `options`, so `undefined` would wipe the shared padding.
      ...(paddingFor(spec) !== undefined
        ? { spotlightPadding: paddingFor(spec) }
        : {}),
      ...(isMobile &&
      spec.mobilePanel &&
      (activeSteps[index - 1]?.mobilePanel !== spec.mobilePanel ||
        activeSteps[index + 1]?.mobilePanel !== spec.mobilePanel)
        ? { before: () => sheetSettled() }
        : {}),
      title: spec.title,
      content: emptyCell
        ? [EMPTY_CELL_HINT]
        : skipPick && spec.id === "record"
          ? PICKED_FOR_USER_BODY
          : spec.body,
      floatingOptions: {
        ...(spec.placement && !isMobile ? { flipOptions: false as const } : {}),
        hideArrow: spec.id === "pick",
      },
      placement:
        index === 0
          ? "center"
          : isMobile
            ? (spec.mobilePlacement ?? "auto")
            : (spec.placement ?? "auto"),
      data: {
        waiting:
          !!spec.interactive &&
          index === stepIndex &&
          !actionDone &&
          !(spec.id === "pick" && hasSelection),
      },
    };
  });

  const outlineTarget =
    current && current.target !== "body"
      ? (tourSpotlightFor(current, isMobile) ??
        tourTargetFor(current, isMobile))
      : null;

  return (
    <>
      {outlineTarget ? (
        <SpotlightOutline
          key={outlineTarget}
          selector={outlineTarget}
          padding={resolvePadding(paddingFor(current))}
        />
      ) : null}
      {!isMobile && current?.id === "pick" && !actionDone ? (
        <CursorHint />
      ) : null}
      <Joyride
        // A late location fix drops the pick step; remount so the new step waits for the sheet.
        key={skipPick ? "picked-for-user" : "pick"}
        steps={steps}
        run={run}
        stepIndex={stepIndex}
        continuous
        tooltipComponent={TourCard}
        loaderComponent={null}
        // Joyride's drop-shadow filter doubles the card's shadow.
        styles={{ floater: { filter: "none" } }}
        arrowComponent={TourPulse}
        options={{
          overlayColor: OVERLAY_COLOR,
          spotlightPadding: SPOTLIGHT_PADDING,
          spotlightRadius: SPOTLIGHT_RADIUS,
          arrowBase: PULSE_SIZE,
          arrowSize: PULSE_SIZE,
          offset: -PULSE_SIZE / 2,
          zIndex: TOUR_Z_INDEX,
          blockTargetInteraction: false,
          overlayClickAction: "close",
          disableFocusTrap: true,
          skipBeacon: true,
          skipScroll: true,
          targetWaitTimeout: 8000,
        }}
        onEvent={(data) => {
          // `error:target_not_found` fires while Joyride polls for a target; not fatal.
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
          if (current?.interactive && !actionDone && !panelOpen) {
            onPanelOpenChange(true);
          }
          if (stepIndex >= activeSteps.length - 1) {
            finish();
            return;
          }
          setStepIndex((index) => index + 1);
        }}
      />
    </>
  );
}
