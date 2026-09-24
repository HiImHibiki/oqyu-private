/* Midtrans Snap dimuat dari CDN Midtrans, bukan di-bundle: skripnya harus
 * berasal dari domain yang sama dengan yang memproses pembayaran. Dipakai dua
 * alur — pendaftaran dan pembelian paket tambahan — jadi pemuatnya di sini
 * supaya deklarasi `window.snap` hanya ada satu. */

declare global {
  interface Window {
    snap?: {
      pay: (token: string, cb: {
        onSuccess?: () => void; onPending?: () => void;
        onError?: () => void; onClose?: () => void;
      }) => void;
    };
  }
}

export function loadSnap(): Promise<void> {
  if (window.snap) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true"
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    el.setAttribute("data-client-key", process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? "");
    el.onload = () => resolve();
    el.onerror = () => reject(new Error("snap.js failed to load"));
    document.head.appendChild(el);
  });
}
