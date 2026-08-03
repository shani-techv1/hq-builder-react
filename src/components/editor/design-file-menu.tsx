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
import {
  designFromJson,
  designToJson,
  exportFileName,
} from "@/lib/design-document";

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

/**
 * Taking a design out of the browser, and bringing one back.
 *
 * The draft in IndexedDB belongs to one browser on one machine; this is how a
 * design moves between them, or gets kept somewhere the editor cannot clear.
 * Artwork travels inside the file, so an exported design opens anywhere.
 */
export function DesignFileMenu() {
  const { snapshotDesign, restoreDesign } = useEditorState();
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setError(null);
    const design = snapshotDesign();
    try {
      downloadFile(exportFileName(design.name), await designToJson(design));
    } catch {
      setError("The design could not be exported.");
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Cleared straight away so picking the same file twice still fires.
    event.target.value = "";
    if (!file) return;

    setError(null);
    const design = designFromJson(await file.text());
    if (!design) {
      setError("That file isn’t a design this editor can open.");
      return;
    }
    restoreDesign(design);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(event) => void handleImport(event)}
      />

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
            onClick={() => void handleExport()}
          >
            <Download aria-hidden />
            Export as JSON
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            className="px-2 py-1.5"
            onClick={() => inputRef.current?.click()}
          >
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
