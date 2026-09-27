"use client";

import { useState } from "react";
import Image from "next/image";
import { ChartLine, CircleQuestionMark, Settings } from "lucide-react";
import { SITE_NAME } from "@/lib/constants/site";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ToolbarPanel = "settings" | "chart" | "help";

const PANELS = [
  { value: "settings", label: "Settings", Icon: Settings },
  { value: "chart", label: "Chart", Icon: ChartLine },
  { value: "help", label: "Help", Icon: CircleQuestionMark },
] as const;

const PANEL_CLASS =
  "flex items-center rounded-[10px] border bg-background bg-clip-padding p-1 shadow-editor";

// Same brand tint as the selected Plan/Sphere tab. The transparent border
// keeps the icon from shifting when the selected one appears.
const ITEM_CLASS =
  "size-8 border border-transparent px-0 text-editor-fg-secondary hover:bg-transparent hover:text-editor-fg-secondary aria-pressed:border-[color-mix(in_srgb,var(--brand)_40%,transparent)] aria-pressed:bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] aria-pressed:text-brand";

export function MapToolbar() {
  const [openPanel, setOpenPanel] = useState<ToolbarPanel[]>([]);

  return (
    <div className="flex items-start gap-2">
      <div className={PANEL_CLASS}>
        <div className="flex h-8 items-center gap-1.5 pl-[6px] pr-2">
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
          <span className="font-semibold tracking-[-0.02em] text-editor-fg-primary">
            {SITE_NAME}
          </span>
        </div>
      </div>

      <nav aria-label="Map tools" className={PANEL_CLASS}>
        <ToggleGroup
          value={openPanel}
          onValueChange={(value) => setOpenPanel(value as ToolbarPanel[])}
          spacing={1}
        >
          {PANELS.map(({ value, label, Icon }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              aria-label={label}
              className={ITEM_CLASS}
            >
              <Icon />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </nav>
    </div>
  );
}
