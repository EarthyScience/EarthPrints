"use client";

import { Crosshair, Minus, Navigation, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

type MapControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
  locating: boolean;
  onZoomToSelection?: () => void;
};

export function MapControls({
  onZoomIn,
  onZoomOut,
  onLocate,
  locating,
  onZoomToSelection,
}: MapControlsProps) {
  return (
    <div data-tour="controls" className="flex flex-col items-center gap-2">
      <ButtonGroup orientation="vertical">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Zoom in"
          onClick={onZoomIn}
          className="bg-background dark:bg-background"
        >
          <Plus />
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Zoom out"
          onClick={onZoomOut}
          className="bg-background dark:bg-background"
        >
          <Minus />
        </Button>
      </ButtonGroup>
      {onZoomToSelection ? (
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Zoom to selection"
          onClick={onZoomToSelection}
          className="bg-background dark:bg-background"
        >
          <Crosshair />
        </Button>
      ) : null}
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Go to my location"
        disabled={locating}
        onClick={onLocate}
        className="bg-background dark:bg-background"
      >
        <Navigation />
      </Button>
    </div>
  );
}
