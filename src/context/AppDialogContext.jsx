import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
} from "react";
import { AnimatePresence } from "framer-motion";
import { Modal } from "../components/ui/Modal.jsx";

const AppDialogContext = createContext(null);

export function AppDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const openDialog = useCallback((opts) => {
    setDialog({
      title: opts.title ?? "",
      message: opts.message ?? "",
    });
  }, []);

  const closeDialog = useCallback(() => setDialog(null), []);

  const value = useMemo(
    () => ({ openDialog, closeDialog }),
    [openDialog, closeDialog]
  );

  return (
    <AppDialogContext.Provider value={value}>
      {children}
      <AnimatePresence>
        {dialog ? (
          <Modal
            key="app-dialog"
            title={dialog.title}
            message={dialog.message}
            onClose={closeDialog}
          />
        ) : null}
      </AnimatePresence>
    </AppDialogContext.Provider>
  );
}

export function useAppDialog() {
  const ctx = useContext(AppDialogContext);
  if (!ctx) {
    throw new Error("useAppDialog must be used within AppDialogProvider");
  }
  return ctx;
}
