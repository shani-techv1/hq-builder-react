"use client";

import * as React from "react";

import { UPLOAD_ACCEPT } from "@/lib/asset-upload";

export interface FilePicker {
  /** Open the system file dialog. */
  open: () => void;
  /** Spread onto an `<input>` the caller renders — hidden, but in the tree. */
  inputProps: React.ComponentPropsWithRef<"input">;
}

/**
 * A file dialog, opened from whatever control makes sense.
 *
 * The input has to exist in the DOM for `click()` to reach it, so this hands
 * back props rather than rendering anything itself — the upload zone and the
 * sheet's empty state both want the same dialog behind quite different
 * buttons.
 *
 * The value is cleared after every selection so choosing the same file twice
 * in a row still fires `change`.
 */
export function useFilePicker(onFiles: (files: File[]) => void): FilePicker {
  const inputRef = React.useRef<HTMLInputElement>(null);

  const open = React.useCallback(() => inputRef.current?.click(), []);

  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.target.value = "";
      if (files.length > 0) onFiles(files);
    },
    [onFiles],
  );

  return {
    open,
    inputProps: {
      ref: inputRef,
      type: "file",
      multiple: true,
      accept: UPLOAD_ACCEPT,
      hidden: true,
      onChange: handleChange,
    },
  };
}
