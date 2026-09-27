"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import {
  DEFAULT_SQUARE_LOGO_SIZE,
  SQUARE_LOGO_PRESETS,
} from "@/lib/export/fingerprintSquareLogo";
import { useCellExport } from "@/hooks/useCellExport";
import type { CellSeries } from "@/hooks/useCellSeries";
import type { SeriesDisplay } from "@/hooks/useSeriesDisplay";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ExportFormat = "zip" | "pdf" | "csv" | "badge";

const FORMATS: { value: ExportFormat; title: string; description: string }[] = [
  {
    value: "zip",
    title: "Full package (.zip)",
    description: "PDF report, Excel and CSV tables, and all plot graphics",
  },
  {
    value: "pdf",
    title: "Scientific report (.pdf)",
    description: "Map, both plots and the cell's provenance",
  },
  {
    value: "csv",
    title: "Series data (.csv)",
    description: "The hourly values as stored",
  },
  {
    value: "badge",
    title: "Square fingerprint badge (.png)",
    description: "The fingerprint alone, in the selected palette",
  },
];

type CellExportProps = {
  series: CellSeries;
  display: SeriesDisplay;
};

export function CellExport({ series, display }: CellExportProps) {
  const [format, setFormat] = useState<ExportFormat>("zip");
  const [badgeSize, setBadgeSize] = useState(DEFAULT_SQUARE_LOGO_SIZE);
  const ready = !series.loading && display.hasPlottableData;
  const exporter = useCellExport({
    selection: series.selection,
    gridSpec: series.gridSpec,
    selectedYears: series.selectedYears,
    values: ready ? series.values : null,
    displayValues: ready ? display.displayValues : null,
    timeBasis: display.timeBasis,
    units: series.units,
    colormapId: display.colormapId,
  });
  const busy = exporter.busyLabel !== null;

  const download = () => {
    if (format === "zip") void exporter.exportZip();
    else if (format === "pdf") void exporter.exportPdf();
    else if (format === "csv") void exporter.exportCsv();
    else void exporter.exportBadge(badgeSize);
  };

  return (
    <div className="grid gap-4">
      <RadioGroup
        value={format}
        onValueChange={(value) => setFormat(value as ExportFormat)}
        aria-label="Export format"
      >
        {FORMATS.map((option) => (
          <FieldLabel key={option.value} htmlFor={`export-${option.value}`}>
            <Field orientation="horizontal">
              <FieldContent>
                <FieldTitle>{option.title}</FieldTitle>
                <FieldDescription>{option.description}</FieldDescription>
              </FieldContent>
              <RadioGroupItem
                value={option.value}
                id={`export-${option.value}`}
              />
            </Field>
          </FieldLabel>
        ))}
      </RadioGroup>

      {format === "badge" ? (
        <Field>
          <FieldLabel>Badge size</FieldLabel>
          <Select
            value={String(badgeSize)}
            onValueChange={(value) => setBadgeSize(Number(value))}
          >
            <SelectTrigger className="w-full">
              <SelectValue>
                {SQUARE_LOGO_PRESETS.find((p) => p.size === badgeSize)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {SQUARE_LOGO_PRESETS.map((preset) => (
                <SelectItem key={preset.id} value={String(preset.size)}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      ) : null}

      <Button onClick={download} disabled={!ready || busy}>
        <Download />
        {exporter.busyLabel ?? "Download"}
      </Button>

      {exporter.error ? (
        <Alert variant="destructive">
          <AlertDescription>{exporter.error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}
