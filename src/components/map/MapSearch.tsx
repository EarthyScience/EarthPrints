"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import {
  geocodeAddress,
  parseCoordinates,
  type SearchResult,
} from "@/lib/search/geocode";
import { loadSearchHistory, pushSearchHistory } from "@/lib/search/history";
import {
  Combobox,
  ComboboxContent,
  ComboboxCollection,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { InputGroupAddon } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";

type Status = "idle" | "loading" | "done" | "error";

type ResultGroup = {
  value: string;
  label: string | null;
  items: SearchResult[];
};

const DEBOUNCE_MS = 300;

type MapSearchProps = {
  onSelect: (lon: number, lat: number) => void;
};

export function MapSearch({ onSelect }: MapSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const anchor = useComboboxAnchor();
  const skipNextFetchRef = useRef(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [history, setHistory] = useState<SearchResult[]>([]);

  const trimmed = query.trim();
  const coord = parseCoordinates(trimmed);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        return;
      }
      event.preventDefault();
      inputRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (skipNextFetchRef.current) {
      skipNextFetchRef.current = false;
      return;
    }
    const q = query.trim();
    if (!q || parseCoordinates(q)) return;

    const controller = new AbortController();
    const timer = setTimeout(() => {
      geocodeAddress(q, controller.signal)
        .then((next) => {
          setResults(next);
          setStatus("done");
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setResults([]);
          setStatus("error");
        });
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const onQueryChange = (value: string) => {
    setQuery(value);
    const q = value.trim();
    if (q && !parseCoordinates(q)) {
      setStatus("loading");
    } else {
      setResults([]);
      setStatus(q ? "done" : "idle");
    }
  };

  const groups: ResultGroup[] = trimmed
    ? [
        {
          value: "results",
          label: null,
          items: coord ? [coord, ...results] : results,
        },
      ]
    : [{ value: "recent", label: "Recent", items: history }];

  const select = (result: SearchResult | null) => {
    if (!result) return;
    onSelect(result.lon, result.lat);
    setHistory(pushSearchHistory(result));
    skipNextFetchRef.current = true;
    setQuery(result.label);
    inputRef.current?.blur();
  };

  return (
    <Combobox<SearchResult>
      items={groups}
      filter={null}
      value={null}
      onValueChange={select}
      inputValue={query}
      onInputValueChange={onQueryChange}
      onOpenChange={(open) => {
        if (open) setHistory(loadSearchHistory());
      }}
      itemToStringLabel={(item) => item.label}
      isItemEqualToValue={(a, b) => a.id === b.id}
      autoHighlight
    >
      <div ref={anchor}>
        <ComboboxInput
          ref={inputRef}
          placeholder="Search address or coordinates"
          aria-label="Search address or coordinates"
          autoComplete="off"
          spellCheck={false}
          showTrigger={false}
          showClear={Boolean(query)}
          className="h-10 rounded-xl bg-background dark:bg-background has-[[data-slot=input-group-control]:focus-visible]:ring-0"
        >
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          {query ? null : (
            <InputGroupAddon align="inline-end">
              <Kbd>/</Kbd>
            </InputGroupAddon>
          )}
        </ComboboxInput>
      </div>
      <ComboboxContent anchor={anchor} className="rounded-xl">
        <ComboboxEmpty>
          {status === "loading"
            ? "Searching…"
            : trimmed
              ? `No matches for “${trimmed}”.`
              : "No recent searches."}
        </ComboboxEmpty>
        <ComboboxList>
          {(group: ResultGroup) => (
            <ComboboxGroup key={group.value} items={group.items}>
              {group.label ? (
                <ComboboxLabel>{group.label}</ComboboxLabel>
              ) : null}
              <ComboboxCollection>
                {(result: SearchResult) => (
                  <ComboboxItem
                    key={result.id}
                    value={result}
                    className="cursor-pointer"
                  >
                    <MapPin className="text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate">{result.label}</div>
                      {result.detail ? (
                        <div className="truncate text-muted-foreground">
                          {result.detail}
                        </div>
                      ) : null}
                    </div>
                  </ComboboxItem>
                )}
              </ComboboxCollection>
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
