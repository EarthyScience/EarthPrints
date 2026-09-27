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
};

export function MapToolbar({ openPanel, onOpenPanelChange }: MapToolbarProps) {
  return (
    <div className="flex items-start gap-2">
      <Card className="[--card-spacing:--spacing(1)]">
        <CardContent className="flex h-8 items-center gap-2 pl-1.5 pr-2">
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
        </CardContent>
      </Card>

      <Card
        role="navigation"
        aria-label="Map tools"
        className="[--card-spacing:--spacing(1)]"
      >
        <CardContent>
          <ToggleGroup
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
                className="border border-transparent px-0 aria-pressed:border-brand/40 aria-pressed:bg-brand/15 aria-pressed:text-brand"
              >
                <Icon />
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </CardContent>
      </Card>
    </div>
  );
}
