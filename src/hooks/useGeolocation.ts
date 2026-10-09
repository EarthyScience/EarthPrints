"use client";

import { useCallback, useEffect, useState } from "react";
import {
  describeGeolocationError,
  requestPosition,
  type UserPosition,
} from "@/lib/map/geolocate";

const ERROR_VISIBLE_MS = 6000;

export function useGeolocation() {
  const [position, setPosition] = useState<UserPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only a button press shows busy and errors: Chrome can leave the prompt from
  // the request on load open forever, which would keep the button disabled.
  const request = useCallback(
    async (interactive: boolean): Promise<UserPosition | null> => {
      if (interactive) setLocating(true);
      try {
        const next = await requestPosition();
        setPosition(next);
        setError(null);
        return next;
      } catch (cause) {
        if (interactive) setError(describeGeolocationError(cause));
        return null;
      } finally {
        if (interactive) setLocating(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), ERROR_VISIBLE_MS);
    return () => window.clearTimeout(timer);
  }, [error]);

  const clearError = useCallback(() => setError(null), []);

  return { position, locating, error, clearError, request };
}
