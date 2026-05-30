import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useWorkspacePresence } from "../../context/WorkspacePresenceContext.jsx";
import { initialsFromDisplayName } from "../../context/AuthContext.jsx";
import { avatarGradientFromName } from "../../utils/projectColors.js";
import "./WorkspacePresenceAvatars.css";

const MAX_VISIBLE = 4;

function PresenceAvatar({ user, pageLabel, zIndex, style }) {
  const initials = initialsFromDisplayName(user.avatarName || user.displayName) || "?";
  const page = pageLabel(user.page);
  const title = `${user.displayName} · ${page}`;

  return (
    <span
      className="ws-presence-avatar"
      style={{ ...style, zIndex }}
      title={title}
      aria-label={title}
    >
      <span
        className="ws-presence-avatar__chip"
        style={{ background: avatarGradientFromName(user.avatarName || user.displayName) }}
      >
        {initials}
      </span>
    </span>
  );
}

function WorkspacePresenceAvatars({ className = "" }) {
  const { onlineUsers, visible, count, pageLabel } = useWorkspacePresence();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const visibleUsers = onlineUsers.slice(0, MAX_VISIBLE);
  const overflow = Math.max(0, onlineUsers.length - MAX_VISIBLE);

  const closePopover = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) closePopover();
    };
    const onKey = (e) => {
      if (e.key === "Escape") closePopover();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, closePopover]);

  if (!visible || count === 0) return null;

  const groupLabel =
    count === 1 ? "1 teammate active" : `${count} teammates active`;

  return (
    <div
      className={`ws-presence-root${className ? ` ${className}` : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="ws-presence-trigger"
        aria-label={groupLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ws-presence-stack" aria-hidden>
          {visibleUsers.map((user, i) => (
            <PresenceAvatar
              key={user.key}
              user={user}
              pageLabel={pageLabel}
              zIndex={MAX_VISIBLE - i}
              style={{ marginLeft: i === 0 ? 0 : -10 }}
            />
          ))}
          {overflow > 0 ? (
            <span className="ws-presence-overflow" style={{ zIndex: 0, marginLeft: -8 }}>
              +{overflow}
            </span>
          ) : null}
        </span>
        <span className="ws-presence-live" aria-hidden />
      </button>

      {open ? (
        <div className="ws-presence-popover" role="dialog" aria-label="Active teammates">
          <div className="ws-presence-popover-head">
            <span className="ws-presence-popover-title">Active now</span>
            <span className="ws-presence-popover-count">{count}</span>
          </div>
          <ul className="ws-presence-popover-list">
            {onlineUsers.map((user) => (
              <li key={user.key} className="ws-presence-popover-row">
                <span
                  className="ws-presence-popover-avatar"
                  style={{ background: avatarGradientFromName(user.avatarName || user.displayName) }}
                >
                  {initialsFromDisplayName(user.avatarName || user.displayName) || "?"}
                </span>
                <span className="ws-presence-popover-meta">
                  <span className="ws-presence-popover-name">{user.displayName}</span>
                  <span className="ws-presence-popover-page">{pageLabel(user.page)}</span>
                </span>
                <span className="ws-presence-popover-live" aria-hidden />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export default memo(WorkspacePresenceAvatars);
