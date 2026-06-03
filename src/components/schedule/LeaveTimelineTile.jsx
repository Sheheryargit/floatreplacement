import {
  formatLeaveNotesFull,
  leaveNotesBodyPreview,
  leaveTileShowsNotesOnTile,
} from "../../utils/leaveTimelineDisplay.js";
import { leavePanelStyleVars, normalizeLeaveTypeId } from "../../utils/leaveVisuals.js";
import { LeaveTimelineGlyph } from "./LeaveTimelineGlyph.jsx";
import "./LeaveTimelineTile.css";

/**
 * Leave cell body: type chip, icon, optional notes / hours by tier.
 */
export function LeaveTimelineTile({
  leaveTypeId,
  typeLabel,
  notes = "",
  colSpan = 1,
  tier = "compact",
  isPartial = false,
  hoursLabel = "",
}) {
  const typeId = normalizeLeaveTypeId(leaveTypeId);
  const trimmedNotes = (notes || "").trim();
  const showNotes = leaveTileShowsNotesOnTile(tier) && trimmedNotes.length > 0;
  const notesBody = showNotes
    ? leaveNotesBodyPreview(trimmedNotes, tier === "rich" ? 36 : 28)
    : "";

  const spanTier =
    colSpan >= 4 ? "lp-leave-tile--span-xl" : colSpan >= 2 ? "lp-leave-tile--span-wide" : "";

  return (
    <span
      className={`lp-leave-tile lp-leave-tile--${tier} ${spanTier}`.trim()}
      style={leavePanelStyleVars(typeId)}
      data-leave-type={typeId}
      data-col-span={colSpan}
      aria-hidden
    >
      <span className="lp-leave-cluster">
        <span className="lp-leave-type-chip">{typeLabel}</span>
        <LeaveTimelineGlyph leaveTypeId={leaveTypeId} />
        {showNotes && notesBody ? (
          <span className="lp-leave-notes">
            <span className="lp-leave-notes__label">Notes:</span>
            <span className="lp-leave-notes__text">{notesBody}</span>
          </span>
        ) : null}
        {isPartial && hoursLabel ? (
          <span className="lp-leave-hours-badge">{hoursLabel}</span>
        ) : null}
      </span>
      {trimmedNotes ? (
        <span className="lp-leave-tile__hover-detail">{formatLeaveNotesFull(trimmedNotes)}</span>
      ) : null}
    </span>
  );
}
