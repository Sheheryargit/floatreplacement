import "./RouteSkeleton.css";

export default function RouteSkeleton() {
  return (
    <div className="route-skeleton" aria-busy="true" aria-label="Loading">
      <aside className="route-skeleton-nav">
        <div className="route-skeleton-pulse route-skeleton-logo" />
        <div className="route-skeleton-nav-items">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="route-skeleton-pulse route-skeleton-nav-dot" />
          ))}
        </div>
      </aside>
      <div className="route-skeleton-main">
        <div className="route-skeleton-pulse route-skeleton-title" />
        <div className="route-skeleton-pulse route-skeleton-bar" />
        <div className="route-skeleton-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="route-skeleton-pulse route-skeleton-row" />
          ))}
        </div>
      </div>
    </div>
  );
}
