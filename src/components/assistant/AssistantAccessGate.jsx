import { useEffect } from "react";
import { toast } from "sonner";
import { useAuth } from "../../context/AuthContext.jsx";
import { ALLOC8_OPEN_ASSISTANT_EVENT } from "../../config/appKeyboardEvents.js";
import {
  ASSISTANT_ADMIN_ONLY_MESSAGE,
  ASSISTANT_ADMIN_ONLY_TITLE,
} from "../../lib/assistant/assistantAccess.js";

export function notifyAssistantAdminOnly() {
  toast.info(ASSISTANT_ADMIN_ONLY_TITLE, {
    description: ASSISTANT_ADMIN_ONLY_MESSAGE,
    className: "alloc8-toast",
  });
}

/** Blocks assistant UI for members; shows a toast if they try ⌘⇧K or the open event. */
export default function AssistantAccessGate() {
  const { isWorkspaceAdmin } = useAuth();

  useEffect(() => {
    if (isWorkspaceAdmin) return undefined;

    const onDenied = () => notifyAssistantAdminOnly();

    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        onDenied();
      }
    };

    window.addEventListener(ALLOC8_OPEN_ASSISTANT_EVENT, onDenied);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(ALLOC8_OPEN_ASSISTANT_EVENT, onDenied);
      window.removeEventListener("keydown", onKey);
    };
  }, [isWorkspaceAdmin]);

  return null;
}
