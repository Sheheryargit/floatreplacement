import {
  Baby,
  CalendarOff,
  Flower2,
  HeartPulse,
  Landmark,
  Palmtree,
  Umbrella,
  User,
  Wallet,
} from "lucide-react";
import { leaveTimelineIconKey } from "../../utils/leaveVisuals.js";

const LEAVE_LUCIDE = {
  palmtree: Palmtree,
  heartpulse: HeartPulse,
  user: User,
  baby: Baby,
  flower2: Flower2,
  wallet: Wallet,
  landmark: Landmark,
  umbrella: Umbrella,
  calendaroff: CalendarOff,
};

/**
 * Leave type icon inside the timeline icon pill.
 */
export function LeaveTimelineGlyph({ leaveTypeId, className = "lp-leave-block__icon", size = 14 }) {
  const key = leaveTimelineIconKey(leaveTypeId);
  const Ic = LEAVE_LUCIDE[key] || Palmtree;
  return (
    <span className="lp-leave-block__icon-pill lp-leave-tile-icon-pill" aria-hidden>
      <Ic className={className} size={size} strokeWidth={2.35} />
    </span>
  );
}
