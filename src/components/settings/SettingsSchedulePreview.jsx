import { useMemo } from "react";
import { Repeat2, StickyNote } from "lucide-react";
import { useAppTheme } from "../../context/ThemeContext.jsx";
import {
  allocationBarBorderRadiusPx,
  allocationBarChromeStyles,
  allocationBarInnerWash,
  allocationCenterHoursHeroPx,
  allocationLoadFillTopAlpha,
  hexToRgba,
} from "../../schedule/allocationBarVisuals.js";
import { BAR_H_NORM, allocationBarHeightPx } from "../../schedule/renderModel/index.js";
import {
  avatarGradientFromName,
  colorForAllocationBar,
  contrastingTextColor,
  projectCodeChipStyles,
} from "../../utils/projectColors.js";
import {
  ALLOCATION_BOX_STYLE_IDS,
  ALLOCATION_BOX_STYLE_LABELS,
} from "../../config/scheduleUiPrefs.js";
import "../../pages/LandingPage.css";
import "./SettingsSchedulePreview.css";

const PREVIEW_NAME = "Alex Rivera";

const PREVIEW_PROJECTS = [
  { id: "pv1", name: "Platform API", code: "PLAT", color: "#6366f1", archived: false },
  { id: "pv2", name: "Design sprint", code: "DSGN", color: "#14b8a6", archived: false },
  { id: "pv3", name: "Client rollout", code: "ROLL", color: "#f97316", archived: false },
];

function previewAllocationDisplay(alloc) {
  const raw = (alloc.project || "").trim();
  if (!raw) {
    return { projectName: "", projectCode: "", hoursLabel: `${Number(alloc.hoursPerDay) || 0}h` };
  }
  const parts = raw.split("/").map((x) => x.trim()).filter(Boolean);
  const name = parts.length > 1 ? parts.slice(1).join(" / ") : parts[0] || raw;
  const code = parts.length > 1 ? parts[0] : "";
  const h = alloc.hoursPerDay;
  const hStr = Number.isInteger(h) ? String(h) : String(h);
  return { projectName: name, projectCode: code, hoursLabel: `${hStr}h` };
}

function ini(name) {
  const t = (name || "").trim();
  if (!t) return "?";
  return t.slice(0, 1).toUpperCase();
}

