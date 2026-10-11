"use client";

import Image from "next/image";
import {
  ChartLine,
  CircleQuestionMark,
  Compass,
  Moon,
  Settings,
  Sun,
} from "lucide-react";
import { SITE_NAME } from "@/lib/constants/site";
import { requestGuide } from "@/lib/tour";
import { useTheme } from "@/providers/ThemeProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ToolbarPanel = "settings" | "chart" | "help";

const PANELS = [
  { value: "settings", label: "Settings", Icon: Settings },
  { value: "chart", label: "Chart", Icon: ChartLine },
  { value: "help", label: "Help", Icon: CircleQuestionMark },
] as const;

const REPO_URL = "https://github.com/EarthyScience/EarthPrints";

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

const actionClass =
  "max-md:size-12 max-md:rounded-full max-md:border-border max-md:bg-background max-md:shadow-lg dark:max-md:border-input";

export function MapActions({ onBeforeGuide }: { onBeforeGuide: () => void }) {
  const { isLight, toggleTheme } = useTheme();
  const ThemeIcon = isLight ? Moon : Sun;

  return (
    <Card
      role="group"
      aria-label="Display and links"
      className="[--card-spacing:--spacing(1)] max-md:contents"
    >
      <CardContent className="flex gap-1 max-md:flex-col max-md:gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
          onClick={toggleTheme}
          className={actionClass}
        >
          <ThemeIcon className="size-4 max-md:size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Start the guide"
          onClick={() => {
            onBeforeGuide();
            requestGuide();
          }}
          className={actionClass}
        >
          <Compass className="size-4 max-md:size-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Source on GitHub"
          nativeButton={false}
          render={
            <a href={REPO_URL} target="_blank" rel="noreferrer noopener" />
          }
          className={actionClass}
        >
          <GitHubMark className="size-3.5 max-md:size-4.5" />
        </Button>
      </CardContent>
    </Card>
  );
}

type MapToolbarProps = {
  openPanel: ToolbarPanel | null;
  onOpenPanelChange: (panel: ToolbarPanel | null) => void;
  hideChart?: boolean;
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
  hideChart = false,
  hideOnMobile = false,
}: MapToolbarProps) {
  // The data view already shows the chart, so the chart panel would repeat it.
  const panels = hideChart
    ? PANELS.filter(({ value }) => value !== "chart")
    : PANELS;

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
            {panels.map(({ value, label, Icon }) => (
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
