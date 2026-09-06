# Rencana: Kelas & Tugas di Exact Canvas

Tujuan: sketsa yang sekarang menumpuk dalam satu dropdown ditata per kelas dan
per pertemuan, dan tugas untuk murid bisa dibuat, dibagikan, dan dilacak
statusnya — tanpa meninggalkan kanvas.

## 1. Konsep

| Entitas      | Arti                                                                 |
|--------------|----------------------------------------------------------------------|
| Kelas        | Grup (mis. "TKA MAT 6 SEP SMA") **atau** murid privat (kelas berisi satu murid). |
| Murid        | Nama, sekolah/jenjang, nomor WhatsApp (opsional), catatan.            |
| Pertemuan    | Satu sesi mengajar: tanggal, jam, topik. Sketsa dikaitkan ke sini.    |
| Tugas        | Judul, deskripsi, tenggat, lampiran (sketsa/PDF/halaman tertentu), sasaran (kelas atau murid tertentu). |
| Pengumpulan  | Status per murid per tugas: belum · dikumpulkan · dinilai, nilai (opsional), catatan. |

Sketsa mendapat dua kaitan opsional: `class_id` dan `session_id`. Sketsa tanpa
kaitan tetap muncul di "Unfiled" — tidak ada yang hilang.

## 2. Data (SQLite, migrasi v2 di `db.rs`)

```
classes      (id, name, level, color, archived, created_at)
students     (id, name, school, phone, note, created_at)
class_students (class_id, student_id)
sessions     (id, class_id, at, duration_min, topic, note)
assignments  (id, class_id, title, body, due_at, attachment_kind, attachment_ref, created_at)
assignment_targets (assignment_id, student_id)        -- kosong = seluruh kelas
submissions  (assignment_id, student_id, status, score, note, updated_at)
ALTER TABLE canvases ADD COLUMN class_id TEXT; ADD COLUMN session_id TEXT
```

Berkas JSON sketsa tidak berubah. Kaitan hanya di indeks, jadi vault lama
tetap terbaca oleh versi lama.

## 3. Antarmuka

**Sidebar kiri "Classes"** (bisa disembunyikan, ⌘⇧C)
- Daftar kelas dengan warna dan jumlah tugas mendekati tenggat.
- Bagian "Today": pertemuan hari ini + tugas jatuh tempo ≤ 3 hari.
- "Unfiled sketches".

**Halaman kelas** (menggantikan kanvas sementara, atau panel geser dari kiri)
- Tab **Sessions**: kronologis, tiap pertemuan menampilkan sketsa-sketsanya
  (thumbnail halaman pertama). Tombol "New sketch for this session" → membuka
  kanvas A4 yang sudah terkait.
- Tab **Assignments**: daftar tugas, tenggat, progres (7/12 dikumpulkan).
  Klik → tabel murid × status, klik sel untuk mengubah status/nilai.
- Tab **Students**: daftar murid, tambah/hapus dari kelas, rekap per murid
  (hadir berapa pertemuan, tugas selesai berapa).

**Di dalam kanvas**
- Pemilih sketsa (pojok kiri bawah) dikelompokkan per kelas → pertemuan.
- Tombol "Make this an assignment": halaman aktif / seluruh sketsa diekspor
  jadi PDF lampiran, lalu formulir tugas terisi otomatis (judul dari nama
  sketsa, sasaran = kelas sketsa itu).
- Tombol "Share": salin PDF tugas ke clipboard / simpan ke folder
  `vault/tugas/` supaya tinggal diseret ke WhatsApp.

**Menu macOS**: File → New class…, New assignment…; View → Classes sidebar.

## 4. Tahapan pengerjaan

1. **Fondasi** (½ hari): migrasi v2, modul data `kelas/data.ts`, sidebar
   Classes, buat/ubah/arsip kelas, kaitkan sketsa ke kelas, pemilih sketsa
   berkelompok, "Unfiled".
2. **Murid & tugas** (1 hari): tabel murid, formulir tugas, tabel status
   pengumpulan, progres di daftar, lampiran PDF dari sketsa.
3. **Pertemuan & Today** (½ hari): sesi per kelas, sketsa per sesi,
   panel Today, tombol "New sketch for this session".
4. **Bagikan** (½ hari): ekspor lembar tugas PDF (kop: nama kelas, murid,
   tenggat), simpan ke `vault/tugas/`, salin ke clipboard.
5. **Rekap** (opsional): rekap per murid & per kelas, ekspor CSV, kehadiran.

Setiap tahap menghasilkan build yang bisa dipakai; tahap 1 saja sudah
merapikan daftar sketsa.

## 5. Keputusan yang perlu dikonfirmasi

1. Kelas privat: cukup "kelas berisi satu murid" (usulan), atau perlu jenis
   terpisah?
2. Nilai: perlu angka (0–100) atau cukup status + catatan? Usulan: angka
   opsional.
3. Pengingat tenggat: cukup tanda di sidebar (usulan), atau notifikasi macOS?
4. Data murid (nomor WhatsApp) disimpan di vault yang sama — kalau vault di
   iCloud, ikut tersinkron. Setuju?