function PreviewWorkTile({ alloc, projects, theme, allocationBoxStyle, widthPct, leftPct }) {
  const h = Math.max(0, parseFloat(alloc.hoursPerDay) || 0);
  const hnorm = Math.min(1, Math.max(0, h) / BAR_H_NORM);
  const calculatedHeight = allocationBarHeightPx(alloc);
  const { projectName, projectCode, hoursLabel } = previewAllocationDisplay(alloc);
  const barColor = colorForAllocationBar(alloc, projects);
  const fg = contrastingTextColor(barColor);
  const innerWash = allocationBarInnerWash(barColor, theme, allocationBoxStyle);
  const brPx = allocationBarBorderRadiusPx(widthPct, allocationBoxStyle);
  const compactBorder = calculatedHeight < 40;
  const chrome = allocationBarChromeStyles(barColor, h, theme, {
    thin: compactBorder,
    boxStyle: allocationBoxStyle,
  });
  const repeatOn = (alloc.repeatId ?? "none") !== "none";
  const hasNotes = Boolean((alloc.notes || "").trim());

  const baseStyle = {
    position: "absolute",
    left: `${leftPct}%`,
    width: `${widthPct}%`,
    top: 0,
    minWidth: 0,
    boxSizing: "border-box",
    "--alloc-bar-h": `${calculatedHeight}px`,
    height: `${calculatedHeight}px`,
    minHeight: `${calculatedHeight}px`,
    maxHeight: `${calculatedHeight}px`,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "transparent",
    borderRadius: `${brPx}px`,
    ...chrome,
    color: fg,
  };

  return (
    <button
      type="button"
      tabIndex={-1}
      disabled
      className={
        "lp-block lp-block-alloc lp-block-alloc-project lp-alloc-bar settings-preview-tile" +
        (compactBorder ? " lp-alloc-bar--compact" : "") +
        (allocationBoxStyle === "center" ? " lp-alloc-bar--layout-center" : "")
      }
      data-hours={h}
      data-bar-h={calculatedHeight}
      style={baseStyle}
    >
      <span className="lp-alloc-bar__underlay" style={{ background: innerWash }} aria-hidden />
      <span
        className="lp-alloc-bar__load"
        style={{
          background: `linear-gradient(to top, ${hexToRgba(barColor, allocationLoadFillTopAlpha(theme, allocationBoxStyle))}, ${hexToRgba(barColor, 0)})`,
          height: `${hnorm * 100}%`,
        }}
        aria-hidden
      />
      {allocationBoxStyle === "center" ? (
        <span className="lp-alloc-bar__body lp-alloc-bar__body--center-hours">
          {projectName || projectCode ? (
            <span className="lp-alloc-bar__line lp-alloc-bar__line--name lp-alloc-bar__line--center-subtitle">
              {projectName || projectCode}
            </span>
          ) : null}
          <span
            className="lp-alloc-bar__hours-hero"
            style={{ fontSize: `${allocationCenterHoursHeroPx(calculatedHeight)}px` }}
          >
            {hoursLabel}
          </span>
          <span className="lp-alloc-bar__line lp-alloc-bar__line--meta lp-alloc-bar__line--center-meta">
            {projectName && projectCode ? (
              <span className="lp-alloc-code-chip" style={projectCodeChipStyles(barColor, theme)}>
                {projectCode}
              </span>
            ) : null}
            {repeatOn || hasNotes ? (
              <span className="lp-alloc-bar__icons">
                {repeatOn ? (
                  <Repeat2 size={10} strokeWidth={2.25} className="lp-alloc-bar__ic" aria-hidden />
                ) : null}
                {hasNotes ? (
                  <StickyNote size={10} strokeWidth={2.25} className="lp-alloc-bar__ic" aria-hidden />
                ) : null}
              </span>
            ) : null}
          </span>
        </span>
      ) : (
        <span className="lp-alloc-bar__body">
          <span className="lp-alloc-bar__line lp-alloc-bar__line--name">{projectName || hoursLabel}</span>
          <span className="lp-alloc-bar__line lp-alloc-bar__line--meta">
            {projectCode ? (
              <span className="lp-alloc-code-chip" style={projectCodeChipStyles(barColor, theme)}>
                {projectCode}
              </span>
            ) : null}
            <span className="lp-alloc-hours">{hoursLabel}</span>
            {repeatOn || hasNotes ? (
              <span className="lp-alloc-bar__icons">
                {repeatOn ? (
                  <Repeat2 size={10} strokeWidth={2.25} className="lp-alloc-bar__ic" aria-hidden />
                ) : null}
                {hasNotes ? (
                  <StickyNote size={10} strokeWidth={2.25} className="lp-alloc-bar__ic" aria-hidden />
                ) : null}
              </span>
            ) : null}
          </span>
        </span>
      )}
    </button>
  );
}

/**
 * Live-ish schedule strip: allocation tile chrome + peak load chips track Settings + theme.
 */
