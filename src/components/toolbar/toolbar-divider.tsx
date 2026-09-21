import { Separator } from "@/components/ui/separator";

/**
 * Hairline between two toolbar groups. Closer in on a phone, where the toolbar
 * has to fit the width of the screen.
 *
 * Centred explicitly: the separator stretches by default, and a stretched item
 * given a fixed height sits at the top of the row instead of beside the middle
 * of the buttons it divides.
 */
export function ToolbarDivider() {
  return (
    <Separator
      orientation="vertical"
      className="mx-0.5 shrink-0 data-vertical:h-5 data-vertical:self-center md:mx-1"
    />
  );
}
