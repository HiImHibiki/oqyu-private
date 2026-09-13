"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/* Popover kecil yang dipakai bersama oleh pemilih bahasa dan pemilih tema.
 *
 * Dibuat karena keduanya semula membuka menunya dengan `absolute mt-2` — selalu
 * ke BAWAH. Di dalam bilah samping, kartu akun menempel di dasar layar, jadi
 * menunya terbuka di luar area yang terlihat: tombolnya tampak mati padahal
 * menunya terbuka. Di layar ponsel persoalannya bertambah, sebab menu selebar
 * 288 px yang dipatok `right-0` menonjol keluar layar 360 px.
 *
 * Arah buka dan lebarnya kini dihitung dari ruang yang benar-benar tersedia,
 * bukan ditebak saat menulis markah. */
export function Dropdown({
  trigger, label, children, width = 208,
}: {
  trigger: React.ReactNode;
  label: string;
  children: (close: () => void) => React.ReactNode;
  width?: number;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ up: boolean; maxH: number; w: number }>({ up: false, maxH: 320, w: width });
  const btnRef = useRef<HTMLButtonElement>(null);
  const close = () => setOpen(false);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const bawah = window.innerHeight - r.bottom - 12;
    const atas = r.top - 12;
    /* Buka ke atas hanya bila ruang di bawah memang sempit DAN ruang di atas
     * lebih lega — supaya menu tidak melompat-lompat pada layar yang cukup. */
    const up = bawah < 220 && atas > bawah;
    setPos({
      up,
      maxH: Math.max(160, (up ? atas : bawah)),
      w: Math.min(width, window.innerWidth - 24),
    });
  }, [open, width]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="btn btn-ghost !px-2.5 min-h-11 min-w-11"
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        aria-label={label}
      >
        {trigger}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={close} aria-hidden />
          <div
            role="menu"
            aria-label={label}
            className={`card absolute right-0 z-50 p-1.5 rise ${pos.up ? "bottom-full mb-2" : "top-full mt-2"}`}
            style={{ width: pos.w, maxHeight: pos.maxH, overflowY: "auto" }}
          >
            {children(close)}
          </div>
        </>
      )}
    </div>
  );
}
