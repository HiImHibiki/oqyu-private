"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ProctorLog } from "@/lib/types";

/* Proctoring berbasis browser (lockdown lunak).
 * Yang dideteksi:
 *  - keluar fullscreen
 *  - pindah tab / window kehilangan fokus
 *  - copy, paste, cut, klik kanan, print
 *  - shortcut terlarang (Cmd/Ctrl+C/V/P/T/N, F12, Cmd+Opt+I)
 *  - dugaan devtools (selisih outer/inner size mendadak)
 *  - koneksi terputus
 * Semua event dikirim ke server; skor integritas dihitung berbobot. */

const WEIGHTS: Record<string, number> = {
  fullscreen_exit: 12,
  blur: 8,
  copy: 6,
  cut: 6,
  paste: 10,
  contextmenu: 2,
  print: 15,
  devtools: 20,
  shortcut: 5,
  offline: 3,
};

export interface ProctorOptions {
  enabled: boolean;
  requireFullscreen?: boolean;
  onEvent?: (type: string, detail?: string) => void;
  /** dipanggil saat pelanggaran berat menembus ambang */
  onViolationLimit?: (log: ProctorLog) => void;
  limit?: number;
}

const emptyLog = (): ProctorLog => ({
  tabBlurCount: 0, fullscreenExitCount: 0, copyAttempts: 0, pasteAttempts: 0,
  rightClicks: 0, devtoolsSuspected: 0, events: [], integrityScore: 100,
});

export function useProctor({ enabled, requireFullscreen = true, onEvent, onViolationLimit, limit = 120 }: ProctorOptions) {
  const [log, setLog] = useState<ProctorLog>(emptyLog);
  const [needsFullscreen, setNeedsFullscreen] = useState(false);
  const penalty = useRef(0);
  const fired = useRef(false);

  const record = useCallback(
    (type: string, detail?: string) => {
      penalty.current += WEIGHTS[type] ?? 3;
      setLog((prev) => {
        const next: ProctorLog = {
          ...prev,
          tabBlurCount: prev.tabBlurCount + (type === "blur" ? 1 : 0),
          fullscreenExitCount: prev.fullscreenExitCount + (type === "fullscreen_exit" ? 1 : 0),
          copyAttempts: prev.copyAttempts + (type === "copy" || type === "cut" ? 1 : 0),
          pasteAttempts: prev.pasteAttempts + (type === "paste" ? 1 : 0),
          rightClicks: prev.rightClicks + (type === "contextmenu" ? 1 : 0),
          devtoolsSuspected: prev.devtoolsSuspected + (type === "devtools" ? 1 : 0),
          events: [...prev.events, { t: new Date().toISOString(), type, detail }].slice(-300),
          integrityScore: Math.max(0, 100 - penalty.current),
        };
        if (!fired.current && penalty.current >= limit) { fired.current = true; onViolationLimit?.(next); }
        return next;
      });
      onEvent?.(type, detail);
    },
    [onEvent, onViolationLimit, limit],
  );

  const enterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
      setNeedsFullscreen(false);
    } catch {
      setNeedsFullscreen(true);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onVis = () => { if (document.hidden) record("blur", "visibilitychange"); };
    const onBlur = () => record("blur", "window blur");
    const onFs = () => {
      if (requireFullscreen && !document.fullscreenElement) {
        record("fullscreen_exit");
        setNeedsFullscreen(true);
      }
    };
    const onCopy = (e: ClipboardEvent) => { e.preventDefault(); record("copy"); };
    const onCut = (e: ClipboardEvent) => { e.preventDefault(); record("cut"); };
    const onPaste = (e: ClipboardEvent) => { e.preventDefault(); record("paste"); };
    const onCtx = (e: MouseEvent) => { e.preventDefault(); record("contextmenu"); };
    const onPrint = () => record("print");
    const onOffline = () => record("offline");
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const blocked =
        (mod && ["c", "v", "x", "p", "s", "u", "t", "n", "w"].includes(e.key.toLowerCase())) ||
        e.key === "F12" ||
        (mod && e.altKey && ["i", "j", "c"].includes(e.key.toLowerCase())) ||
        (mod && e.shiftKey && ["i", "j", "c"].includes(e.key.toLowerCase()));
      if (blocked) { e.preventDefault(); record("shortcut", `${mod ? "mod+" : ""}${e.key}`); }
    };

    let base = window.outerHeight - window.innerHeight;
    const onResize = () => {
      const gap = window.outerHeight - window.innerHeight;
      const wgap = window.outerWidth - window.innerWidth;
      if (gap - base > 160 || wgap > 220) record("devtools", `gap=${gap}`);
      base = Math.min(base, gap);
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onCtx);
    window.addEventListener("beforeprint", onPrint);
    window.addEventListener("offline", onOffline);
    window.addEventListener("keydown", onKey, { capture: true });
    window.addEventListener("resize", onResize);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onCtx);
      window.removeEventListener("beforeprint", onPrint);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("keydown", onKey, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", onResize);
    };
  }, [enabled, requireFullscreen, record]);

  return { log, needsFullscreen, enterFullscreen, record };
}
