"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { DATASET_PRESETS } from "@/lib/constants/datasets";
import { formatSelectedYearsLabel } from "@/lib/zarr/timeRange";
import type { Dataset, VariableInfo } from "@/lib/zarr/dataset";
import type { CellSeries } from "@/hooks/useCellSeries";
import { FloatingPanel } from "@/components/panels/FloatingPanel";
import { formatResolution } from "@/components/panels/CellView";
import {
  formatLatitude,
  formatLongitude,
  regionalExtent,
} from "@/lib/map/geogrid";
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
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
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
  const extent = regionalExtent(grid);
  if (extent) {
    rows.push([
      "Coverage",
      `${formatLatitude(extent.south, 1)} to ${formatLatitude(extent.north, 1)}, ${
        extent.allLongitudes
          ? "all longitudes"
          : `${formatLongitude(extent.west > 180 ? extent.west - 360 : extent.west, 1)} to ${formatLongitude(extent.east > 180 ? extent.east - 360 : extent.east, 1)}`
      }`,
    ]);
  }
  rows.push(["Units", dataset.units ?? "not given in the store"]);
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
  const { dataset, datasetLoading, datasetError, openSource, requestedSource } =
    series;
  // The field follows the store last asked for, so a link that failed or is
  // still opening shows its address rather than an empty field.
  const shownSource = requestedSource ?? dataset;
  const [url, setUrl] = useState(shownSource?.url ?? "");
  const [variable, setVariable] = useState(
    requestedSource?.variable ?? dataset?.variable ?? "",
  );
  // A new request shows its own address; a store that then opens shows the
  // root it resolved to. A failed open leaves the requested address alone.
  const [prevRequest, setPrevRequest] = useState(requestedSource);
  const [prevDataset, setPrevDataset] = useState(dataset);
  if (requestedSource !== prevRequest) {
    setPrevRequest(requestedSource);
    if (requestedSource) setUrl(requestedSource.url);
  }
  // Typing since the last Open wins over a store that finishes opening late.
  const [edited, setEdited] = useState(false);
  if (dataset !== prevDataset) {
    setPrevDataset(dataset);
    if (dataset && !edited) setUrl(dataset.url);
  }
  const [askedForVariable, setAskedForVariable] = useState(false);
  const promptsForVariable = Boolean(
    datasetError && /Type the variable|no array called/.test(datasetError),
  );
  if (promptsForVariable && !askedForVariable) setAskedForVariable(true);
  if (dataset && !datasetError && askedForVariable) setAskedForVariable(false);
  // A store that cannot list its arrays has no picker, so its variable stays
  // a text field to switch or correct.
  const unlisted = Boolean(dataset && dataset.variables.length === 0);
  const needsVariable = promptsForVariable || askedForVariable || unlisted;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    // The variable field belongs to the store that asked for it; a different
    // address starts without one.
    const sameStore = url.trim() === (requestedSource?.url ?? dataset?.url);
    setEdited(false);
    openSource({
      url: url.trim(),
      variable: needsVariable && sameStore ? variable : null,
    });
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
                onChange={(event) => {
                  setUrl(event.target.value);
                  setEdited(true);
                }}
                placeholder="https://…/store.zarr"
                spellCheck={false}
                autoComplete="off"
                inputMode="url"
              />
              <Button type="submit" disabled={!url.trim()}>
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
                autoFocus
              />
            </Field>
          ) : null}
          {datasetError ? (
            <Alert role="alert" variant="destructive">
              <AlertDescription>
                {datasetError}
                {dataset ? ` Still showing ${dataset.title}.` : ""}
              </AlertDescription>
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
              <VariablePicker
                variables={dataset.variables}
                value={dataset.variable}
                disabled={datasetLoading}
                onChange={(next) => openSource({ url: dataset.url, variable: next })}
              />
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
                  disabled={current && !datasetError}
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

/** "atmosphere/tas" as its leaf and the groups it sits in. */
function splitPath(path: string): { leaf: string; groups: string } {
  const at = path.lastIndexOf("/");
  return at < 0
    ? { leaf: path, groups: "" }
    : { leaf: path.slice(at + 1), groups: path.slice(0, at) };
}

/**
 * Some stores hold hundreds of arrays (ERA5 has 273), so the variable is
 * picked by typing part of its name, long name or group path.
 */
function VariablePicker({
  variables,
  value,
  disabled,
  onChange,
}: {
  variables: VariableInfo[];
  value: string;
  disabled: boolean;
  onChange: (path: string) => void;
}) {
  const selected = variables.find((option) => option.path === value) ?? null;
  return (
    <Field>
      <FieldLabel htmlFor="dataset-variable-picker">Variable</FieldLabel>
      <Combobox<VariableInfo>
        items={variables}
        value={selected}
        onValueChange={(next) => {
          if (next && next.path !== value) onChange(next.path);
        }}
        itemToStringLabel={(option) => option.path}
        isItemEqualToValue={(a, b) => a.path === b.path}
        filter={(option, query) => {
          const needle = query.trim().toLowerCase();
          return (
            !needle ||
            option.path.toLowerCase().includes(needle) ||
            (option.longName?.toLowerCase().includes(needle) ?? false)
          );
        }}
        disabled={disabled}
        autoHighlight
      >
        <ComboboxInput
          id="dataset-variable-picker"
          placeholder="Search variables"
          autoComplete="off"
          spellCheck={false}
          className="w-full"
          disabled={disabled}
        />
        <ComboboxContent>
          <ComboboxEmpty>No variable matches.</ComboboxEmpty>
          <ComboboxList>
            {(option: VariableInfo) => {
              const { leaf, groups } = splitPath(option.path);
              return (
                <ComboboxItem key={option.path} value={option}>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="break-words">
                      <span className="font-medium">{leaf}</span>
                      {groups ? (
                        <span className="text-muted-foreground"> in {groups}</span>
                      ) : null}
                    </span>
                    {option.longName ? (
                      <span className="text-xs break-words text-muted-foreground">
                        {option.longName}
                      </span>
                    ) : null}
                  </span>
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  );
}
