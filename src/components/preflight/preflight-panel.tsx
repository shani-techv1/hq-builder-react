"use client";

import * as React from "react";
import { Layers, ShieldCheck } from "lucide-react";

import { EmptyState } from "@/components/common/empty-state";
import { SectionTitle } from "@/components/common/section-title";
import { useEditorState } from "@/components/editor/editor-state";
import { ValidationBadge } from "@/components/inspector/validation-badge";
import { PanelBody } from "@/components/panels/panel-body";
import { PreflightIssueRow } from "@/components/preflight/preflight-issue-row";
import type { CanvasObject } from "@/lib/canvas-objects";
import type { PreflightIssue, PreflightIssueKind } from "@/lib/preflight";
import { PRINT_READY_DPI } from "@/lib/workspace";

/**
 * Checks — everything about this sheet that is worth a second look before it
 * is printed.
 *
 * Nothing here blocks anything. Both checks have honest false positives: an
 * overlap can be the design, and artwork under 300 DPI can still be fine for a
 * job, so the panel's whole job is to put the decision in front of the person
 * making it rather than to make it for them.
 */
export function PreflightPanel() {
  const { canvas, preflight } = useEditorState();
  const { objects, selectedIds } = canvas;

  const byId = React.useMemo(
    () => new Map(objects.map((object) => [object.id, object])),
    [objects],
  );

  /**
   * Selecting an issue selects everything it names, so an overlap arrives as
   * both pieces — which is the only way to see the two relative to each other.
   */
  const selectIssue = (issue: PreflightIssue) =>
    canvas.setSelection(issue.objectIds);

  const isIssueSelected = (issue: PreflightIssue) =>
    issue.objectIds.length === selectedIds.length &&
    issue.objectIds.every((id) => selectedIds.includes(id));

  const issueObjects = (issue: PreflightIssue): CanvasObject[] =>
    issue.objectIds
      .map((id) => byId.get(id))
      .filter((object): object is CanvasObject => Boolean(object));

  if (objects.length === 0) {
    return (
      <PanelBody>
        <EmptyState
          icon={Layers}
          title="Nothing to check"
          description="Upload artwork to begin."
        />
      </PanelBody>
    );
  }

  if (preflight.total === 0) {
    return (
      <PanelBody>
        <EmptyState
          icon={ShieldCheck}
          title="Ready to print"
          description={`Nothing overlaps, and every layer holds ${PRINT_READY_DPI} DPI at the size it is placed.`}
        />
      </PanelBody>
    );
  }

  /**
   * One group. `count` is everything found of that kind, which is not always
   * everything listed — a sheet of stacked duplicates can hold hundreds of
   * overlaps, and the rest are counted rather than written out.
   */
  const renderSection = (title: string, kind: PreflightIssueKind) => {
    const found = preflight.counts[kind];
    if (found === 0) return null;

    const listed = preflight.issues.filter((issue) => issue.kind === kind);
    const omitted = found - listed.length;

    return (
      <section>
        <SectionTitle title={title} count={found} />
        <div className="mt-2 space-y-0.5">
          {listed.map((issue) => (
            <PreflightIssueRow
              key={issue.id}
              issue={issue}
              objects={issueObjects(issue)}
              isSelected={isIssueSelected(issue)}
              onSelect={() => selectIssue(issue)}
            />
          ))}
        </div>

        {omitted > 0 ? (
          <p className="mt-2 px-2 text-[10.5px] leading-relaxed text-muted-foreground">
            And {omitted} more, not listed here. Every layer involved is marked
            in Layers.
          </p>
        ) : null}
      </section>
    );
  };

  return (
    <PanelBody className="space-y-4">
      <ValidationBadge
        tone="warning"
        label={`${preflight.total} to review`}
        detail="None of this stops a sheet being printed. Select a warning to see the artwork it is about."
      />

      {/* Overlaps first: they are the ones that ruin a whole sheet rather than
          one piece on it. */}
      {renderSection("Overlapping artwork", "overlap")}
      {renderSection(`Below ${PRINT_READY_DPI} DPI`, "resolution")}
    </PanelBody>
  );
}
