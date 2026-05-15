import "./EmptyState.css";

/** Shared empty catalogue / table zero-state — no behavior change beyond presentation. */

export function EmptyState({ icon: Icon, title, description }) {
  return (
    <div className="alloc8-empty-state" role="status">
      {Icon ? (
        <span className="alloc8-empty-state__icon-wrap" aria-hidden>
          <Icon size={36} strokeWidth={1.75} />
        </span>
      ) : null}
      <div className="alloc8-empty-state__title">{title}</div>
      {description ? <p className="alloc8-empty-state__desc">{description}</p> : null}
    </div>
  );
}
