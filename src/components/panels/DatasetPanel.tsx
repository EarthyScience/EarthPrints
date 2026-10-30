"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { DATASET_PRESETS } from "@/lib/constants/datasets";
import { formatSelectedYearsLabel } from "@/lib/zarr/timeRange";
import type { Dataset } from "@/lib/zarr/dataset";
import type { CellSeries } from "@/hooks/useCellSeries";
import { FloatingPanel } from "@/components/panels/FloatingPanel";
import { formatResolution } from "@/components/panels/CellView";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DatasetPanelProps = {
  series: CellSeries;
  onClose: () => void;
};

function dimLabel(dim: Dataset["layout"]["extras"][number], index: number) {
  const value = dim.labels?.[index];
  if (value === undefined) return String(index);
  return dim.units ? `${value} ${dim.units}` : value;
}

function Facts({ dataset }: { dataset: Dataset }) {
  const { grid, time } = dataset;
  const rows: [string, string][] = [
    ["Grid", `${formatResolution(grid.spatialResolutionDeg)} · ${grid.dimensions.lat.toLocaleString()} × ${grid.dimensions.lon.toLocaleString()} cells`],
    ["Time", `${time.stepLabel} · ${formatSelectedYearsLabel(time.years)}`],
  ];
  if (dataset.units) rows.push(["Units", dataset.units]);
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
      {rows.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-muted-foreground">{term}</dt>
          <dd className="min-w-0 break-words tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DatasetPanel({ series, onClose }: DatasetPanelProps) {
  const { dataset, datasetLoading, datasetError, openSource } = series;
  const [url, setUrl] = useState(dataset?.url ?? "");
  const [variable, setVariable] = useState("");
  const [prevUrl, setPrevUrl] = useState(dataset?.url);
  if (dataset?.url !== prevUrl) {
    setPrevUrl(dataset?.url);
    if (dataset) setUrl(dataset.url);
  }
  const needsVariable = Boolean(datasetError?.includes("Type the variable"));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    openSource({ url, variable: needsVariable ? variable : null });
  };

  return (
    <FloatingPanel label="Data" onClose={onClose}>
      <FieldGroup>
        <form onSubmit={submit} className="grid gap-3">
          <Field>
            <FieldLabel htmlFor="dataset-url">Zarr store</FieldLabel>
            <FieldDescription>
              The address of a public Zarr v2 or v3 store with a time, latitude
              and longitude dimension.
            </FieldDescription>
            <div className="flex gap-2">
              <Input
                id="dataset-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://…/store.zarr"
                spellCheck={false}
                autoComplete="off"
                inputMode="url"
              />
              <Button type="submit" disabled={datasetLoading || !url.trim()}>
                {datasetLoading ? (
                  <LoaderCircle className="animate-spin" />
                ) : null}
                Open
              </Button>
            </div>
          </Field>
          {needsVariable ? (
            <Field>
              <FieldLabel htmlFor="dataset-variable">Variable</FieldLabel>
              <Input
                id="dataset-variable"
                value={variable}
                onChange={(event) => setVariable(event.target.value)}
                placeholder="e.g. t2m"
                spellCheck={false}
                autoComplete="off"
              />
            </Field>
          ) : null}
          {datasetError ? (
            <Alert role="alert">
              <AlertDescription>{datasetError}</AlertDescription>
            </Alert>
          ) : null}
        </form>

        {dataset ? (
          <>
            <FieldSeparator />
            <div className="grid gap-3">
              <div className="grid gap-0.5">
                <span className="text-sm font-medium break-words">
                  {dataset.title}
                </span>
                {dataset.title !== (dataset.longName ?? dataset.variable) ? (
                  <span className="text-sm text-muted-foreground break-words">
                    {dataset.longName ?? dataset.variable}
                  </span>
                ) : null}
              </div>
              <Facts dataset={dataset} />
            </div>

            {dataset.variables.length > 1 ? (
              <Field>
                <FieldLabel>Variable</FieldLabel>
                <Select
                  value={dataset.variable}
                  disabled={datasetLoading}
                  onValueChange={(next) =>
                    openSource({ url: dataset.url, variable: String(next) })
                  }
                >
                  <SelectTrigger aria-label="Variable" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {dataset.variables.map((option) => (
                      <SelectItem key={option.path} value={option.path}>
                        {option.longName
                          ? `${option.path} · ${option.longName}`
                          : option.path}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}

            {dataset.layout.extras
              .filter((dim) => dim.size > 1)
              .map((dim) => (
                <Field key={dim.axis}>
                  <FieldLabel>{dim.name}</FieldLabel>
                  <Select
                    value={String(series.extraIndices[dim.axis] ?? 0)}
                    onValueChange={(next) =>
                      series.setExtraIndex(dim.axis, Number(next))
                    }
                  >
                    <SelectTrigger aria-label={dim.name} className="w-full">
                      <SelectValue>
                        {(value: string) => dimLabel(dim, Number(value))}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: dim.size }, (_, index) => (
                        <SelectItem key={index} value={String(index)}>
                          {dimLabel(dim, index)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ))}
          </>
        ) : null}

        <FieldSeparator />

        <Field>
          <FieldLabel>Examples</FieldLabel>
          <div className="grid gap-1">
            {DATASET_PRESETS.map((preset) => {
              const current =
                dataset?.url === preset.url && dataset.variable === preset.variable;
              return (
                <button
                  key={preset.url}
                  type="button"
                  disabled={datasetLoading || current}
                  onClick={() => openSource(preset)}
                  className="grid gap-0.5 rounded-md px-2 py-1.5 text-left outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none aria-[current=true]:bg-brand/10"
                  aria-current={current}
                >
                  <span className="text-sm font-medium">{preset.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {preset.description}
                  </span>
                </button>
              );
            })}
          </div>
        </Field>
      </FieldGroup>
    </FloatingPanel>
  );
}