export function SettingsSchedulePreview({ allocationBoxStyle, peakLoadLabels, onAllocationBoxStyleChange }) {
  const { theme, canvasTintHex } = useAppTheme();
  const themeAttr = theme === "light" ? "light" : "dark";

  const samples = useMemo(
    () => [
      {
        alloc: {
          projectId: "pv1",
          project: "PLAT / Platform API",
          hoursPerDay: 4,
          repeatId: "preview-repeat",
          notes: "Preview",
        },
        leftPct: 2,
        widthPct: 30,
      },
      {
        alloc: {
          projectId: "pv2",
          project: "DSGN / Design sprint",
          hoursPerDay: 2.5,
          repeatId: "none",
          notes: "",
        },
        leftPct: 35,
        widthPct: 28,
      },
      {
        alloc: {
          projectId: "pv3",
          project: "ROLL / Client rollout",
          hoursPerDay: 6,
          repeatId: "none",
          notes: "",
        },
        leftPct: 66,
        widthPct: 32,
      },
    ],
    []
  );

  const laneMinHeightPx =
    16 + Math.max(...samples.map((s) => allocationBarHeightPx(s.alloc))) + 12;

  const gridBase = theme === "light" ? "#f4f6fa" : "#0f1117";
  const tint = (canvasTintHex || "").trim();
  const timelineBg =
    tint && /^#([0-9A-Fa-f]{6})$/i.test(tint)
      ? `color-mix(in srgb, ${tint} 16%, ${gridBase})`
      : undefined;

  return (
    <div className="settings-sched-preview">
      <div className="settings-sched-preview__header">
        <h2 className="settings-sched-preview__title">Schedule preview</h2>
        <p className="settings-sched-preview__lede">
          Tiles use the same markup and styles as the schedule (including your allocation-block preset). Peak chips
          mirror the row when labels are on.
        </p>
      </div>

      <div className="settings-sched-preview__center">
      <div className="settings-sched-preview__frame">
      <div
        className="lp-root settings-sched-preview__scope"
        data-theme={themeAttr}
        data-alloc-box-style={allocationBoxStyle}
        data-density="comfortable"
      >
        <div
          className="settings-preview-faux-row lp-sched-row"
          style={{ ["--animation-order"]: 0 }}
        >
          <div className="lp-sched-person">
            <div className="lp-person-row-shell">
              <div className="lp-person-row-cluster">
                <div className="lp-person-row lp-person-row-main">
                  <div className="lp-person-main-col">
                    <button type="button" className="lp-person-identity-hit" disabled tabIndex={-1}>
                      <span className="lp-person-identity-hit-inner">
                        <span className="lp-person-identity-top">
                          <span className="lp-avatar" style={{ background: avatarGradientFromName(PREVIEW_NAME) }}>
                            {ini(PREVIEW_NAME)}
                          </span>
                          <span className="lp-person-meta">
                            <span className="lp-person-identity-stack">
                              <span className="lp-person-name-line">
                                <span className="lp-person-name">{PREVIEW_NAME}</span>
                                {peakLoadLabels ? (
                                  <span className="lp-person-load-wrap" aria-hidden>
                                    <span
                                      className="lp-person-load-pip lp-person-load-pip--onTarget"
                                      aria-hidden
                                    />
                                  </span>
                                ) : null}
                              </span>
                              <span className="lp-person-sub">Product · Preview row</span>
                            </span>
                          </span>
                        </span>
                        {peakLoadLabels ? (
                          <span className="lp-person-load-status-row">
                            <span
                              className="lp-person-load-pop lp-person-load-pop--onTarget"
                              role="status"
                            >
                              On target
                            </span>
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            className="lp-sched-timeline settings-preview-timeline"
            style={timelineBg ? { background: timelineBg } : undefined}
          >
            <div className="settings-preview-grid-veil" aria-hidden />
            <div className="settings-preview-week-strip" aria-hidden>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="settings-preview-lane">
              <div
                className="lp-alloc-lane settings-preview-alloc-lane"
                style={{ minHeight: `${laneMinHeightPx}px` }}
              >
                {samples.map(({ alloc, widthPct, leftPct }, idx) => (
                  <PreviewWorkTile
                    key={idx}
                    alloc={alloc}
                    projects={PREVIEW_PROJECTS}
                    theme={theme}
                    allocationBoxStyle={allocationBoxStyle}
                    widthPct={widthPct}
                    leftPct={leftPct}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {typeof onAllocationBoxStyleChange === "function" ? (
        <div className="settings-sched-preview__alloc-picker">
          <p className="settings-sched-preview__alloc-label">Allocation blocks</p>
          <p className="settings-sched-preview__alloc-hint">Same setting as Schedule — pick a style to compare on the row above.</p>
          <div
            className="settings-alloc-box-toggle settings-alloc-box-toggle--preview"
            role="radiogroup"
            aria-label="Allocation block style"
          >
            {ALLOCATION_BOX_STYLE_IDS.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={allocationBoxStyle === id}
                className={
                  "settings-alloc-box-btn settings-alloc-box-btn--preview" +
                  (allocationBoxStyle === id ? " settings-alloc-box-btn--active" : "")
                }
                onClick={() => onAllocationBoxStyleChange(id)}
              >
                {ALLOCATION_BOX_STYLE_LABELS[id] ?? id}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {peakLoadLabels ? (
        <div className="settings-sched-preview__peak settings-preview-peak-foot">
          <p className="settings-preview-peak-foot__label">Peak load label styles</p>
          <div className="settings-preview-peak-strip" role="group" aria-label="Peak load label examples">
            <span className="lp-person-load-pop lp-person-load-pop--under">Underallocated</span>
            <span className="lp-person-load-pop lp-person-load-pop--onTarget">On target</span>
            <span className="lp-person-load-pop lp-person-load-pop--over">Overallocated</span>
          </div>
        </div>
      ) : (
        <p className="settings-sched-preview__peak settings-preview-peak-off">
          Peak load labels are off (matches a schedule row with labels hidden).
        </p>
      )}
      </div>
    </div>
  );
}
