import clsx from "clsx";
import "./Skeleton.css";

export function Skeleton({ className, style, ...props }) {
  return <div className={clsx("alloc8-skeleton", className)} style={style} {...props} />;
}
