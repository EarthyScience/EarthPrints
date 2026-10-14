"use client";

import { Maximize2, MousePointerClick } from "lucide-react";
import { cn } from "cn";
import type { CellSeries } from "@/hooks/useCellSeries";
import { useSeriesDisplay } from "@/hooks/useSeriesDisplay";
import type { TimeBasis } from "@/lib/zarr/localTime";
import { CellView } from "@/components/panels/CellView";
import { CellExport } from "@/components/panels/CellExport";
import { FloatingPanel } from "@/components/panels/FloatingPanel";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  segmentedListClass,
  segmentedTriggerClass,
} from "@/components/ui/segmented-tabs";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CellPanelProps = {
  series: CellSeries;
  timeBasis: TimeBasis;
  onClose: () => void;
  expand?: boolean;
  openDetails?: boolean;
  onOpenExtended: () => void;
};

export function CellPanel({
  series,
  timeBasis,
  onClose,
  expand,
  openDetails,
  onOpenExtended,
}: CellPanelProps) {
  const display = useSeriesDisplay(series, timeBasis);

  if (!series.selection) {
    return (
      <FloatingPanel label="Chart" onClose={onClose} expand={expand}>
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MousePointerClick />
            </EmptyMedia>
            <EmptyTitle>Click the map</EmptyTitle>
            <EmptyDescription>Pick a point to load its record</EmptyDescription>
          </EmptyHeader>
        </Empty>
      </FloatingPanel>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="lg"
        onClick={onOpenExtended}
        className="absolute top-0 left-full ml-2 bg-background shadow-sm dark:bg-background max-md:top-auto max-md:right-3 max-md:bottom-full max-md:left-auto max-md:ml-0 max-md:mb-3 max-md:rounded-full max-md:shadow-lg"
      >
        <Maximize2 />
        Extended view
      </Button>
      <FloatingPanel label="Chart" onClose={onClose} expand={expand}>
        <Tabs defaultValue="view">
          <TabsList className={cn("w-full max-md:mb-3", segmentedListClass)}>
            <TabsTrigger value="view" className={segmentedTriggerClass}>
              View
            </TabsTrigger>
            <TabsTrigger value="export" className={segmentedTriggerClass}>
              Export
            </TabsTrigger>
          </TabsList>
          <TabsContent value="view">
            <CellView
              series={series}
              display={display}
              openDetails={openDetails}
            />
          </TabsContent>
          <TabsContent value="export">
            <CellExport series={series} display={display} />
          </TabsContent>
        </Tabs>
      </FloatingPanel>
    </div>
  );
}
