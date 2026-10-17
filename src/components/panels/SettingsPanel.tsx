"use client";

import {
  allYearsBytesFor,
  formatBytes,
  PATCH_WINDOW_SIZES,
  type PatchWindowSize,
} from "@/lib/settings/patchWindow";
import type { MapViewMode } from "@/types/map";
import type { MapSettings } from "@/hooks/useMapSettings";
import { FloatingPanel } from "@/components/panels/FloatingPanel";
import { ViewModeTabs } from "@/components/map/ViewModeTabs";
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
import { Switch } from "@/components/ui/switch";

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
  return (
    <FloatingPanel label="Settings" onClose={onClose}>
      <FieldGroup>
        <FieldSet>
          <FieldLegend variant="label">Projection</FieldLegend>
          <ViewModeTabs value={viewMode} onChange={onViewModeChange} />
        </FieldSet>

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
      </FieldGroup>
    </FloatingPanel>
  );
}
