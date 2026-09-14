/* Penyusun prompt siap-tempel untuk ChatGPT / Gemini / Claude.
 *
 * Keluarannya harus naskah berformat Exact Worksheet Maker PERSIS seperti yang
 * dipahami uraiNaskah() di naskah.ts — jadi kedua berkas ini sepasang: tiap
 * kali format naskah berubah, keduanya ikut berubah. Contoh format di dalam
 * prompt sengaja ditulis utuh (bukan dijelaskan dengan kata-kata) karena model
 * jauh lebih patuh meniru contoh daripada menuruti deskripsi.
 *
 * Dipakai di peramban untuk kotak prompt yang selalu ikut berubah saat form
 * diisi, jadi harus tetap murni teks tanpa modul node.
 */

export type JenisSoal = "PG" | "B" | "I" | "E";

export interface OpsiPrompt {
  materi: string;
  mapel?: string;
  kelas?: string;
  jumlah?: number;
  jumlahSet?: number;
  kesulitan?: string;
  bahasa?: string;
  jenis?: JenisSoal[];
  pembahasan?: boolean;
  latex?: boolean;
  diagram?: boolean;
  catatan?: string;
}

const NAMA_BAGIAN: Record<JenisSoal, string> = {
  PG: "Pilihan Ganda",
  B: "Benar/Salah",
  I: "Isian Singkat",
  E: "Uraian",
};

const KETERANGAN: Record<JenisSoal, string> = {
  PG: "PG — pilihan ganda, tepat satu jawaban benar",
  B: "B — pernyataan yang dinilai Benar atau Salah",
  I: "I — isian singkat, jawabannya satu angka atau satu kata",
  E: "E — uraian (hanya masuk PDF, tidak dinilai otomatis)",
};

function contohBagian(j: JenisSoal): string[] {
  const kepala = `Bagian ${NAMA_BAGIAN[j]}: (${j})`;
  if (j === "PG") {
    return [kepala, "PG1. Teks soal pilihan ganda.", "A. pilihan pertama", "B. pilihan kedua", "C. pilihan ketiga", "D. pilihan keempat"];
  }
  if (j === "B") return [kepala, "B1. Sebuah pernyataan yang harus dinilai benar atau salah. Jangan diberi pilihan A/B/C/D."];
  if (j === "I") return [kepala, "I1. Teks soal isian singkat."];
  return [kepala, "E1. Perintah uraian yang dijawab beberapa kalimat."];
}

const CONTOH_KUNCI: Record<JenisSoal, string> = { PG: "PG1-B", B: "B1-Benar", I: "I1-18", E: "E1-inti jawaban" };

