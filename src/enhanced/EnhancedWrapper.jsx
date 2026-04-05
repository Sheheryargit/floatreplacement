import { useEnhancedMode } from "./useEnhancedMode.js";

/**
 * Optional layout wrapper: sets data attribute for scoped CSS when Enhanced Mode is on.
 * Children render unchanged when off.
 */
export function EnhancedWrapper({ children, className = "" }) {
  const on = useEnhancedMode();
  if (!on) return children;
  return (
    <div className={className} data-enhanced-wrapper="1">
      {children}
    </div>
  );
}
