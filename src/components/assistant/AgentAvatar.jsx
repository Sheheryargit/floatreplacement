import { Bot } from "lucide-react";
import "./AgentAvatar.css";

const ICON_SIZE = { sm: 13, md: 18, lg: 24, xl: 30 };

/** Compact agent mark — bot icon on brand surface. */
export default function AgentAvatar({
  size = "md",
  pulse = false,
  active = false,
  blink = false,
  className = "",
}) {
  const iconSize = ICON_SIZE[size] ?? ICON_SIZE.md;

  return (
    <span
      className={[
        "a8a-agent",
        `a8a-agent--${size}`,
        pulse ? "a8a-agent--pulse" : "",
        active ? "a8a-agent--active" : "",
        blink ? "a8a-agent--blink" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden
    >
      <span className="a8a-agent-ring" />
      <span className="a8a-agent-face">
        <Bot size={iconSize} strokeWidth={2.25} />
      </span>
    </span>
  );
}

export function AgentBetaBadge({ className = "" }) {
  return (
    <span className={["a8a-beta", className].filter(Boolean).join(" ")} title="Early preview">
      Beta
    </span>
  );
}
