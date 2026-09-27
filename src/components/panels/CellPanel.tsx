"use client";

import { MousePointerClick } from "lucide-react";
import { cn } from "cn";
import type { CellSeries } from "@/hooks/useCellSeries";
import { useSeriesDisplay } from "@/hooks/useSeriesDisplay";
import { CellView } from "@/components/panels/CellView";
import { CellExport } from "@/components/panels/CellExport";
import { FloatingPanel } from "@/components/panels/FloatingPanel";
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

export function CellPanel({ series }: { series: CellSeries }) {
  const display = useSeriesDisplay(series);

  if (!series.selection) {
    return (
      <FloatingPanel label="Chart">
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
    <FloatingPanel label="Chart">
      <Tabs defaultValue="view">
        <TabsList className={cn("w-full", segmentedListClass)}>
          <TabsTrigger value="view" className={segmentedTriggerClass}>
            View
          </TabsTrigger>
          <TabsTrigger value="export" className={segmentedTriggerClass}>
            Export
          </TabsTrigger>
        </TabsList>
        <TabsContent value="view">
          <CellView series={series} display={display} />
        </TabsContent>
        <TabsContent value="export">
          <CellExport series={series} display={display} />
        </TabsContent>
      </Tabs>
    </FloatingPanel>
  );
}
