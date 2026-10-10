"use client";

import Image from "next/image";
import { ChartLine, CircleQuestionMark, Settings } from "lucide-react";
import { SITE_NAME } from "@/lib/constants/site";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ToolbarPanel = "settings" | "chart" | "help";

const PANELS = [
  { value: "settings", label: "Settings", Icon: Settings },
  { value: "chart", label: "Chart", Icon: ChartLine },
  { value: "help", label: "Help", Icon: CircleQuestionMark },
] as const;

type MapToolbarProps = {
  openPanel: ToolbarPanel | null;
  onOpenPanelChange: (panel: ToolbarPanel | null) => void;
  hideOnMobile?: boolean;
};

export function SiteMark() {
  return (
    <div className="flex items-center gap-2">
      <Image
        src="/earthprints-bars.svg?v=7"
        width={20}
        height={20}
        className="dark:hidden"
        alt=""
      />
      <Image
        src="/earthprints-bars-dark.svg?v=7"
        width={20}
        height={20}
        className="hidden dark:block"
        alt=""
      />
      <CardTitle>{SITE_NAME}</CardTitle>
    </div>
  );
}

export function MapToolbar({
  openPanel,
  onOpenPanelChange,
  hideOnMobile = false,
}: MapToolbarProps) {
  return (
    <div className="flex items-start gap-2">
      <Card className="[--card-spacing:--spacing(1)] max-md:hidden">
        <CardContent className="flex h-8 items-center pl-1.5 pr-2">
          <SiteMark />
        </CardContent>
      </Card>

      <Card
        role="navigation"
        aria-label="Map tools"
        className={`[--card-spacing:--spacing(1)] ${openPanel || hideOnMobile ? "max-md:hidden" : ""} max-md:fixed max-md:inset-x-3 max-md:bottom-[max(--spacing(3),env(safe-area-inset-bottom))] max-md:rounded-full max-md:shadow-lg`}
      >
        <CardContent>
          <ToggleGroup
            className="max-md:w-full"
            value={openPanel ? [openPanel] : []}
            onValueChange={(value) =>
              onOpenPanelChange((value[0] as ToolbarPanel | undefined) ?? null)
            }
          >
            {PANELS.map(({ value, label, Icon }) => (
              <ToggleGroupItem
                key={value}
                value={value}
                aria-label={label}
                className="border border-transparent px-0 aria-pressed:border-brand/40 aria-pressed:bg-brand/15 aria-pressed:text-brand max-md:h-11 max-md:flex-1 max-md:rounded-full max-md:text-foreground max-md:aria-pressed:text-brand"
              >
                <Icon className="size-4 max-md:size-5" />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardContent>
      </Card>
    </div>
  );
}