export function susunPrompt(o: OpsiPrompt): string {
  const materi = (o.materi || "").trim() || "(isi dulu materinya)";
  const jumlah = Math.max(1, Math.min(50, o.jumlah || 10));
  const set = Math.max(1, Math.min(10, o.jumlahSet || 1));
  const bahasa = (o.bahasa || "").trim() || "Bahasa Indonesia";
  const jenis = o.jenis?.length ? o.jenis : (["PG"] as JenisSoal[]);
  const jenjang = [o.mapel?.trim(), o.kelas?.trim() && `kelas ${o.kelas.trim()}`].filter(Boolean).join(" ");

  const L: string[] = [];
  L.push(`Kamu guru berpengalaman yang menyusun soal latihan${jenjang ? " untuk " + jenjang : ""}.`);
  L.push("");
  L.push(`Buatkan ${jumlah} soal${set > 1 ? " PER SET" : ""} tentang: ${materi}`);
  if (o.mapel?.trim()) L.push(`Mata pelajaran: ${o.mapel.trim()}`);
  if (o.kelas?.trim()) L.push(`Kelas: ${o.kelas.trim()}`);
  /* Saat beberapa set diminta, kesulitannya sudah diatur naik bertahap per set
   * di bawah — menyebut satu tingkat kesulitan untuk semuanya malah bertabrakan
   * dengan instruksi itu. */
  if (o.kesulitan?.trim() && set === 1) L.push(`Tingkat kesulitan: ${o.kesulitan.trim()}`);
  L.push(`Bahasa: ${bahasa}`);
  L.push(`Jenis soal yang dipakai: ${jenis.map((j) => KETERANGAN[j]).join("; ")}`);
  L.push("");
  L.push("Balas HANYA naskah soalnya: tanpa kalimat pembuka, tanpa penutup, tanpa blok kode (```), tanpa tabel markdown, tanpa tautan/URL, tanpa kutipan sumber.");
  L.push("");

  if (set > 1) {
    L.push(`=== BUAT ${set} SET SEKALIGUS (PENTING) ===`);
    L.push(`Bukan satu set panjang, melainkan ${set} SET TERPISAH tentang materi yang sama, kesulitannya naik bertahap dari Set 1 (paling mudah) sampai Set ${set} (paling sulit).`);
    L.push("Tiap set harus LENGKAP dan MANDIRI: soalnya sendiri, blok Kunci Jawaban sendiri" + (o.pembahasan === false ? "" : ", blok Pembahasan sendiri") + ".");
    L.push("Sebelum set kedua dan seterusnya, tulis baris PERSIS seperti ini sendirian (tanpa tanda baca lain):");
    L.push(`SET 2`);
    L.push(`Jadi urutannya: set pertama lengkap, lalu baris "SET 2", lalu set kedua lengkap, dan seterusnya sampai set ${set}. Set pertama TIDAK didahului baris "SET 1".`);
    L.push("");
  }

  L.push("=== FORMAT NASKAH (WAJIB DIIKUTI PERSIS) ===");
  L.push("Tiap jenis soal dikelompokkan di bawah baris judul bagiannya sendiri. Nomor berjalan sendiri-sendiri per jenis (PG1, PG2, … lalu I1, I2, …). Tiap opsi ditulis di baris baru. Pisahkan antar soal dengan satu baris kosong.");
  L.push("");
  jenis.forEach((j) => { L.push(...contohBagian(j)); L.push(""); });

  if (jenis.includes("PG")) L.push("Catatan PG: minimal 4 opsi (A–D, boleh sampai E). Hanya satu yang benar.");
  if (jenis.includes("B")) L.push("Catatan B: tulis pernyataannya saja, tanpa opsi A/B/C/D.");
  if (jenis.includes("I")) L.push("Catatan I: jawabannya harus pendek dan pasti (satu angka atau satu kata), tanpa satuan, dan tidak boleh mengandung koma.");
  if (jenis.includes("E")) L.push("Catatan E: soal uraian hanya ikut tercetak di PDF dan dinilai guru — tetap beri kuncinya berupa inti jawaban.");
  L.push("");

  L.push("=== KUNCI JAWABAN (WAJIB ADA) ===");
  L.push('Setelah semua soal, tulis baris "Kunci Jawaban" TERSENDIRI, lalu daftar kuncinya di baris berikutnya:');
  L.push("");
  L.push("Kunci Jawaban");
  L.push(jenis.map((j) => CONTOH_KUNCI[j]).join(", "));
  L.push("");
  L.push("Aturan kunci jawaban:");
  L.push("- Satu daftar dipisah koma, bukan satu entri per baris.");
  if (jenis.includes("PG")) L.push("- PG: satu huruf saja, mis. PG1-B");
  if (jenis.includes("B")) L.push("- B: tulis Benar atau Salah, mis. B1-Benar");
  if (jenis.includes("I")) L.push("- I: jawabannya persis, angka tanpa satuan, pemisah desimal pakai titik, mis. I1-3.5");
  if (jenis.includes("E")) L.push("- E: inti jawabannya secara singkat.");
  L.push("- SEMUA soal harus ada di kunci. Soal yang kodenya tidak ada di kunci dibuang otomatis oleh sistem.");
  L.push("");

  if (o.pembahasan !== false) {
    L.push("=== PEMBAHASAN ===");
    L.push('Setelah blok kunci, tulis baris "Pembahasan" TERSENDIRI, lalu satu entri per soal dengan pola yang sama:');
    L.push("");
    L.push("Pembahasan");
    L.push(`${jenis[0]}1-langkah singkat sampai ketemu jawabannya`);
    L.push("");
    L.push(`${jenis[0]}2-langkah singkat sampai ketemu jawabannya`);
    L.push("");
    L.push("Tulis 1–3 kalimat per soal — langkahnya, bukan cuma mengulang jawaban akhir.");
    L.push("SATU ENTRI PER BARIS, dan jangan pernah menaruh dua kode soal di baris yang sama. (Beda dengan blok Kunci Jawaban yang memang satu daftar berkoma: kalimat pembahasan hampir selalu memuat koma, jadi kalau digabung satu baris, penjelasannya akan terpotong di koma pertama.)");
    L.push("");
  }

  if (o.latex !== false) {
    L.push("=== CARA MENULIS RUMUS ===");
    L.push("Semua rumus, pecahan, akar, pangkat, dan simbol matematika ditulis sebagai LaTeX di antara tanda $ … $.");
    L.push("Contoh: $\\frac{3}{4}$, $x^2$, $\\sqrt{25}$, $x^2 - 4x + 3 = 0$, $L = \\pi r^2$, $30^\\circ$, $\\le$, $\\times$");
    L.push("JANGAN memakai karakter ², ³, √, ±, π, °, ½ langsung di teks — termasuk di dalam opsi, kunci jawaban, dan pembahasan.");
    L.push("");
  }

  if (o.diagram) {
    L.push("=== DIAGRAM & TABEL ===");
    L.push("Kalau sebuah soal butuh gambar atau tabel, sisipkan salah satu tag di bawah ini apa adanya di dalam teks soal, satu tag satu baris tersendiri:");
    L.push("[[grafik: f1=2^x; xmin=-3; xmax=4; ymin=0; ymax=9; sumbux=x; sumbuy=y]]");
    L.push("[[grafik: f1=x^2; f2=2*x+1; xmin=-5; xmax=5; ymin=-5; ymax=10]]");
    L.push("[[tabel: judul=Data gerak; header=Waktu (s),Jarak (m); baris=1,60 | 2,120 | 3,180]]");
    L.push("[[bangun: bentuk=segitiga-siku; alas=6; tinggi=8]]");
    L.push("[[bangunruang: bentuk=tabung; jari=4; tinggi=8]]");
    L.push("[[garisbilangan: min=-5; max=5; step=1; titik=3:A]]");
    L.push("[[venn: a=Matematika; b=IPA; onlyA=5; onlyB=4; ab=2]]");
    L.push("[[statistik: tipe=batang; label=Sen,Sel,Rab; data=10,15,8]]");
    L.push("[[histogram: batas=10,20,30,40; frekuensi=4,7,3]]");
    L.push("[[pencar: x=1,2,3,4; y=2,4,5,9]]");
    L.push("[[pohonfaktor: n=60]]");
    L.push("Aturan tag:");
    L.push("- Pakai HANYA jenis tag dan nama parameter yang ada di daftar di atas. Tag karangan sendiri tidak tergambar dan muncul sebagai galat di layar murid.");
    L.push("- Pemisah antar parameter adalah titik koma, dan tag ditulis polos — jangan dibungkus tanda $ atau tanda kutip.");
    L.push("- Isi tag TIDAK boleh memuat LaTeX. Tulis f1=x^2, bukan f1=$x^2$.");
    L.push("- Soalnya harus tetap bisa dipahami dari teks; tag itu penunjang, bukan pengganti kalimat soal.");
    L.push("- Jangan memakai gambar dari internet atau URL apa pun.");
    L.push("");
  } else {
    L.push("Jangan memakai gambar, tabel, atau URL — soal harus bisa dikerjakan dari teks dan rumusnya saja.");
    L.push("");
  }

  if (o.catatan?.trim()) {
    L.push("=== PERMINTAAN TAMBAHAN ===");
    L.push(o.catatan.trim());
    L.push("");
  }

  L.push(
    `Sebelum menjawab, periksa sendiri: jumlah soalnya tepat ${jumlah}${set > 1 ? " di SETIAP set" : ""}, ` +
    `setiap soal punya entri di Kunci Jawaban, ditulis dalam ${bahasa}, tidak ada tautan di mana pun` +
    (o.latex !== false ? ", tidak ada simbol matematika di luar $…$" : "") +
    (set > 1 ? `, dan ada tepat ${set - 1} baris penanda set ("SET 2" sampai "SET ${set}")` : "") + ".",
  );
  L.push("Sekarang tulis naskahnya.");
  return L.join("\n");
}
