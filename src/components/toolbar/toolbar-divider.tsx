import { Separator } from "@/components/ui/separator";

/** Hairline between two toolbar groups. */
export function ToolbarDivider() {
  return (
    <Separator
      orientation="vertical"
      className="mx-1 shrink-0 data-vertical:h-5"
    />
  );
}
