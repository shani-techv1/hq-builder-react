"use client";

import * as React from "react";
import { Download, FolderInput, Upload } from "lucide-react";

import { useEditorState } from "@/components/editor/editor-state";
import { HeaderButton } from "@/components/header/header-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFilePicker } from "@/hooks/use-file-picker";
import {
  designFromJson,
  designToJson,
  exportFileName,
} from "@/lib/design-document";

/** The files a design is imported from: the JSON this editor exports. */
const DESIGN_FILE_ACCEPT = "application/json,.json";

/** Hand a generated file to the browser's downloader. */
function downloadFile(name: string, contents: string) {
  const url = URL.createObjectURL(
    new Blob([contents], { type: "application/json" }),
  );

  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();

  // The download has already been handed off by the time the click returns,
  // so the URL has done its job.
  URL.revokeObjectURL(url);
}

export interface DesignFile {
  exportDesign: () => Promise<void>;
  /** Opens the file dialog; the chosen file is imported straight away. */
  chooseFile: () => void;
  /** Spread onto an `<input>` the caller renders, as with `useFilePicker`. */
  inputProps: React.ComponentPropsWithRef<"input">;
}

/**
 * Export and import, for whichever menu offers them: the header's on a
 * desktop, and on a phone the toolbar's More menu, since the storefront's
 * header has no room left there.
 *
 * `report` is called with `null` as each attempt starts and with the reason if
 * it fails. Showing the reason is left to the caller — the header keeps a line
 * for it, while a phone's menu has closed by then and raises a toast.
 */
export function useDesignFile(
  report: (error: string | null) => void,
): DesignFile {
  const { snapshotDesign, restoreDesign } = useEditorState();

  const exportDesign = async () => {
    report(null);
    const design = snapshotDesign();
    try {
      downloadFile(exportFileName(design.name), await designToJson(design));
    } catch {
      report("The design could not be exported.");
    }
  };

  const importDesign = async ([file]: File[]) => {
    report(null);
    const design = designFromJson(await file.text());
    if (!design) {
      report("That file isn’t a design this editor can open.");
      return;
    }
    restoreDesign(design);
  };

  // The picker clears its value after every choice, so picking the same file
  // twice still imports it twice.
  const picker = useFilePicker((files) => void importDesign(files));

  return {
    exportDesign,
    chooseFile: picker.open,
    inputProps: {
      ...picker.inputProps,
      accept: DESIGN_FILE_ACCEPT,
      multiple: false,
    },
  };
}

/**
 * Taking a design out of the browser, and bringing one back.
 *
 * The draft in IndexedDB belongs to one browser on one machine; this is how a
 * design moves between them, or gets kept somewhere the editor cannot clear.
 * Artwork travels inside the file, so an exported design opens anywhere.
 */
export function DesignFileMenu() {
  const [error, setError] = React.useState<string | null>(null);
  const file = useDesignFile(setError);

  return (
    <>
      <input {...file.inputProps} />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <HeaderButton
              icon={FolderInput}
              label="Design file"
              variant="ghost"
            />
          }
        />

        <DropdownMenuContent align="end" sideOffset={6} className="w-52">
          <DropdownMenuItem
            className="px-2 py-1.5"
            onClick={() => void file.exportDesign()}
          >
            <Download aria-hidden />
            Export as JSON
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem className="px-2 py-1.5" onClick={file.chooseFile}>
            <Upload aria-hidden />
            Import from JSON
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* The menu has closed by the time an import fails, so the reason has to
          live in the header. Truncated rather than wrapped — it must not grow
          the bar — with the full text on hover and to assistive tech. */}
      {error ? (
        <span
          role="alert"
          title={error}
          className="max-w-[16rem] truncate text-[11.5px] font-medium text-destructive"
        >
          {error}
        </span>
      ) : null}
    </>
  );
}
