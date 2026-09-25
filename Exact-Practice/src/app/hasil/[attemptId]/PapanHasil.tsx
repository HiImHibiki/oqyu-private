"use client";
import { useEffect, useState } from "react";
import { PapanGuru, type ModePapan } from "@/components/exam/PapanGuru";

/* Papan guru di halaman hasil latihan. Anak yang sudah selesai sering
 * memperbaiki nomor yang salah sambil menyimak pembahasan — jadi papannya
 * tetap ada di sini, tidak hanya di halaman soal, dan tidak perlu bertanya
 * dulu. Hanya muncul kalau Canvas menyala (GET /api/latihan/papan). */
export function PapanHasil() {
  const [url, setUrl] = useState<string | null>(null);
  const [mode, setMode] = useState<ModePapan>("normal");
  useEffect(() => {
    let batal = false;
    fetch("/api/latihan/papan").then((r) => r.json())
      .then((j: { url?: string | null }) => { if (!batal && j.url) setUrl(j.url); })
      .catch(() => {});
    return () => { batal = true; };
  }, []);
  if (!url) return null;
  return (
    <div className="card mb-6 overflow-hidden">
      <PapanGuru url={url} mode={mode} onMode={setMode} kelasNormal="flex h-[60vh] flex-col" />
    </div>
  );
}
