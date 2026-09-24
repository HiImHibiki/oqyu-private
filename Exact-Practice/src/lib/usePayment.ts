"use client";
import { useState } from "react";
import { loadSnap } from "@/lib/snap";

/* «manual» adalah transfer bank: tidak ada gateway yang dipanggil, tidak ada
 * yang ditunggu di peramban. Ia ada di union ini supaya satu pesanan bisa
 * membawa cara bayarnya sendiri ke mana-mana; pay() sengaja tidak menanganinya
 * — layar yang memanggilnya menampilkan instruksi transfer, bukan tombol. */
export type Gateway = "midtrans" | "stripe" | "simulation" | "manual";

/* Menjalankan satu pesanan sampai lunas, lewat gateway mana pun.
 *
 * Dipakai dua tempat di halaman paket: membeli paket baru dan melanjutkan
 * pesanan yang menggantung. Keduanya harus berperilaku persis sama — termasuk
 * dalam hal yang paling penting: kuota TIDAK pernah diberikan dari sini.
 * Yang ditunggu adalah status pesanan berubah menjadi `paid` di server, dan
 * itu hanya terjadi lewat webhook yang signature-nya terverifikasi. */
export function usePayment(onPaid: (packageId: string | null) => void) {
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function post(url: string, body: unknown) {
    setBusy(true); setErr(null);
    try {
      const r = await fetch(url, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Something went wrong");
      return j;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function pay(orderId: string, gateway: Gateway, packageId?: string | null) {
    if (gateway === "manual") return;

    if (gateway === "simulation") {
      const j = await post("/api/checkout/pay", { orderId });
      if (j) onPaid(packageId ?? null);
      return;
    }

    const j = await post("/api/checkout/create", { orderId });
    if (!j) return;

    if (j.gateway === "simulation") {          // gateway dimatikan di tengah jalan
      const done = await post("/api/checkout/pay", { orderId });
      if (done) onPaid(packageId ?? null);
      return;
    }

    if (j.gateway === "stripe" && j.url) {
      window.location.href = j.url as string;  // Stripe Checkout dihosting Stripe
      return;
    }

    if (j.gateway === "midtrans" && j.token) {
      try {
        await loadSnap();
      } catch {
        setErr("Could not load the payment module. Check your connection and try again.");
        return;
      }
      window.snap?.pay(j.token as string, {
        onSuccess: () => void waitFor(orderId),
        onPending: () => void waitFor(orderId),
        onError: () => setErr("Payment failed. Try another method."),
        onClose: () => setErr("The payment window was closed before it finished."),
      });
    }
  }

  /** Menunggu webhook tiba. Dipanggil juga saat halaman dibuka kembali dari
   *  Stripe atau Midtrans, karena saat itu pembayaran mungkin sudah selesai. */
  async function waitFor(orderId: string) {
    setWaiting(true); setErr(null);
    for (let i = 0; i < 40; i++) {
      try {
        const s = await (await fetch(`/api/checkout/status?orderId=${orderId}`)).json();
        if (s.status === "paid") {
          setWaiting(false);
          onPaid(typeof s.packageId === "string" ? s.packageId : null);
          return;
        }
      } catch { /* jaringan sedang buruk, coba lagi */ }
      await new Promise((r) => setTimeout(r, 3000));
    }
    setWaiting(false);
    setErr("We have not received the payment confirmation yet. If your account was charged, reopen this page in a few minutes or contact us.");
  }

  return { busy, waiting, err, setErr, post, pay, waitFor };
}
