import { describe, expect, it } from "vitest";
import {
  DEFAULT_MAP_VIEW,
  SELECTION_FOCUS_TRANSITION_MS,
  SELECTION_FOCUS_ZOOM,
  SPHERE_SELECTION_FOCUS_ZOOM,
  viewStateFocusedOnCell,
} from "@/lib/map/viewState";

describe("viewStateFocusedOnCell", () => {
  const cell = {
    lon: 10.025,
    lat: 52.025,
    lonIndex: 3800,
    latIndex: 759,
  };

  it("centers and zooms in when the map is zoomed out", () => {
    const next = viewStateFocusedOnCell(DEFAULT_MAP_VIEW, cell);

    expect(next.longitude).toBe(cell.lon);
    expect(next.latitude).toBe(cell.lat);
    expect(next.zoom).toBe(SELECTION_FOCUS_ZOOM);
    expect(next.transitionDuration).toBe(SELECTION_FOCUS_TRANSITION_MS);
  });

  it("recenters but keeps zoom when already closer than the focus level", () => {
    const current = { ...DEFAULT_MAP_VIEW, zoom: 11 };
    const next = viewStateFocusedOnCell(current, cell);

    expect(next.longitude).toBe(cell.lon);
    expect(next.latitude).toBe(cell.lat);
    expect(next.zoom).toBe(11);
  });

  it("returns the same object when nothing changes", () => {
    const current = {
      ...DEFAULT_MAP_VIEW,
      longitude: cell.lon,
      latitude: cell.lat,
      zoom: SELECTION_FOCUS_ZOOM,
    };

    expect(viewStateFocusedOnCell(current, cell)).toBe(current);
  });

  it("zooms in further on the globe than in plan view", () => {
    const next = viewStateFocusedOnCell(DEFAULT_MAP_VIEW, cell, "sphere");

    expect(next.zoom).toBe(SPHERE_SELECTION_FOCUS_ZOOM);
    expect(SPHERE_SELECTION_FOCUS_ZOOM).toBeGreaterThan(SELECTION_FOCUS_ZOOM);
  });
});
