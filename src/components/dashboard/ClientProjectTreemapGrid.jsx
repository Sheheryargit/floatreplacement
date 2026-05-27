import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Building2, FolderOpen } from "lucide-react";
import "./ClientProjectTreemapGrid.css";

function fmtHours(n) {
  const x = Number(n) || 0;
  return `${x.toLocaleString("en-AU", { maximumFractionDigits: 1, minimumFractionDigits: 0 })}h`;
}

function topN(list, n) {
  return (list || []).slice(0, Math.max(0, n));
}

export function ClientProjectTreemapGrid({
  byClient,
  byProject,
  selectedClient,
  onSelectClient,
  onSelectProject,
}) {
  const [projectsExpanded, setProjectsExpanded] = useState(false);

  const topClients = useMemo(() => topN(byClient, 10), [byClient]);
  const topProjects = useMemo(
    () => topN(byProject, projectsExpanded ? 48 : 12),
    [byProject, projectsExpanded],
  );

  return (
    <div className="dd-treemap">
      <div className="dd-treemap-col">
        <div className="dd-treemap-head">
          <Building2 size={16} strokeWidth={2.1} aria-hidden />
          Clients
        </div>
        <div className="dd-treemap-grid" role="list">
          {topClients.map((row, idx) => {
            const active = selectedClient && row.key === selectedClient;
            return (
              <motion.button
                key={row.key}
                type="button"
                className={"dd-tile" + (active ? " is-active" : "")}
                onClick={() => onSelectClient?.(active ? null : row.key)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: idx * 0.02 }}
              >
                <span className="dd-tile-name">{row.key}</span>
                <span className="dd-tile-meta">{fmtHours(row.hours)}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className={"dd-treemap-col dd-treemap-col--projects" + (projectsExpanded ? " is-expanded" : "")}>
        <div className="dd-treemap-head dd-treemap-head--projects">
          <div className="dd-treemap-head-left">
            <FolderOpen size={16} strokeWidth={2.1} aria-hidden />
            Projects
            <span className="dd-treemap-count" aria-label={`${(byProject || []).length} projects`}>
              {(byProject || []).length}
            </span>
          </div>
          <button
            type="button"
            className="dd-treemap-more"
            onClick={() => setProjectsExpanded((v) => !v)}
            aria-expanded={projectsExpanded}
          >
            {projectsExpanded ? "Show less" : "Show more"}
          </button>
        </div>
        <div className="dd-treemap-grid dd-treemap-grid--projects" role="list">
          {topProjects.map((row, idx) => (
            <motion.button
              key={row.key}
              type="button"
              className="dd-tile dd-tile--proj"
              onClick={() => onSelectProject?.(row.key)}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: idx * 0.015 }}
            >
              <span className="dd-tile-name">{row.key}</span>
              <span className="dd-tile-meta">{fmtHours(row.hours)}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}

