"use client";

import { useEffect, useRef } from "react";
import { drawHeroField } from "@/lib/hero/drawHeroField";
import { useTheme } from "@/providers/ThemeProvider";

export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { isLight } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let raf = 0;
    let start = performance.now();

    const drawFrame = (now: number) => {
      const time = reduceMotion ? 0 : (now - start) / 1000;
      drawHeroField(canvas, isLight, time);
      if (!reduceMotion) {
        raf = requestAnimationFrame(drawFrame);
      }
    };

    const onResize = () => {
      cancelAnimationFrame(raf);
      start = performance.now();
      if (reduceMotion) {
        drawHeroField(canvas, isLight, 0);
      } else {
        raf = requestAnimationFrame(drawFrame);
      }
    };

    if (reduceMotion) {
      drawHeroField(canvas, isLight, 0);
    } else {
      raf = requestAnimationFrame(drawFrame);
    }

    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [isLight]);

  return <canvas id="heroCanvas" ref={canvasRef} />;
}
