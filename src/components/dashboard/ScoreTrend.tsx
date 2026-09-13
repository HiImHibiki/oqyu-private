"use client";
import { FigureView } from "@/components/charts/Figure";

/** Satu seri per jenis ujian; titik yang bukan milik seri itu diisi null
 *  supaya sumbu-x tetap sejajar dengan urutan waktu pengerjaan. */
export function ScoreTrend({ data }: { data: { label: string; exam: string; value: number; total: number }[] }) {
  const exams = [...new Set(data.map((d) => d.exam))];
  const series = exams.map((ex) => ({
    name: ex,
    values: data.map((d) => (d.exam === ex ? d.value : null)),
  }));

  return (
    <FigureView
      maxWidth={560}
      figure={{
        kind: "line_chart",
        alt: `Tren skor dari ${data.length} try out`,
        categories: data.map((d) => d.label),
        series,
        yLabel: "% dari skor maksimum",
      }}
    />
  );
}
