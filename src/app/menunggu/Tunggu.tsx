"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Bertanya ke server tiap 5 detik; begitu guru menyetujui, langsung masuk. */
export function Tunggu() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(async () => {
      const j = await fetch("/api/me", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
      const role = j?.user?.role;
      if (role && role !== "menunggu") { router.replace("/latihan"); router.refresh(); }
    }, 5000);
    return () => clearInterval(t);
  }, [router]);
  return (
    <p className="mt-6 text-center text-xs muted">
      Bukan kamu?{" "}
      <button className="underline" onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/masuk"); router.refresh();
      }}>Keluar</button>
    </p>
  );
}
