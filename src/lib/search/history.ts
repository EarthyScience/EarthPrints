// Recent map searches, persisted to localStorage so they survive reloads.

import type { SearchResult } from "@/lib/search/geocode";

const STORAGE_KEY = "earthprints:search-history";
const MAX_ENTRIES = 5;

export function loadSearchHistory(): SearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SearchResult[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ENTRIES) : [];
  } catch {
    return [];
  }
}

export function pushSearchHistory(result: SearchResult): SearchResult[] {
  if (typeof window === "undefined") return [];
  const next = [
    result,
    ...loadSearchHistory().filter((entry) => entry.id !== result.id),
  ].slice(0, MAX_ENTRIES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore quota/serialization failures — history is best-effort.
  }
  return next;
}
