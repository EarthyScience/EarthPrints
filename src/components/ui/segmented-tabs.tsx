"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "cn";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Exported for tab switches that also own TabsContent (see CellPanel).
export const segmentedListClass = "border";
export const segmentedTriggerClass =
  "data-active:border-brand/40 data-active:bg-brand/15 data-active:text-brand data-active:shadow-none dark:data-active:border-brand/40 dark:data-active:bg-brand/15 dark:data-active:text-brand";

type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: LucideIcon;
};

type SegmentedTabsProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  "aria-label": string;
  className?: string;
};

export function SegmentedTabs<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel,
  className,
}: SegmentedTabsProps<T>) {
  return (
    <Tabs
      value={value}
      onValueChange={(next) => onChange(next as T)}
      aria-label={ariaLabel}
      className={className}
    >
      <TabsList className={cn("w-full", segmentedListClass)}>
        {options.map(({ value: option, label, icon: Icon }) => (
          <TabsTrigger
            key={option}
            value={option}
            className={segmentedTriggerClass}
          >
            {Icon ? <Icon /> : null}
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
