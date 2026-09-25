"use client";

import * as React from "react";
import {
  CopyPlus,
  Download,
  FolderOpen,
  Grid2x2,
  Magnet,
  MoreHorizontal,
  Scan,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import { useDesignFile } from "@/components/editor/design-file-menu";
import { SavedDesignsDialog } from "@/components/editor/saved-designs-menu";
import { ToolbarButton } from "@/components/toolbar/toolbar-button";
import { toast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSavedDesigns } from "@/hooks/use-saved-designs";
import { MAX_ZOOM, MIN_ZOOM, zoomIn, zoomOut } from "@/lib/workspace";

export interface ToolbarOverflowMenuProps {
  showGrid: boolean;
  onShowGridChange: (value: boolean) => void;
  snapEnabled: boolean;
  onSnapEnabledChange: (value: boolean) => void;
  zoom: number;
  onZoomChange: (value: number) => void;
  /** Back to the whole width of the sheet. */
  onZoomToFit: () => void;
}

/**
 * The controls a phone has no room to show in the row.
 *
 * The ones set once and left — the grid, snapping — and zoom, which a phone
 * reaches for far less often than a desktop does because the sheet opens
 * fitted to the screen. What stays in the row is what gets pressed while
 * working: history, text, the background preview and the sheet size.
 *
 * My designs, Save as new and the design file's export and import land here
 * too, from the header: on a phone the storefront's cart buttons need the
 * room, and this is the one menu a phone always has.
 *
 * The zoom steps keep the menu open, so stepping in three times is three taps
 * rather than three trips back to this button; the readout in the group's
 * label is what shows each one landing.
 */
export function ToolbarOverflowMenu({
  showGrid,
  onShowGridChange,
  snapEnabled,
  onSnapEnabledChange,
  zoom,
  onZoomChange,
  onZoomToFit,
}: ToolbarOverflowMenuProps) {
  // The menu has closed by the time an import fails, so the reason is raised
  // as a toast rather than written into it.
  const designFile = useDesignFile((error) => {
    if (error) toast.error(error);
  });
  const [designsOpen, setDesignsOpen] = React.useState(false);
  const saved = useSavedDesigns();

  return (
    <>
      <input {...designFile.inputProps} />
      <SavedDesignsDialog open={designsOpen} onOpenChange={setDesignsOpen} />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={<ToolbarButton icon={MoreHorizontal} label="More tools" />}
        />

        <DropdownMenuContent align="end" sideOffset={6} className="w-52">
          <DropdownMenuCheckboxItem
            checked={showGrid}
            onCheckedChange={onShowGridChange}
            className="py-1.5"
          >
            <Grid2x2 aria-hidden />
            Grid
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={snapEnabled}
            onCheckedChange={onSnapEnabledChange}
            className="py-1.5"
          >
            <Magnet aria-hidden />
            Snap to guides
          </DropdownMenuCheckboxItem>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel className="flex justify-between">
              Zoom
              <span className="tabular-nums text-foreground">{zoom}%</span>
            </DropdownMenuLabel>
            <DropdownMenuItem
              closeOnClick={false}
              disabled={zoom >= MAX_ZOOM}
              onClick={() => onZoomChange(zoomIn(zoom))}
              className="py-1.5"
            >
              <ZoomIn aria-hidden />
              Zoom in
            </DropdownMenuItem>
            <DropdownMenuItem
              closeOnClick={false}
              disabled={zoom <= MIN_ZOOM}
              onClick={() => onZoomChange(zoomOut(zoom))}
              className="py-1.5"
            >
              <ZoomOut aria-hidden />
              Zoom out
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onZoomToFit} className="py-1.5">
              <Scan aria-hidden />
              Fit to screen
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onClick={() => setDesignsOpen(true)}
            className="py-1.5"
          >
            <FolderOpen aria-hidden />
            My designs
          </DropdownMenuItem>
          {/* Only once there is a saved design to copy; before that, the
              header's Save already makes a new one. */}
          {saved.access === "ready" && saved.currentId ? (
            <DropdownMenuItem
              onClick={() => void saved.save({ asNew: true })}
              disabled={saved.busy !== null}
              className="py-1.5"
            >
              <CopyPlus aria-hidden />
              Save as new
            </DropdownMenuItem>
          ) : null}

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel>Design file</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => void designFile.exportDesign()}
              className="py-1.5"
            >
              <Download aria-hidden />
              Export as JSON
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={designFile.chooseFile}
              className="py-1.5"
            >
              <Upload aria-hidden />
              Import from JSON
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
