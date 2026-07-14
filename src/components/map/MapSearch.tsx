"use client";

import { useEffect, useRef, useState } from "react";
import { CrosshairIcon } from "@/icons/CrosshairIcon";
import { SearchIcon } from "@/icons/SearchIcon";
import {
  geocodeAddress,
  parseCoordinates,
  type SearchResult,
} from "@/lib/search/geocode";
import { loadSearchHistory, pushSearchHistory } from "@/lib/search/history";

type MapSearchProps = {
  onSelect: (lon: number, lat: number) => void;
  className?: string;
};

type Status = "idle" | "loading" | "done" | "error";

const DEBOUNCE_MS = 300;

export function MapSearch({ onSelect, className }: MapSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const skipNextFetchRef = useRef(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const [history, setHistory] = useState<SearchResult[]>(() =>
    loadSearchHistory(),
  );
  const [activeIndex, setActiveIndex] = useState(0);

  const trimmed = query.trim();
  const coord = parseCoordinates(trimmed);

  // Focus the input when the user presses "/" outside of another field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
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

  // Debounced address lookup. Empty/coordinate input is resolved in the change
  // handler, so this effect only fires network requests and updates state from
  // their async results.
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
          setActiveIndex(0);
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
    setActiveIndex(0);
    const q = value.trim();
    if (q && !parseCoordinates(q)) {
      setStatus("loading");
    } else {
      setResults([]);
      setStatus(q ? "done" : "idle");
    }
  };

  const list: SearchResult[] = trimmed
    ? coord
      ? [coord, ...results]
      : results
    : history;

  const showEmpty =
    Boolean(trimmed) && !coord && status !== "loading" && results.length === 0;
  const showDropdown =
    open && (list.length > 0 || status === "loading" || showEmpty);

  const select = (result: SearchResult) => {
    onSelect(result.lon, result.lat);
    setHistory(pushSearchHistory(result));
    skipNextFetchRef.current = true;
    setQuery(result.label);
    setOpen(false);
    inputRef.current?.blur();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(list.length - 1, index + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === "Enter") {
      const target = list[activeIndex] ?? list[0] ?? coord;
      if (target) {
        event.preventDefault();
        select(target);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        className={`flex h-10 items-center gap-2.5 rounded-editor-sm border bg-editor-bg-base px-3 shadow-editor transition-colors ${
          open ? "border-accent" : "border-editor-border"
        }`}
      >
        <span className="flex-shrink-0 text-editor-fg-tertiary">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          placeholder="Search address or coordinates"
          aria-label="Search address or coordinates"
          className="min-w-0 flex-1 bg-transparent text-sm text-editor-fg-primary placeholder:text-editor-fg-tertiary focus:outline-none"
        />
        {query ? (
          <button
            type="button"
            // Keep the input focused so clearing doesn't close the box.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onQueryChange("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="grid size-6 flex-shrink-0 place-items-center rounded-full text-editor-fg-tertiary transition-colors hover:bg-editor-bg-secondary hover:text-editor-fg-primary"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        ) : !open ? (
          <kbd className="flex-shrink-0 rounded-[5px] border border-editor-border px-1.5 py-0.5 font-mono text-[11px] text-editor-fg-tertiary">
            /
          </kbd>
        ) : null}
      </div>

      {showDropdown ? (
        <div
          // Keep input focus so clicking a row still fires its onClick.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-full z-10 mt-2 overflow-hidden rounded-editor-sm border border-editor-border bg-editor-bg-base py-1 shadow-editor"
        >
          {status === "loading" ? (
            <p className="px-3 py-3 text-sm text-editor-fg-tertiary">Searching…</p>
          ) : showEmpty ? (
            <p className="px-3 py-3 text-sm text-editor-fg-tertiary">
              No matches for “{trimmed}”.
            </p>
          ) : (
            <>
              {!trimmed ? (
                <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-editor-fg-tertiary">
                  Recent
                </p>
              ) : null}
              {list.map((result, index) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => select(result)}
                  onMouseEnter={() => setActiveIndex(index)}
                  data-active={index === activeIndex}
                  className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left data-[active=true]:bg-editor-bg-secondary"
                >
                  <span className="flex-shrink-0 text-editor-fg-tertiary">
                    <CrosshairIcon />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-sm text-editor-fg-primary">
                      {result.label}
                    </span>
                    {result.detail ? (
                      <span className="block truncate text-xs text-editor-fg-tertiary">
                        {result.detail}
                      </span>
                    ) : null}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
