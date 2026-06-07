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

    let raf = 0;

    const draw = () => {
      drawHeroField(canvas, isLight);
    };

    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };

    draw();
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [isLight]);

  return <canvas id="heroCanvas" ref={canvasRef} />;
}
