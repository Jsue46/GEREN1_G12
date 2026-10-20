import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";
import { useEffect } from "react";
import { useStore } from "../store/useStore";

export function Notification() {
  const notice = useStore((state) => state.notice);
  const clearNotice = useStore((state) => state.clearNotice);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(clearNotice, 3800);
    return () => window.clearTimeout(timer);
  }, [notice, clearNotice]);
  if (!notice) return null;
  return <div className={`notification ${notice.tone}`} role="status">{notice.tone === "success" ? <CheckCircle size={20} /> : <WarningCircle size={20} />}<span>{notice.message}</span><button onClick={clearNotice} aria-label="Cerrar mensaje"><X size={16} /></button></div>;
}
