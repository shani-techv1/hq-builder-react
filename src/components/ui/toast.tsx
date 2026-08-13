"use client";

import * as React from "react";
import { Toast } from "@base-ui/react/toast";
import { CircleCheck, TriangleAlert, X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * One manager for the whole app, created outside the React tree.
 *
 * Toasts are raised from event handlers — a code was sent, a sign-in failed —
 * and the thing raising them is rarely the thing rendering them. A module-level
 * manager means `toast.success(…)` works from anywhere without a hook, a
 * context read, or a callback threaded down through props. {@link ToastProvider}
 * is what connects it to the tree, and it is mounted once in the root layout.
 */
const manager = Toast.createToastManager();

/**
 * Two kinds, because a toast is either good news or bad news.
 *
 * Errors are announced urgently and given longer on screen: they are read once
 * and cannot be brought back, and the reason a request failed is worth more
 * than the confirmation that one succeeded.
 */
export const toast = {
  success(title: string, description?: string) {
    manager.add({ type: "success", title, description });
  },
  error(title: string, description?: string) {
    manager.add({ type: "error", title, description, priority: "high", timeout: 8000 });
  },
};

/** The viewport, and everything mounted into it. Wraps the app once. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <Toast.Provider toastManager={manager}>
      {children}

      <Toast.Portal>
        <Toast.Viewport
          className={cn(
            // Above the account dialog, which is what most of these report on.
            "fixed bottom-4 right-4 z-[60] flex flex-col gap-2 outline-none",
            "w-[min(22rem,calc(100vw-2rem))]",
          )}
        >
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

/**
 * A plain column rather than the peeking stack Base UI demonstrates.
 *
 * Nothing here fires toasts in bursts — at most one per request — so the
 * collapsed stack would only ever hide a message behind a decoration.
 */
function ToastList() {
  const { toasts } = Toast.useToastManager();

  return toasts.map((entry) => {
    const failed = entry.type === "error";

    return (
      <Toast.Root
        key={entry.id}
        toast={entry}
        className={cn(
          "overflow-hidden rounded-card border border-border bg-card shadow-panel",
          "transition-all duration-200 ease-out",
          "data-starting-style:translate-y-2 data-starting-style:opacity-0",
          "data-ending-style:translate-y-1 data-ending-style:opacity-0",
        )}
      >
        <Toast.Content className="flex items-start gap-2.5 p-3">
          <span
            aria-hidden
            className={cn(
              "mt-px grid size-7 shrink-0 place-items-center rounded-lg",
              failed
                ? "bg-destructive/10 text-destructive"
                : "bg-primary-soft text-primary",
            )}
          >
            {failed ? (
              <TriangleAlert className="size-4" strokeWidth={2} />
            ) : (
              <CircleCheck className="size-4" strokeWidth={2} />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <Toast.Title className="text-[13px] font-semibold leading-snug text-foreground" />
            {entry.description ? (
              <Toast.Description className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground" />
            ) : null}
          </div>

          <Toast.Close
            aria-label="Dismiss"
            className={cn(
              "-mr-1 -mt-1 grid size-7 shrink-0 place-items-center rounded-lg text-muted-foreground",
              "transition-colors outline-none hover:bg-muted hover:text-foreground",
              "focus-visible:ring-3 focus-visible:ring-ring/40",
            )}
          >
            <X className="size-3.5" strokeWidth={2} aria-hidden />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    );
  });
}
