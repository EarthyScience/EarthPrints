"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export const FLOATING_PANEL_WIDTH = "w-[min(380px,calc(100vw-24px))]";

const TAP_DISTANCE = 6;
const PEEK_FRACTION = 0.45;
// px per ms; a flick this fast snaps in its direction regardless of position.
const FLICK_VELOCITY = 0.4;
// Expanded sheet stops 16px under the search field (top 12 + height 40).
const EXPANDED_TOP = 68;
const SHEET_QUERY = "(width < 48rem)";

type FloatingPanelProps = {
  label: string;
  children: React.ReactNode;
  onClose: () => void;
  scrollClassName?: string;
};

type Gesture = {
  startX: number;
  startY: number;
  startHeight: number;
  fromHandle: boolean;
  atScrollTop: boolean;
  state: "pending" | "dragging" | "scrolling";
  lastY: number;
  lastTime: number;
  velocity: number;
};

export function FloatingPanel({
  label,
  children,
  onClose,
  scrollClassName = "[&>[data-slot=scroll-area-viewport]]:max-h-[calc(100dvh-8rem)] max-md:min-h-0 max-md:flex-1 max-md:[&>[data-slot=scroll-area-viewport]]:max-h-none",
}: FloatingPanelProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    expandedRef.current = expanded;
    onCloseRef.current = onClose;
  });

  // Native listeners: React's touchmove is passive, and the sheet has to
  // preventDefault to take the gesture from the content's scroll.
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    let gesture: Gesture | null = null;

    const onStart = (event: TouchEvent) => {
      if (event.touches.length !== 1 || !matchMedia(SHEET_QUERY).matches) {
        gesture = null;
        return;
      }
      const touch = event.touches[0];
      const viewport = card.querySelector(
        "[data-slot=scroll-area-viewport]",
      );
      gesture = {
        startX: touch.clientX,
        startY: touch.clientY,
        startHeight: card.getBoundingClientRect().height,
        fromHandle: handleRef.current?.contains(event.target as Node) ?? false,
        atScrollTop: (viewport?.scrollTop ?? 0) <= 0,
        state: "pending",
        lastY: touch.clientY,
        lastTime: event.timeStamp,
        velocity: 0,
      };
    };

    const onMove = (event: TouchEvent) => {
      if (!gesture || gesture.state === "scrolling") return;
      const touch = event.touches[0];
      const up = gesture.startY - touch.clientY;

      if (gesture.state === "pending") {
        const across = Math.abs(touch.clientX - gesture.startX);
        if (Math.abs(up) < TAP_DISTANCE && across < TAP_DISTANCE) return;
        const vertical = Math.abs(up) > across;
        const takesSheet =
          gesture.fromHandle ||
          (up > 0 && !expandedRef.current) ||
          (up < 0 && gesture.atScrollTop);
        if (!vertical || !takesSheet) {
          gesture.state = "scrolling";
          return;
        }
        gesture.state = "dragging";
        card.style.transition = "none";
      }

      event.preventDefault();
      const dt = event.timeStamp - gesture.lastTime;
      if (dt > 0) {
        gesture.velocity = (gesture.lastY - touch.clientY) / dt;
      }
      gesture.lastY = touch.clientY;
      gesture.lastTime = event.timeStamp;
      const full = window.innerHeight - EXPANDED_TOP;
      card.style.height = `${Math.max(0, Math.min(full, gesture.startHeight + up))}px`;
    };

    const onEnd = () => {
      if (!gesture || gesture.state !== "dragging") {
        gesture = null;
        return;
      }
      const { velocity, startHeight } = gesture;
      const height = card.getBoundingClientRect().height;
      gesture = null;
      card.style.transition = "";
      card.style.height = "";

      const peek = window.innerHeight * PEEK_FRACTION;
      const full = window.innerHeight - EXPANDED_TOP;
      if (height < startHeight - TAP_DISTANCE || velocity < -FLICK_VELOCITY) {
        onCloseRef.current();
      } else if (velocity > FLICK_VELOCITY) {
        setExpanded(true);
      } else {
        setExpanded(height > (peek + full) / 2);
      }
    };

    card.addEventListener("touchstart", onStart, { passive: true });
    card.addEventListener("touchmove", onMove, { passive: false });
    card.addEventListener("touchend", onEnd);
    card.addEventListener("touchcancel", onEnd);
    return () => {
      card.removeEventListener("touchstart", onStart);
      card.removeEventListener("touchmove", onMove);
      card.removeEventListener("touchend", onEnd);
      card.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <Card
      ref={cardRef}
      aria-label={label}
      className={`${FLOATING_PANEL_WIDTH} origin-top-left animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150 ease-out motion-reduce:animate-none max-md:w-full max-md:gap-0 max-md:rounded-t-[2rem] max-md:rounded-b-none max-md:[--card-spacing:--spacing(5)] max-md:pt-0 max-md:pb-[env(safe-area-inset-bottom)] max-md:shadow-lg max-md:zoom-in-100 max-md:slide-in-from-bottom-full max-md:duration-200 max-md:transition-[height] ${expanded ? "max-md:h-[calc(100dvh-68px)]" : "max-md:h-[45dvh]"}`}
    >
      <div
        ref={handleRef}
        aria-hidden="true"
        className="flex shrink-0 cursor-grab touch-none justify-center py-5 md:hidden"
        onClick={() => setExpanded((value) => !value)}
      >
        <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
      </div>
      <ScrollArea className={scrollClassName}>
        <CardContent className="max-md:pb-8">{children}</CardContent>
      </ScrollArea>
    </Card>
  );
}
