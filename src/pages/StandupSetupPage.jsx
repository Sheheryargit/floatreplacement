import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  ListOrdered,
  Play,
  Plus,
  Save,
  Sparkles,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import AppSideNav from "../components/navigation/AppSideNav.jsx";
import { Button } from "../components/ui/Button.jsx";
import { useAppTheme } from "../context/ThemeContext.jsx";
import { useAppData } from "../context/AppDataContext.jsx";
import { isSupabaseConfigured } from "../lib/supabase.js";
import { upsertStandupDepartmentOrder } from "../lib/api/workspaceSettings.js";
import { useStandupWalkthroughOptional } from "../context/StandupWalkthroughContext.jsx";
import {
  buildStandupDeptCatalog,
  departmentDisplayLabel,
  sanitizeStandupOrder,
} from "../utils/standupSession.js";
import "./StandupSetupPage.css";

export default function StandupSetupPage() {
  const navigate = useNavigate();
  const { theme } = useAppTheme();
  const { depts, people, standupDepartmentOrder, setStandupDepartmentOrder } = useAppData();

  const standupWalkthrough = useStandupWalkthroughOptional();

  const catalog = useMemo(() => buildStandupDeptCatalog(depts, people), [depts, people]);

  const sanitizedSaved = useMemo(
    () => sanitizeStandupOrder(standupDepartmentOrder, catalog),
    [standupDepartmentOrder, catalog]
  );

  const [draftOrder, setDraftOrder] = useState(sanitizedSaved);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    setDraftOrder(sanitizedSaved);
  }, [sanitizedSaved]);

  const available = useMemo(
    () => catalog.filter((d) => !draftOrder.includes(d)),
    [catalog, draftOrder]
  );

  const removedCount = standupDepartmentOrder.length - sanitizedSaved.length;

  const move = useCallback((index, direction) => {
    setDraftOrder((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const addDept = useCallback((dept) => {
    setDraftOrder((prev) => [...prev, dept]);
  }, []);

  const removeDept = useCallback((dept) => {
    setDraftOrder((prev) => prev.filter((d) => d !== dept));
  }, []);

  const dirty =
    draftOrder.length !== sanitizedSaved.length ||
    draftOrder.some((d, i) => d !== sanitizedSaved[i]);

  const persistOrder = useCallback(async () => {
    const result = await upsertStandupDepartmentOrder(draftOrder);
    setStandupDepartmentOrder(draftOrder);
    return result;
  }, [draftOrder, setStandupDepartmentOrder]);

  const onSave = useCallback(async () => {
    setSaving(true);
    try {
      const result = await persistOrder();
      if (result.remote) {
        toast.success("Standup order saved", {
          description: "Shared with everyone in this workspace.",
          className: "alloc8-toast",
        });
      } else {
        toast.success("Standup order saved on this device", {
          description:
            "Workspace DB migration pending — order works locally until an admin runs migration 033 in Supabase.",
          className: "alloc8-toast",
          duration: 9000,
        });
      }
    } catch (e) {
      toast.error("Could not save standup order", {
        description: e?.message || String(e),
        className: "alloc8-toast",
      });
    } finally {
      setSaving(false);
    }
  }, [persistOrder]);

  const onStartStandup = useCallback(async () => {
    if (draftOrder.length === 0) {
      toast.error("Add at least one department", {
        description: "Pick departments for the standup rotation before starting.",
        className: "alloc8-toast",
      });
      return;
    }
    setStarting(true);
    try {
      if (dirty) {
        await persistOrder();
      }
      standupWalkthrough?.notifyStandupStarted();
      navigate("/", { state: { startStandup: true } });
    } catch (e) {
      toast.error("Could not start standup", {
        description: e?.message || String(e),
        className: "alloc8-toast",
      });
    } finally {
      setStarting(false);
    }
  }, [dirty, draftOrder.length, navigate, persistOrder, standupWalkthrough]);

  return (
    <div className="standup-setup-root" data-theme={theme === "light" ? "light" : "dark"}>
      <AppSideNav />

      <main id="main-content" className="standup-setup-main">
        <motion.header
          className="standup-setup-hero"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="standup-setup-badge">
            <Sparkles size={14} aria-hidden />
            Standup
          </div>
          <h1 className="standup-setup-title">Department order</h1>
          <p className="standup-setup-lede">
            Define the order for daily standup on the schedule. Each step filters to one department
            so no team gets missed.
          </p>
          {!isSupabaseConfigured ? (
            <p className="standup-setup-note" role="note">
              Connect Supabase to share this order with your workspace. Changes are local only in
              demo mode.
            </p>
          ) : null}
          {removedCount > 0 ? (
            <p className="standup-setup-note standup-setup-note--warn" role="status">
              {removedCount} department{removedCount === 1 ? "" : "s"} in the saved order no longer
              exist and {removedCount === 1 ? "was" : "were"} removed.
            </p>
          ) : null}
        </motion.header>

        <div className="standup-setup-grid">
          <section
            className="standup-setup-panel"
            aria-labelledby="standup-order-heading"
            data-alloc8-guide="standup-order-panel"
          >
            <div className="standup-setup-panel-head">
              <ListOrdered size={18} aria-hidden />
              <h2 id="standup-order-heading">Rotation order</h2>
              <span className="standup-setup-count">{draftOrder.length}</span>
            </div>
            {draftOrder.length === 0 ? (
              <p className="standup-setup-empty">Add departments from the list on the right.</p>
            ) : (
              <ul className="standup-setup-list">
                {draftOrder.map((dept, i) => (
                  <li key={dept} className="standup-setup-row">
                    <span className="standup-setup-row-index">{i + 1}</span>
                    <span className="standup-setup-row-label">{departmentDisplayLabel(dept)}</span>
                    <div className="standup-setup-row-actions">
                      <button
                        type="button"
                        className="standup-setup-icon-btn"
                        aria-label={`Move ${departmentDisplayLabel(dept)} up`}
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className="standup-setup-icon-btn"
                        aria-label={`Move ${departmentDisplayLabel(dept)} down`}
                        disabled={i === draftOrder.length - 1}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className="standup-setup-icon-btn standup-setup-icon-btn--remove"
                        aria-label={`Remove ${departmentDisplayLabel(dept)}`}
                        onClick={() => removeDept(dept)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            className="standup-setup-panel"
            aria-labelledby="standup-available-heading"
            data-alloc8-guide="standup-available-panel"
          >
            <div className="standup-setup-panel-head">
              <Building2 size={18} aria-hidden />
              <h2 id="standup-available-heading">Available</h2>
            </div>
            {catalog.length === 0 ? (
              <p className="standup-setup-empty">
                No departments yet.{" "}
                <Link to="/departments" className="standup-setup-link">
                  Manage departments
                </Link>
              </p>
            ) : available.length === 0 ? (
              <p className="standup-setup-empty">All departments are in the rotation.</p>
            ) : (
              <ul className="standup-setup-list standup-setup-list--available">
                {available.map((dept) => (
                  <li key={dept} className="standup-setup-row standup-setup-row--available">
                    <span className="standup-setup-row-label">{departmentDisplayLabel(dept)}</span>
                    <button
                      type="button"
                      className="standup-setup-add-btn"
                      onClick={() => addDept(dept)}
                    >
                      <Plus size={14} />
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="standup-setup-footer" data-alloc8-guide="standup-start-btn">
          <Button
            type="button"
            variant="primary"
            disabled={draftOrder.length === 0 || starting}
            onClick={onStartStandup}
          >
            <Play size={16} />
            {starting ? "Starting…" : "Start standup"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!dirty || saving || starting}
            onClick={onSave}
          >
            <Save size={16} />
            {saving ? "Saving…" : "Save order"}
          </Button>
        </div>
      </main>
    </div>
  );
}
