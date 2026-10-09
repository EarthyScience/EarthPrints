import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export const FLOATING_PANEL_WIDTH = "w-[min(380px,calc(100vw-24px))]";

type FloatingPanelProps = {
  label: string;
  children: React.ReactNode;
  scrollClassName?: string;
};

export function FloatingPanel({
  label,
  children,
  scrollClassName = "[&>[data-slot=scroll-area-viewport]]:max-h-[calc(100dvh-8rem)]",
}: FloatingPanelProps) {
  return (
    <Card
      aria-label={label}
      className={`${FLOATING_PANEL_WIDTH} origin-top-left animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-150 ease-out motion-reduce:animate-none`}
    >
      <ScrollArea className={scrollClassName}>
        <CardContent>{children}</CardContent>
      </ScrollArea>
    </Card>
  );
}
