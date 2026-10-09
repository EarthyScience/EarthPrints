"use client";

import { Compass, Moon, Sun } from "lucide-react";
import {
  allYearsBytesFor,
  formatBytes,
  PATCH_WINDOW_SIZES,
  type PatchWindowSize,
} from "@/lib/settings/patchWindow";
import type { Theme } from "@/lib/theme";
import { requestGuide } from "@/lib/tour";
import type { TimeBasis } from "@/lib/zarr/localTime";
import type { MapViewMode } from "@/types/map";
import type { MapSettings } from "@/hooks/useMapSettings";
import { useTheme } from "@/providers/ThemeProvider";
import { FloatingPanel } from "@/components/panels/FloatingPanel";
import { ViewModeTabs } from "@/components/map/ViewModeTabs";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { Switch } from "@/components/ui/switch";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
] as const;

const TIME_BASES = [
  { value: "local", label: "Local" },
  { value: "utc", label: "UTC" },
] as const;

type SettingsPanelProps = {
  settings: MapSettings;
  patchWindow: PatchWindowSize;
  onPatchWindowChange: (size: PatchWindowSize) => void;
  viewMode: MapViewMode;
  onViewModeChange: (mode: MapViewMode) => void;
  onClose: () => void;
};

export function SettingsPanel({
  settings,
  patchWindow,
  onPatchWindowChange,
  viewMode,
  onViewModeChange,
  onClose,
}: SettingsPanelProps) {
  const { theme, toggleTheme } = useTheme();

  return (
    <FloatingPanel label="Settings">
      <FieldGroup>
        <FieldSet>
          <FieldLegend variant="label">Appearance</FieldLegend>
          <div className="grid grid-cols-2 gap-2">
            <ViewModeTabs value={viewMode} onChange={onViewModeChange} />
            <SegmentedTabs<Theme>
              value={theme}
              onChange={(next) => {
                if (next !== theme) toggleTheme();
              }}
              options={THEMES}
              aria-label="Theme"
            />
          </div>
        </FieldSet>

        <FieldSeparator />

        <Field orientation="horizontal">
          <FieldLabel>Plot hours in</FieldLabel>
          <SegmentedTabs<TimeBasis>
            value={settings.timeBasis}
            onChange={settings.setTimeBasis}
            options={TIME_BASES}
            aria-label="Time basis"
            className="w-32 shrink-0"
          />
        </Field>

        <FieldSeparator />

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="setting-auto-zoom">
              Zoom to the picked cell
            </FieldLabel>
            <FieldDescription>
              The map flies to each cell you pick.
            </FieldDescription>
          </FieldContent>
          <Switch
            id="setting-auto-zoom"
            checked={settings.autoZoom}
            onCheckedChange={settings.setAutoZoom}
          />
        </Field>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="setting-show-patch">
              Show patch on map
            </FieldLabel>
            <FieldDescription>
              The dashed box around the picked cell.
            </FieldDescription>
          </FieldContent>
          <Switch
            id="setting-show-patch"
            checked={settings.showPatch}
            onCheckedChange={settings.setShowPatch}
          />
        </Field>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend variant="label">Cells kept per download</FieldLegend>
          <FieldDescription>
            A click downloads a 40 x 40 patch either way. This sets how much of
            it is kept, and what every year of it costs in memory.
          </FieldDescription>
          <RadioGroup
            value={String(patchWindow)}
            onValueChange={(value) =>
              onPatchWindowChange(Number(value) as PatchWindowSize)
            }
          >
            {PATCH_WINDOW_SIZES.map((size) => (
              <Field key={size} orientation="horizontal">
                <RadioGroupItem value={String(size)} id={`patch-${size}`} />
                <FieldContent>
                  <FieldLabel htmlFor={`patch-${size}`}>
                    {size} x {size}
                  </FieldLabel>
                  <FieldDescription>
                    All years: {formatBytes(allYearsBytesFor(size))}
                  </FieldDescription>
                </FieldContent>
              </Field>
            ))}
          </RadioGroup>
        </FieldSet>

        <FieldSeparator />

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel>Guide</FieldLabel>
            <FieldDescription>
              Six steps on picking a cell, reading its plots, and choosing
              years.
            </FieldDescription>
          </FieldContent>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClose();
              requestGuide();
            }}
          >
            <Compass />
            Restart
          </Button>
        </Field>
      </FieldGroup>
    </FloatingPanel>
  );
}
