"use client";

import { LocateFixed, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";

const CONTROL_CLASS =
  "bg-background text-editor-fg-secondary hover:bg-muted hover:text-editor-fg-primary dark:bg-background dark:hover:bg-muted";

type MapControlsProps = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
  locating: boolean;
};

export function MapControls({
  onZoomIn,
  onZoomOut,
  onLocate,
  locating,
}: MapControlsProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <ButtonGroup orientation="vertical" className="rounded-lg shadow-editor">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Zoom in"
          onClick={onZoomIn}
          className={CONTROL_CLASS}
        >
          <Plus />
        </Button>
        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Zoom out"
          onClick={onZoomOut}
          className={CONTROL_CLASS}
        >
          <Minus />
        </Button>
      </ButtonGroup>
      <Button
        variant="outline"
        size="icon-lg"
        aria-label="Go to my location"
        disabled={locating}
        onClick={onLocate}
        className={`${CONTROL_CLASS} shadow-editor`}
      >
        <LocateFixed />
      </Button>
    </div>
  );
}
