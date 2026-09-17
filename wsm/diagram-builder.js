/* Exact Worksheet Maker — Diagram Builder Modal
 * Lets a teacher build a [[type: key=value; ...]] diagram tag through a
 * form instead of memorizing the syntax, with a live SVG preview, then
 * inserts the tag into the raw worksheet textarea at the cursor position.
 */

document.addEventListener('DOMContentLoaded', () => {
  const el = (id) => document.getElementById(id);
  const rawInput = el('rawInput');
  const overlay = el('diagramModalOverlay');
  const typeSelect = el('diagType');
  const fieldsHost = el('diagFields');
  const previewHost = el('diagPreview');

  if (!overlay || !typeSelect) return;

  const FIELD_SPECS = {
    grafik: [
      { key: 'f1', label: 'f1(x) =', type: 'text', def: 'x^2-4' },
      { key: 'f2', label: 'f2(x) = (opsional)', type: 'text', def: '' },
      { key: 'f3', label: 'f3(x) = (opsional)', type: 'text', def: '' },
      { key: 'xmin', label: 'x min', type: 'number', def: -10 },
      { key: 'xmax', label: 'x max', type: 'number', def: 10 },
      { key: 'ymin', label: 'y min', type: 'number', def: -10 },
      { key: 'ymax', label: 'y max', type: 'number', def: 10 },
      { key: 'sumbux', label: 'Nama + satuan sumbu x (opsional)', type: 'text', def: '' },
      { key: 'sumbuy', label: 'Nama + satuan sumbu y (opsional)', type: 'text', def: '' },
      { key: 'domain', label: 'Batasi domain — "f1:-2,3"', type: 'text', def: '' },
      { key: 'arsir', label: 'Arsir luas di bawah kurva — "f1:0,3"', type: 'text', def: '' },
      { key: 'singgung', label: 'Garis singgung + segitiga gradien — "f1:2"', type: 'text', def: '' },
      { key: 'asimtot', label: 'Asimtot — "x=2, y=0"', type: 'text', def: '' },
    ],
    programlinear: [
      {
        key: 'pertidaksamaan', label: 'Pertidaksamaan (pisah koma)', type: 'text',
        def: '2x+y<=10,x+3y<=12,x>=0,y>=0',
      },
      { key: 'xmax', label: 'x max', type: 'number', def: 8 },
      { key: 'ymax', label: 'y max', type: 'number', def: 8 },
    ],
    transformasi: [
      { key: 'titik', label: 'Titik bentuk asli (format: Nama:x:y, pisah koma)', type: 'text', def: 'A:1:1,B:4:1,C:1:5' },
      {
        key: 'jenis', label: 'Jenis Transformasi', type: 'select', def: 'translasi',
        options: [
          ['translasi', 'Translasi (pergeseran)'], ['refleksi', 'Refleksi (pencerminan)'],
          ['rotasi', 'Rotasi (perputaran)'], ['dilatasi', 'Dilatasi (perkalian)'],
        ],
      },
    ],
    pohonpeluang: [
      { key: 'level1', label: 'Tahap 1 (format: Kejadian:pecahan, pisah koma)', type: 'text', def: 'Merah:2/5,Biru:3/5' },
      { key: 'level2', label: 'Tahap 2 (opsional, format sama)', type: 'text', def: 'Merah:2/5,Biru:3/5' },
      { key: 'level3', label: 'Tahap 3 (opsional, format sama)', type: 'text', def: '' },
    ],
    vektor: [
      {
        key: 'v', label: 'Vektor (satu baris = satu vektor: nama:dx,dy)', type: 'textarea',
        def: 'a:4,2\nb:-2,3',
      },
      {
        key: 'resultan', label: 'Gambar resultan', type: 'select', def: 'ya',
        options: [['ya', 'Ya — tampilkan resultan'], ['tidak', 'Tidak']],
      },
    ],
    bearing: [
      {
        key: 'jalur', label: 'Kaki perjalanan (satu baris = satu kaki: Label:sudut:jarak)', type: 'textarea',
        def: 'B:065:8\nC:140:5',
      },
    ],
    ogive: [
      { key: 'data', label: 'Data mentah (pisah koma — kosongkan bila pakai data berkelompok)', type: 'text', def: '12,15,15,18,20,22,25,28,30,35' },
      { key: 'batas', label: 'Batas atas kelas (data berkelompok, pisah koma)', type: 'text', def: '' },
      { key: 'kumulatif', label: 'Frekuensi kumulatif (data berkelompok, pisah koma)', type: 'text', def: '' },
    ],
    boxplot: [
      { key: 'data', label: 'Data mentah (pisah koma — kuartil dihitung otomatis)', type: 'text', def: '12,15,15,18,20,22,25,28,30,35' },
      { key: 'min', label: 'Min (isi hanya bila tidak pakai data mentah)', type: 'text', def: '' },
      { key: 'q1', label: 'Q1', type: 'text', def: '' },
      { key: 'median', label: 'Median', type: 'text', def: '' },
      { key: 'q3', label: 'Q3', type: 'text', def: '' },
      { key: 'max', label: 'Max', type: 'text', def: '' },
    ],
    pembagian: [
      { key: 'dividen', label: 'Bilangan yang dibagi', type: 'number', def: 968 },
      { key: 'pembagi', label: 'Pembagi', type: 'number', def: 4 },
      {
        key: 'jawaban', label: 'Tampilan', type: 'select', def: 'kosong',
        options: [['kosong', 'Kosong (untuk diisi siswa)'], ['lengkap', 'Lengkap (kunci jawaban)']],
      },
    ],
    rangkaian: [
      {
        key: 'tipe', label: 'Susunan', type: 'select', def: 'seri',
        options: [['seri', 'Seri'], ['paralel', 'Paralel'], ['campuran', 'Campuran (seri + paralel)']],
      },
      { key: 'sumber', label: 'Tegangan sumber (volt)', type: 'number', def: 12 },
    ],
    pencar: [
      { key: 'judul', label: 'Judul (opsional)', type: 'text', def: '' },
      { key: 'x', label: 'Nilai x (pisah koma)', type: 'text', def: '1,2,3,4,5' },
      { key: 'y', label: 'Nilai y (pisah koma)', type: 'text', def: '2.1,3.9,6.2,7.8,10.1' },
      { key: 'sumbux', label: 'Nama + satuan sumbu x', type: 'text', def: '' },
      { key: 'sumbuy', label: 'Nama + satuan sumbu y', type: 'text', def: '' },
      {
        key: 'garis', label: 'Garis lurus terbaik', type: 'select', def: 'ya',
        options: [['ya', 'Gambar garis regresi'], ['tidak', 'Tidak (siswa menariknya sendiri)']],
      },
      {
        key: 'rerata', label: 'Tandai titik rata-rata', type: 'select', def: 'tidak',
        options: [['tidak', 'Tidak'], ['ya', 'Ya — garis harus melewatinya']],
      },
      { key: 'galat', label: 'Batang galat (satu angka untuk semua, atau satu per titik)', type: 'text', def: '' },
    ],
    histogram: [
      { key: 'judul', label: 'Judul (opsional)', type: 'text', def: '' },
      { key: 'batas', label: 'Batas kelas (n+1 angka, pisah koma — boleh lebar tak sama)', type: 'text', def: '0,10,20,50' },
      { key: 'frekuensi', label: 'Frekuensi tiap kelas (n angka)', type: 'text', def: '5,8,12' },
      { key: 'sumbux', label: 'Nama sumbu x', type: 'text', def: '' },
      { key: 'sumbuy', label: 'Nama sumbu y', type: 'text', def: '' },
    ],
    batangdaun: [
      { key: 'data', label: 'Data (pisah koma)', type: 'text', def: '12,15,15,21,23,34,38,41' },
      { key: 'satuan', label: 'Nilai satu batang (10 = puluhan)', type: 'number', def: 10 },
    ],
    alatlab: [
      {
        key: 'jenis', label: 'Rangkaian Alat', type: 'select', def: 'destilasi',
        options: [
          ['destilasi', 'Destilasi'], ['titrasi', 'Titrasi'], ['elektrolisis', 'Sel Elektrolisis'],
          ['tabunggas', 'Tabung Suntik Gas'], ['penyaringan', 'Penyaringan (Filtrasi)'],
          ['pemanasan', 'Pemanasan (Kaki Tiga + Bunsen)'],
        ],
      },
      { key: 'judul', label: 'Judul (opsional)', type: 'text', def: '' },
      {
        key: 'label', label: 'Nama bagian alat', type: 'select', def: 'ya',
        options: [['ya', 'Ditampilkan'], ['tidak', 'Disembunyikan (untuk diisi siswa)']],
      },
    ],
    lingkaranteorema: [
      {
        key: 'jenis', label: 'Teorema', type: 'select', def: 'sudut-pusat',
        options: [
          ['sudut-pusat', 'Sudut pusat = 2 × sudut keliling'],
          ['sudut-keliling', 'Sudut keliling pada busur yang sama'],
          ['semilingkaran', 'Sudut pada setengah lingkaran = 90°'],
          ['segiempat-talibusur', 'Segiempat tali busur'],
          ['tangen-jari', 'Garis singgung ⟂ jari-jari'],
          ['dua-tangen', 'Dua garis singgung dari satu titik'],
        ],
      },
      { key: 'sudut', label: 'Nilai sudut pusat (khusus "sudut pusat")', type: 'number', def: '' },
    ],
    jaring: [
      {
        key: 'bentuk', label: 'Bangun Ruang', type: 'select', def: 'kubus',
        options: [
          ['kubus', 'Kubus'], ['balok', 'Balok'], ['prisma-segitiga', 'Prisma Segitiga'],
          ['limas-segiempat', 'Limas Segiempat'], ['tabung', 'Tabung'], ['kerucut', 'Kerucut'],
        ],
      },
    ],
    pandangan: [
      {
        key: 'bentuk', label: 'Bangun Ruang', type: 'select', def: 'kubus',
        options: [
          ['kubus', 'Kubus'], ['balok', 'Balok'], ['tabung', 'Tabung'], ['kerucut', 'Kerucut'],
          ['limas-segiempat', 'Limas Segiempat'], ['prisma-segitiga', 'Prisma Segitiga'], ['bola', 'Bola'],
        ],
      },
      {
        key: 'jawaban', label: 'Tampilan', type: 'select', def: 'lengkap',
        options: [['lengkap', 'Lengkap (kunci jawaban)'], ['kosong', 'Kotak kosong (digambar siswa)']],
      },
    ],
    punnett: [
      { key: 'induk1', label: 'Genotipe induk 1 (mis. Aa atau AaBb)', type: 'text', def: 'Aa' },
      { key: 'induk2', label: 'Genotipe induk 2', type: 'text', def: 'Aa' },
      {
        key: 'jawaban', label: 'Isi kotak', type: 'select', def: 'lengkap',
        options: [['lengkap', 'Lengkap (kunci jawaban)'], ['kosong', 'Kosong (diisi siswa)']],
      },
      {
        key: 'rasio', label: 'Tampilkan rasio genotipe & fenotipe', type: 'select', def: 'ya',
        options: [['ya', 'Ya'], ['tidak', 'Tidak']],
      },
    ],
    kuncideterminasi: [
      { key: 'judul', label: 'Judul (opsional)', type: 'text', def: '' },
      {
        key: 'langkah',
        label: 'Langkah (satu baris = satu cabang: nomor:ciri:hasil — hasil berupa angka berarti lanjut ke langkah itu)',
        type: 'textarea',
        def: '1a:Berdaun jarum:Pinus\n1b:Berdaun lebar:2\n2a:Bertulang daun menjari:Pepaya\n2b:Bertulang daun menyirip:Mangga',
      },
    ],
    jaringmakanan: [
      {
        key: 'hubungan', label: 'Hubungan makan (dimakan>pemakan, pisah koma)', type: 'text',
        def: 'Rumput>Belalang, Rumput>Tikus, Belalang>Katak, Tikus>Ular, Katak>Ular, Ular>Elang',
      },
    ],
    sinar: [
      {
        key: 'alat', label: 'Jenis Lensa', type: 'select', def: 'cembung',
        options: [['cembung', 'Lensa Cembung (konvergen)'], ['cekung', 'Lensa Cekung (divergen)']],
      },
      { key: 'f', label: 'Jarak fokus', type: 'number', def: 3 },
      { key: 'objek_jarak', label: 'Jarak benda ke lensa', type: 'number', def: 6 },
      { key: 'objek_tinggi', label: 'Tinggi benda', type: 'number', def: 2 },
    ],
    gerak: [
      {
        key: 'tipe', label: 'Jenis Grafik', type: 'select', def: 'kecepatan-waktu',
        options: [['kecepatan-waktu', 'Kecepatan terhadap Waktu'], ['jarak-waktu', 'Jarak terhadap Waktu']],
      },
      { key: 'titik', label: 'Titik (format: waktu:nilai, pisah koma)', type: 'text', def: '0:0,2:10,5:10,8:0' },
      {
        key: 'arsir', label: 'Arsir luas di bawah kurva', type: 'select', def: 'ya',
        options: [['ya', 'Ya'], ['tidak', 'Tidak']],
      },
      {
        key: 'gradien', label: 'Tampilkan gradien tiap segmen', type: 'select', def: 'ya',
        options: [['ya', 'Ya'], ['tidak', 'Tidak']],
      },
    ],
    gelombang: [
      {
        key: 'jenis', label: 'Jenis Gelombang', type: 'select', def: 'transversal',
        options: [['transversal', 'Transversal (kurva sinus)'], ['longitudinal', 'Longitudinal (rapatan/renggangan)']],
      },
      { key: 'amplitudo', label: 'Amplitudo', type: 'number', def: 20 },
      { key: 'panjanggelombang', label: 'Panjang gelombang', type: 'number', def: 60 },
      { key: 'jumlah', label: 'Jumlah gelombang', type: 'number', def: 2 },
    ],
    medan: [
      {
        key: 'jenis', label: 'Jenis Medan', type: 'select', def: 'positif',
        options: [
          ['positif', 'Muatan Positif (radial keluar)'], ['negatif', 'Muatan Negatif (radial masuk)'],
          ['kawat', 'Kawat Berarus (lingkaran konsentris)'], ['solenoida', 'Solenoida (kumparan)'],
        ],
      },
    ],
    tingkatenergi: [
      { key: 'level', label: 'Tingkat energi (format: Nama:nilai, pisah koma)', type: 'text', def: 'Reaktan:0,Kompleks Aktif:80,Produk:-40' },
      { key: 'satuan', label: 'Satuan', type: 'text', def: 'kJ/mol' },
    ],
    kulitelektron: [
      { key: 'unsur', label: 'Lambang unsur', type: 'text', def: 'Na' },
      { key: 'nomor', label: 'Nomor atom', type: 'number', def: 11 },
      { key: 'kulit', label: 'Isi kulit manual (opsional, mis. 2,8,1)', type: 'text', def: '' },
    ],
    titrasi: [
      {
        key: 'jenis', label: 'Jenis Titrasi', type: 'select', def: 'kuat-kuat',
        options: [
          ['kuat-kuat', 'Asam Kuat – Basa Kuat'], ['lemah-kuat', 'Asam Lemah – Basa Kuat'],
          ['kuat-lemah', 'Asam Kuat – Basa Lemah'], ['lemah-lemah', 'Asam Lemah – Basa Lemah'],
        ],
      },
      { key: 'volume_awal', label: 'Volume larutan yang dititrasi (mL)', type: 'number', def: 25 },
    ],
    katalis: [
      { key: 'reaktan', label: 'Energi reaktan', type: 'number', def: 0 },
      { key: 'produk', label: 'Energi produk', type: 'number', def: -40 },
      { key: 'ea_tanpa', label: 'Energi aktivasi tanpa katalis', type: 'number', def: 80 },
      { key: 'ea_dengan', label: 'Energi aktivasi dengan katalis', type: 'number', def: 40 },
      { key: 'satuan', label: 'Satuan', type: 'text', def: 'kJ/mol' },
    ],
    kisi: [
      {
        key: 'jenis', label: 'Jenis Kisi', type: 'select', def: 'ionik',
        options: [['ionik', 'Ionik (kisi kubus ion)'], ['kovalen', 'Kovalen Raksasa']],
      },
    ],
    piramida: [
      { key: 'tingkat', label: 'Tingkat trofik (format: Nama:nilai, dari produsen, pisah koma)', type: 'text', def: 'Produsen:500,Konsumen I:50,Konsumen II:5,Konsumen III:1' },
      {
        key: 'tipe', label: 'Jenis Piramida', type: 'select', def: 'jumlah',
        options: [['jumlah', 'Piramida Jumlah'], ['biomassa', 'Piramida Biomassa'], ['energi', 'Piramida Energi']],
      },
    ],
    bangun: [
      {
        key: 'bentuk', label: 'Bentuk', type: 'select', def: 'segitiga-sembarang',
        options: [
          ['segitiga-sembarang', 'Segitiga (3 sisi)'],
          ['segitiga-siku', 'Segitiga Siku-siku'],
          ['persegi', 'Persegi'],
          ['persegi-panjang', 'Persegi Panjang'],
          ['trapesium', 'Trapesium'],
          ['lingkaran', 'Lingkaran'],
          ['setengah-lingkaran', 'Setengah Lingkaran'],
          ['gabungan', 'Gabungan Beberapa Bentuk'],
        ],
      },
    ],
    garisbilangan: [
      { key: 'min', label: 'Min', type: 'number', def: -10 },
      { key: 'max', label: 'Max', type: 'number', def: 10 },
      { key: 'step', label: 'Interval', type: 'number', def: 1 },
      { key: 'titik', label: 'Titik (format: nilai:label, nilai:label)', type: 'text', def: '3:A' },
    ],
    venn: [
      { key: 'a', label: 'Label A', type: 'text', def: 'A' },
      { key: 'b', label: 'Label B', type: 'text', def: 'B' },
      { key: 'c', label: 'Label C (kosongkan utk 2 himpunan)', type: 'text', def: '' },
      { key: 'onlyA', label: 'Hanya A', type: 'number', def: 5 },
      { key: 'onlyB', label: 'Hanya B', type: 'number', def: 4 },
      { key: 'onlyC', label: 'Hanya C', type: 'number', def: 0 },
      { key: 'ab', label: 'A ∩ B', type: 'number', def: 2 },
      { key: 'ac', label: 'A ∩ C', type: 'number', def: 0 },
      { key: 'bc', label: 'B ∩ C', type: 'number', def: 0 },
      { key: 'abc', label: 'A ∩ B ∩ C', type: 'number', def: 0 },
      { key: 's', label: 'Semesta (S)', type: 'text', def: '' },
    ],
    statistik: [
      {
        key: 'tipe', label: 'Tipe', type: 'select', def: 'batang',
        options: [['batang', 'Diagram Batang'], ['lingkaran', 'Diagram Lingkaran'], ['garis', 'Diagram Garis']],
      },
      { key: 'label', label: 'Kategori (pisah koma)', type: 'text', def: 'Sen,Sel,Rab,Kam,Jum' },
      { key: 'data', label: 'Nilai (pisah koma)', type: 'text', def: '10,15,8,12,20' },
    ],
    pohonfaktor: [
      { key: 'n', label: 'Bilangan', type: 'number', def: 60 },
      {
        key: 'jawaban', label: 'Tampilan', type: 'select', def: 'kosong',
        options: [['kosong', 'Kosong (untuk diisi siswa)'], ['lengkap', 'Lengkap (kunci jawaban)']],
      },
    ],
    tabel: [
      { key: 'judul', label: 'Judul tabel (opsional)', type: 'text', def: '' },
      { key: 'header', label: 'Header kolom (pisah koma)', type: 'text', def: 'Interval,Frekuensi' },
      {
        key: 'baris', label: 'Baris data (satu baris teks = satu baris tabel, pisah kolom dengan koma)',
        type: 'textarea', def: '60-69,5\n70-79,8\n80-89,12\n90-100,5',
      },
    ],
    piktogram: [
      {
        key: 'simbol', label: 'Simbol', type: 'select', def: 'bintang',
        options: [
          ['bintang', 'Bintang'], ['apel', 'Buah/Apel'], ['lingkaran', 'Lingkaran'], ['kotak', 'Kotak'],
          ['segitiga', 'Segitiga'], ['hati', 'Hati'], ['orang', 'Orang'], ['buku', 'Buku'],
        ],
      },
      { key: 'skala', label: 'Skala (1 simbol = berapa satuan)', type: 'number', def: 5 },
      { key: 'label', label: 'Kategori (pisah koma)', type: 'text', def: 'Senin,Selasa,Rabu' },
      { key: 'data', label: 'Nilai (pisah koma)', type: 'text', def: '15,10,22' },
      { key: 'satuan', label: 'Satuan (opsional, mis. buah)', type: 'text', def: '' },
    ],
    bangunruang: [
      {
        key: 'bentuk', label: 'Bentuk', type: 'select', def: 'kubus',
        options: [
          ['kubus', 'Kubus'], ['balok', 'Balok'], ['tabung', 'Tabung'], ['kerucut', 'Kerucut'],
          ['bola', 'Bola'], ['limas-segiempat', 'Limas Segiempat'], ['prisma-segitiga', 'Prisma Segitiga'],
        ],
      },
    ],
    sudut: [
      {
        key: 'mode', label: 'Jenis', type: 'select', def: 'polygon',
        options: [['polygon', 'Sudut pada Bangun Datar'], ['sejajar', 'Garis Sejajar + Transversal']],
      },
    ],
    lewis: [
      {
        key: 'molekul', label: 'Molekul', type: 'select', def: 'h2o',
        options: [
          ['h2o', 'H₂O (air)'], ['co2', 'CO₂ (karbon dioksida)'], ['nh3', 'NH₃ (amonia)'],
          ['ch4', 'CH₄ (metana)'], ['o2', 'O₂ (oksigen)'], ['n2', 'N₂ (nitrogen)'],
          ['hcl', 'HCl (asam klorida)'], ['co', 'CO (karbon monoksida)'], ['ccl4', 'CCl₄ (karbon tetraklorida)'],
          ['c2h4', 'C₂H₄ (etena)'], ['ch2o', 'CH₂O (formaldehida)'],
          ['nacl', 'NaCl (ikatan ion)'], ['mgo', 'MgO (ikatan ion)'],
        ],
      },
    ],
    hidrokarbon: [
      { key: 'rantai', label: 'Jumlah atom C dalam rantai utama', type: 'number', def: 4 },
      {
        key: 'ikatan', label: 'Ikatan rangkap (format: posisi:jenis, contoh 2:2 = ikatan rangkap 2 setelah C ke-2)',
        type: 'text', def: '',
      },
      {
        key: 'cabang', label: 'Cabang gugus (format: posisi:label, contoh 3:CH3)',
        type: 'text', def: '',
      },
    ],
    gaya: [
      { key: 'objek', label: 'Nama Benda', type: 'text', def: 'Balok' },
      {
        key: 'gaya', label: 'Gaya (satu baris = satu gaya: nama:besar:sudut° — 0°=kanan, 90°=atas, 180°=kiri, 270°=bawah)',
        type: 'textarea', def: 'W:20:270\nN:20:90\nF:15:0',
      },
      { key: 'sudutBidang', label: 'Kemiringan bidang (derajat, kosongkan untuk permukaan datar)', type: 'number', def: '' },
    ],
    rantaimakanan: [
      { key: 'organisme', label: 'Urutan organisme (pisah koma, dari produsen)', type: 'text', def: 'Rumput,Belalang,Katak,Ular,Elang' },
    ],
    bentukmolekul: [
      {
        key: 'tipe', label: 'Tipe Domain Elektron (VSEPR)', type: 'select', def: 'ax4',
        options: [
          ['ax2', 'AX₂ — Linear'],
          ['ax2e1', 'AX₂E — Bentuk V (≈120°)'],
          ['ax2e2', 'AX₂E₂ — Bentuk V (≈104,5°)'],
          ['ax3', 'AX₃ — Segitiga Datar'],
          ['ax3e1', 'AX₃E — Piramida Trigonal'],
          ['ax3e2', 'AX₃E₂ — Bentuk T'],
          ['ax4', 'AX₄ — Tetrahedral'],
          ['ax4e1', 'AX₄E — Jungkat-jungkit (See-saw)'],
          ['ax4e2', 'AX₄E₂ — Segiempat Datar'],
          ['ax5', 'AX₅ — Bipiramida Trigonal'],
          ['ax5e1', 'AX₅E — Piramida Segiempat'],
          ['ax6', 'AX₆ — Oktahedral'],
        ],
      },
      { key: 'nama', label: 'Nama/rumus molekul (opsional, mis. H2O)', type: 'text', def: '' },
      { key: 'pusat', label: 'Label atom pusat', type: 'text', def: 'A' },
      { key: 'ikatan', label: 'Label atom terikat', type: 'text', def: 'X' },
    ],
    sel: [
      {
        key: 'tipe', label: 'Jenis Sel', type: 'select', def: 'hewan',
        options: [['hewan', 'Sel Hewan'], ['tumbuhan', 'Sel Tumbuhan']],
      },
      {
        key: 'label', label: 'Tampilan', type: 'select', def: 'ya',
        options: [['ya', 'Dengan label bagian sel'], ['tidak', 'Tanpa label (untuk diisi siswa)']],
      },
    ],
    gambar: [
      { key: 'id', label: 'Gambar tersimpan', type: 'imageselect', def: '' },
      { key: 'alt', label: 'Keterangan alternatif (opsional)', type: 'text', def: '' },
    ],
    figur: [
      { key: 'nomor', label: 'Nomor gambar (kosongkan untuk penomoran otomatis)', type: 'text', def: '' },
      { key: 'judul', label: 'Judul figur (opsional)', type: 'text', def: '' },
      // MUST stay the last field of this type: everything after "panel=" is
      // read verbatim by renderDiagramTag, semicolons included, so any
      // parameter placed after it would be swallowed into the panel list.
      {
        key: 'panel', label: 'Panel (satu baris = satu diagram, tanpa tanda [[ ]])',
        type: 'textarea', joiner: ' // ',
        def: 'bangun: bentuk=persegi; sisi=5\ngrafik: f1=x^2-4; xmin=-4; xmax=4',
      },
    ],
    kertasgrafik: [
      { key: 'judul', label: 'Judul (opsional)', type: 'text', def: '' },
      { key: 'xmin', label: 'x min', type: 'number', def: 0 },
      { key: 'xmax', label: 'x max', type: 'number', def: 10 },
      { key: 'ymin', label: 'y min', type: 'number', def: 0 },
      { key: 'ymax', label: 'y max', type: 'number', def: 20 },
      { key: 'sumbux', label: 'Nama + satuan sumbu x', type: 'text', def: 'Waktu (s)' },
      { key: 'sumbuy', label: 'Nama + satuan sumbu y', type: 'text', def: 'Jarak (m)' },
      { key: 'kotak', label: 'Nilai per kotak besar sumbu x (kosongkan = otomatis)', type: 'number', def: '' },
      { key: 'kotaky', label: 'Nilai per kotak besar sumbu y (kosongkan = otomatis)', type: 'number', def: '' },
      { key: 'subkotak', label: 'Kotak kecil per kotak besar', type: 'number', def: 5 },
      { key: 'titik', label: 'Titik yang sudah diplot (x:y, pisah koma — kosongkan agar siswa memplot sendiri)', type: 'text', def: '' },
    ],
    tabelkosong: [
      { key: 'judul', label: 'Judul tabel (opsional)', type: 'text', def: '' },
      { key: 'header', label: 'Header kolom (pisah koma)', type: 'text', def: 'Percobaan,Massa (g),Waktu (s)' },
      { key: 'baris', label: 'Jumlah baris kosong', type: 'number', def: 5 },
      { key: 'tinggi', label: 'Tinggi baris (pt)', type: 'number', def: 20 },
    ],
    garisjawab: [
      { key: 'judul', label: 'Judul (opsional, mis. "Jawaban:")', type: 'text', def: '' },
      { key: 'baris', label: 'Jumlah garis', type: 'number', def: 4 },
      { key: 'spasi', label: 'Jarak antar garis (pt)', type: 'number', def: 18 },
    ],
  };

  // Applied on top of any SVG diagram. Coordinates are a percentage of the
  // figure box (0-100, origin top-left) — see applyAnnotations in
  // diagrams.js for why percentages rather than each renderer's own units.
  const ANNOTATION_FIELDS = [
    { key: 'teks', label: 'Label teks — "30,20:Sisi miring" (x,y dalam %), satu per baris', type: 'textarea', def: '' },
    { key: 'panah', label: 'Panah — "10,10>40,40:Keterangan" (dari>ke, dalam %), satu per baris', type: 'textarea', def: '' },
    { key: 'ukuran', label: 'Garis ukuran — "20,90>80,90:8 cm", satu per baris', type: 'textarea', def: '' },
  ];

  // Types rendered as HTML rather than SVG: no annotation overlay is
  // possible on them (there is no viewBox to place percentages against).
  const HTML_TYPES = ['tabel', 'tabelkosong', 'garisjawab', 'gambar', 'figur'];
  // "figur" sizes itself from the panels inside it, and its panel list must
  // remain the final parameter — so no trailing width field for it.
  const NO_SIZE_TYPES = ['figur'];

  const GEOMETRY_EXTRA_FIELDS = {
    'segitiga-sembarang': [
      { key: 'a', label: 'Sisi a', type: 'number', def: 5 },
      { key: 'b', label: 'Sisi b', type: 'number', def: 6 },
      { key: 'c', label: 'Sisi c', type: 'number', def: 7 },
    ],
    'segitiga-siku': [
      { key: 'alas', label: 'Alas', type: 'number', def: 6 },
      { key: 'tinggi', label: 'Tinggi', type: 'number', def: 4 },
    ],
    persegi: [{ key: 'sisi', label: 'Sisi', type: 'number', def: 5 }],
    'persegi-panjang': [
      { key: 'panjang', label: 'Panjang', type: 'number', def: 8 },
      { key: 'lebar', label: 'Lebar', type: 'number', def: 5 },
    ],
    trapesium: [
      { key: 'atas', label: 'Sisi Atas', type: 'number', def: 4 },
      { key: 'bawah', label: 'Sisi Bawah', type: 'number', def: 8 },
      { key: 'tinggi', label: 'Tinggi', type: 'number', def: 5 },
    ],
    lingkaran: [{ key: 'jari', label: 'Jari-jari', type: 'number', def: 4 }],
    'setengah-lingkaran': [{ key: 'jari', label: 'Jari-jari', type: 'number', def: 4 }],
    gabungan: [
      {
        key: 'bagian',
        label: 'Bagian bentuk (satu baris = satu bentuk: nama:param=nilai,param=nilai,x=posisi,y=posisi)',
        type: 'textarea',
        def: 'persegi-panjang:panjang=10,lebar=6,x=0,y=0\nsetengah-lingkaran:jari=5,x=5,y=6',
      },
    ],
  };

  const SOLID_EXTRA_FIELDS = {
    kubus: [{ key: 'sisi', label: 'Sisi', type: 'number', def: 6 }],
    balok: [
      { key: 'panjang', label: 'Panjang', type: 'number', def: 8 },
      { key: 'lebar', label: 'Lebar', type: 'number', def: 5 },
      { key: 'tinggi', label: 'Tinggi', type: 'number', def: 4 },
    ],
    tabung: [
      { key: 'jari', label: 'Jari-jari', type: 'number', def: 4 },
      { key: 'tinggi', label: 'Tinggi', type: 'number', def: 8 },
    ],
    kerucut: [
      { key: 'jari', label: 'Jari-jari', type: 'number', def: 4 },
      { key: 'tinggi', label: 'Tinggi', type: 'number', def: 8 },
    ],
    bola: [{ key: 'jari', label: 'Jari-jari', type: 'number', def: 5 }],
    'limas-segiempat': [
      { key: 'alas', label: 'Sisi Alas', type: 'number', def: 6 },
      { key: 'tinggi', label: 'Tinggi', type: 'number', def: 8 },
    ],
    'prisma-segitiga': [
      { key: 'alas', label: 'Alas Segitiga', type: 'number', def: 6 },
      { key: 'tinggi', label: 'Tinggi Segitiga', type: 'number', def: 5 },
      { key: 'panjang', label: 'Panjang Prisma', type: 'number', def: 8 },
    ],
  };

  const ANGLE_EXTRA_FIELDS = {
    polygon: [
      { key: 'sisi', label: 'Jumlah Sisi', type: 'number', def: 4 },
      { key: 'label', label: 'Sudut (format: A:80,B:100,...)', type: 'text', def: 'A:80,B:100,C:75,D:105' },
    ],
    sejajar: [
      {
        key: 'label', label: 'Sudut (format posisi:nilai, posisi 1-8, contoh: 1:70,3:70,5:70)',
        type: 'text', def: '1:70,3:70,5:70',
      },
    ],
  };

  const TRANSFORM_EXTRA_FIELDS = {
    translasi: [{ key: 'vektor', label: 'Vektor geser (dx,dy)', type: 'text', def: '3,2' }],
    refleksi: [
      { key: 'garis', label: 'Cermin (x-axis, y-axis, y=x, y=-x, atau x=k / y=k)', type: 'text', def: 'y=x' },
    ],
    rotasi: [
      { key: 'pusat', label: 'Pusat rotasi (x,y)', type: 'text', def: '0,0' },
      { key: 'sudut', label: 'Sudut (derajat)', type: 'number', def: 90 },
      {
        key: 'arah', label: 'Arah', type: 'select', def: 'berlawanan',
        options: [['berlawanan', 'Berlawanan jarum jam'], ['searah', 'Searah jarum jam']],
      },
    ],
    dilatasi: [
      { key: 'pusat', label: 'Pusat dilatasi (x,y)', type: 'text', def: '0,0' },
      { key: 'faktor', label: 'Faktor skala', type: 'number', def: 2 },
    ],
  };

  const CIRCUIT_EXTRA_FIELDS = {
    seri: [{ key: 'komponen', label: 'Komponen (format: nama:ohm, pisah koma)', type: 'text', def: 'R1:10,R2:20,R3:30' }],
    paralel: [{ key: 'komponen', label: 'Komponen (format: nama:ohm, pisah koma)', type: 'text', def: 'R1:10,R2:20,R3:30' }],
    campuran: [
      {
        key: 'susunan',
        label: 'Susunan ("+" = seri, "(a|b)" = grup paralel)',
        type: 'text', def: 'R1:10+(R2:20|R3:30)+R4:15',
      },
    ],
  };

  const FIELD_EXTRA_FIELDS = {
    kawat: [
      {
        key: 'arus', label: 'Arah arus', type: 'select', def: 'keluar',
        options: [['keluar', 'Keluar bidang (menuju pembaca)'], ['masuk', 'Masuk bidang (menjauhi pembaca)']],
      },
    ],
  };

  const LATTICE_EXTRA_FIELDS = {
    ionik: [{ key: 'formula', label: 'Rumus senyawa', type: 'text', def: 'NaCl' }],
    kovalen: [
      {
        key: 'bentuk', label: 'Bentuk jaringan', type: 'select', def: 'intan',
        options: [['intan', 'Intan (jaringan tetrahedral)'], ['grafit', 'Grafit (lapisan heksagonal)']],
      },
    ],
  };

  // Types whose remaining fields depend on the value of one earlier field:
  // { type: [controllingKey, specsKeyedByValue, markerAttribute, defaultValue] }.
  // Driven off one table so a new dependent type only needs an entry here,
  // not another branch in both buildFieldsUI() and onFieldChange().
  const CONDITIONAL_FIELDS = {
    bangun: ['bentuk', GEOMETRY_EXTRA_FIELDS, 'data-geo-extra', 'segitiga-sembarang'],
    bangunruang: ['bentuk', SOLID_EXTRA_FIELDS, 'data-solid-extra', 'kubus'],
    sudut: ['mode', ANGLE_EXTRA_FIELDS, 'data-angle-extra', 'polygon'],
    transformasi: ['jenis', TRANSFORM_EXTRA_FIELDS, 'data-transform-extra', 'translasi'],
    rangkaian: ['tipe', CIRCUIT_EXTRA_FIELDS, 'data-circuit-extra', 'seri'],
    medan: ['jenis', FIELD_EXTRA_FIELDS, 'data-field-extra', 'positif'],
    kisi: ['jenis', LATTICE_EXTRA_FIELDS, 'data-lattice-extra', 'ionik'],
  };

  // Menu label for every type the form can build, in the order they appear
  // in the dropdown (grouped by subject rather than alphabetically, since
  // that's how a teacher looks for them). Every key here must exist in
  // FIELD_SPECS — populateTypeSelect() skips any that doesn't.
  const TYPE_MENU = [
    ['Matematika', [
      ['grafik', 'Grafik Fungsi'],
      ['programlinear', 'Program Linear'],
      ['bangun', 'Bangun Datar'],
      ['bangunruang', 'Bangun Ruang (3D)'],
      ['sudut', 'Sudut / Garis Sejajar'],
      ['lingkaranteorema', 'Teorema Lingkaran'],
      ['jaring', 'Jaring-jaring Bangun Ruang'],
      ['pandangan', 'Pandangan Depan / Samping / Atas'],
      ['transformasi', 'Transformasi Geometri'],
      ['vektor', 'Vektor'],
      ['bearing', 'Bearing / Arah Mata Angin'],
      ['garisbilangan', 'Garis Bilangan'],
      ['venn', 'Diagram Venn'],
      ['pohonfaktor', 'Pohon Faktor'],
      ['pembagian', 'Pembagian Bersusun'],
      ['pohonpeluang', 'Pohon Peluang'],
    ]],
    ['Statistika & Data', [
      ['statistik', 'Diagram Batang / Lingkaran / Garis'],
      ['piktogram', 'Piktogram'],
      ['pencar', 'Diagram Pencar + Garis Terbaik'],
      ['histogram', 'Histogram (Densitas Frekuensi)'],
      ['batangdaun', 'Diagram Batang-Daun'],
      ['ogive', 'Ogive (Frekuensi Kumulatif)'],
      ['boxplot', 'Boxplot (Kotak-Garis)'],
      ['tabel', 'Tabel Data'],
    ]],
    ['Fisika', [
      ['gaya', 'Diagram Gaya (Free Body)'],
      ['rangkaian', 'Rangkaian Listrik'],
      ['gerak', 'Grafik Gerak (Kinematika)'],
      ['gelombang', 'Gelombang'],
      ['sinar', 'Diagram Sinar (Lensa)'],
      ['medan', 'Garis Medan Listrik / Magnet'],
    ]],
    ['Kimia', [
      ['lewis', 'Struktur Lewis'],
      ['bentukmolekul', 'Bentuk Molekul (VSEPR)'],
      ['hidrokarbon', 'Rantai Hidrokarbon'],
      ['kulitelektron', 'Kulit Elektron (Model Bohr)'],
      ['tingkatenergi', 'Diagram Tingkat Energi'],
      ['katalis', 'Energi Aktivasi + Katalis'],
      ['titrasi', 'Kurva Titrasi'],
      ['kisi', 'Struktur Kisi Kristal'],
      ['alatlab', 'Rangkaian Alat Laboratorium'],
    ]],
    ['Biologi', [
      ['sel', 'Sel Hewan / Tumbuhan'],
      ['rantaimakanan', 'Rantai Makanan'],
      ['piramida', 'Piramida Ekologi'],
      ['jaringmakanan', 'Jaring-jaring Makanan'],
      ['punnett', 'Kotak Punnett (Persilangan)'],
      ['kuncideterminasi', 'Kunci Determinasi'],
    ]],
    ['Gambar & Ruang Jawab', [
      ['gambar', 'Gambar Impor (foto / hasil pindai)'],
      ['figur', 'Figur Berpanel + Keterangan'],
      ['kertasgrafik', 'Kertas Grafik Kosong (untuk diplot siswa)'],
      ['tabelkosong', 'Tabel Kosong (untuk diisi siswa)'],
      ['garisjawab', 'Garis Jawaban Bergaris'],
    ]],
  ];

  function populateTypeSelect() {
    if (typeSelect.options.length) return;
    TYPE_MENU.forEach(([groupLabel, entries]) => {
      const group = document.createElement('optgroup');
      group.label = groupLabel;
      entries.forEach(([value, text]) => {
        if (!FIELD_SPECS[value]) return;
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        group.appendChild(opt);
      });
      if (group.children.length) typeSelect.appendChild(group);
    });
  }

  let savedSelectionStart = null;
  let savedSelectionEnd = null;

  function makeFieldRow(spec) {
    const wrap = document.createElement('div');
    wrap.className = 'field-item';
    const label = document.createElement('label');
    label.textContent = spec.label;
    wrap.appendChild(label);

    let input;
    if (spec.type === 'imageselect') {
      // Populated from the app's own image store so the teacher picks a
      // thumbnail's id from a list instead of remembering "g3".
      input = document.createElement('select');
      let store = {};
      try { store = JSON.parse(localStorage.getItem('exactWorksheetMaker.images') || '{}') || {}; } catch (e) { store = {}; }
      const ids = Object.keys(store).sort((a, b) => (store[a].addedAt || 0) - (store[b].addedAt || 0));
      if (!ids.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Belum ada gambar — impor dulu lewat "Sisipkan Gambar"';
        input.appendChild(opt);
      }
      ids.forEach((id) => {
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = id + ' — ' + (store[id].name || 'gambar');
        input.appendChild(opt);
      });
    } else if (spec.type === 'select') {
      input = document.createElement('select');
      spec.options.forEach(([value, text]) => {
        const opt = document.createElement('option');
        opt.value = value;
        opt.textContent = text;
        input.appendChild(opt);
      });
      input.value = spec.def;
    } else if (spec.type === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 4;
      input.value = spec.def;
    } else {
      input = document.createElement('input');
      input.type = spec.type;
      input.value = spec.def;
    }
    input.dataset.key = spec.key;
    if (spec.type === 'textarea') {
      input.dataset.multiline = '1';
      // Most textareas encode their rows with "|", but a figur's panel list
      // is separated by "//" — the row separator is per-field, not global.
      if (spec.joiner) input.dataset.joiner = spec.joiner;
    }
    input.addEventListener('input', updatePreview);
    input.addEventListener('change', onFieldChange);
    wrap.appendChild(input);
    return wrap;
  }

  function onFieldChange(e) {
    const cond = CONDITIONAL_FIELDS[typeSelect.value];
    if (cond && e.target.dataset.key === cond[0]) renderExtraFields(cond[1], cond[2], e.target.value);
    updatePreview();
  }

  function renderExtraFields(specMap, marker, key) {
    fieldsHost.querySelectorAll('[' + marker + ']').forEach((n) => n.remove());
    // Inserted before the "Lebar diagram" row rather than appended, so the
    // size field stays last no matter how many times the controlling
    // dropdown is changed — appending would push it above the new rows the
    // second time around.
    const sizeRow = fieldsHost.querySelector('[data-size-field]');
    (specMap[key] || []).forEach((spec) => {
      const row = makeFieldRow(spec);
      row.setAttribute(marker, '1');
      if (sizeRow) fieldsHost.insertBefore(row, sizeRow);
      else fieldsHost.appendChild(row);
    });
  }

  // Ukuran tampilan dipilih dari preset, bukan diketik dalam pt: guru
  // tinggal memilih "Penuh" untuk kertas grafik kosong yang akan diisi
  // siswa. "Penuh" ditulis 600pt — lebih lebar dari kolom mana pun, jadi
  // CSS (width:100%) yang membatasinya persis selebar kolom badan: ±250pt
  // di tata letak 2 kolom koran, ±530pt di lembar 1 kolom. Angka lain masih
  // bisa ditulis tangan di tag (lebar=…).
  const SIZE_OPTIONS = [
    ['', 'Standar (ikut slider "Ukuran diagram")'],
    ['160', 'Kecil — 160pt'],
    ['220', 'Sedang — 220pt'],
    ['300', 'Besar — 300pt'],
    ['380', 'Sangat besar — 380pt'],
    ['600', 'Penuh — selebar kolom']
  ];
  // Bangun datar/ruang memakai "lebar" sebagai ukuran benda (cm), bukan
  // ukuran tampilan; untuk mereka lebar tampilan bernama "lebargambar"
  // (lihat LEBAR_ADALAH_UKURAN di diagrams.js). Dulu isian ini tetap
  // menulis "lebar=" sehingga balok 12×9×8 tercetak 300pt × 9pt.
  const SIZE_KEY_IS_OBJECT = ['bangun', 'bangunruang', 'ruang'];
  // Kertas grafik kosong dibuat untuk diplot siswa: bawaannya langsung penuh.
  const SIZE_DEFAULT_FULL = ['kertasgrafik'];
  function sizeField(type) {
    return {
      key: SIZE_KEY_IS_OBJECT.indexOf(type) === -1 ? 'lebar' : 'lebargambar',
      label: 'Ukuran diagram di lembar',
      type: 'select',
      options: SIZE_OPTIONS,
      def: SIZE_DEFAULT_FULL.indexOf(type) === -1 ? '' : '600'
    };
  }

  function buildFieldsUI(type) {
    fieldsHost.innerHTML = '';
    (FIELD_SPECS[type] || []).forEach((spec) => fieldsHost.appendChild(makeFieldRow(spec)));
    if (NO_SIZE_TYPES.indexOf(type) === -1) {
      const sizeRow = makeFieldRow(sizeField(type));
      sizeRow.setAttribute('data-size-field', '1');
      fieldsHost.appendChild(sizeRow);
    }
    if (HTML_TYPES.indexOf(type) === -1) {
      const heading = document.createElement('label');
      heading.className = 'sublabel';
      heading.textContent = 'Anotasi (opsional)';
      fieldsHost.appendChild(heading);
      ANNOTATION_FIELDS.forEach((spec) => fieldsHost.appendChild(makeFieldRow(spec)));
    }
    const cond = CONDITIONAL_FIELDS[type];
    if (cond) renderExtraFields(cond[1], cond[2], cond[3]);
  }

  function getCurrentParams() {
    const params = {};
    fieldsHost.querySelectorAll('[data-key]').forEach((input) => {
      let val = input.value;
      // Textarea rows are typed one-per-line for readability, but the tag
      // syntax's row separator is "|" (newlines can't survive inside a
      // single "key=value;" pair), so convert here at the form/tag boundary.
      if (input.dataset.multiline) val = val.replace(/\r?\n/g, input.dataset.joiner || '|');
      if (val !== '' && val !== null && val !== undefined) params[input.dataset.key] = val;
    });
    return params;
  }

  function buildTagString() {
    const type = typeSelect.value;
    const params = getCurrentParams();
    const paramsStr = Object.keys(params).map((k) => `${k}=${params[k]}`).join('; ');
    return `[[${type}: ${paramsStr}]]`;
  }

  function updatePreview() {
    const tagContent = buildTagString().replace(/^\[\[/, '').replace(/\]\]$/, '');
    try {
      previewHost.innerHTML = renderDiagramTag(tagContent);
    } catch (err) {
      previewHost.innerHTML = `<span style="color:#b91c1c;font-size:12px;">${err.message}</span>`;
    }
  }

  function openModal() {
    // The textarea loses focus the moment the button is clicked, but its
    // selectionStart/End survive that — read here, before the modal's own
    // fields can take focus, so "Sisipkan" lands the tag exactly where the
    // teacher's cursor was sitting in the naskah.
    savedSelectionStart = rawInput.selectionStart;
    savedSelectionEnd = rawInput.selectionEnd;
    populateTypeSelect();
    buildFieldsUI(typeSelect.value);
    updatePreview();
    overlay.hidden = false;
  }

  function closeModal() {
    overlay.hidden = true;
  }

  function insertTagIntoTextarea(tag) {
    const start = savedSelectionStart != null ? savedSelectionStart : rawInput.value.length;
    const end = savedSelectionEnd != null ? savedSelectionEnd : rawInput.value.length;
    const before = rawInput.value.slice(0, start);
    const after = rawInput.value.slice(end);
    const needsLeadingSpace = before.length && !/\s$/.test(before);
    const insertion = (needsLeadingSpace ? ' ' : '') + tag + ' ';
    rawInput.value = before + insertion + after;
    const cursor = (before + insertion).length;
    rawInput.focus();
    rawInput.setSelectionRange(cursor, cursor);
  }

  populateTypeSelect();

  el('btnInsertDiagram').addEventListener('click', openModal);
  el('btnCloseModal').addEventListener('click', closeModal);
  el('btnCancelDiagram').addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeModal();
  });

  typeSelect.addEventListener('change', () => {
    buildFieldsUI(typeSelect.value);
    updatePreview();
  });

  el('btnConfirmDiagram').addEventListener('click', () => {
    insertTagIntoTextarea(buildTagString());
    closeModal();
    const renderBtn = el('btnRender');
    if (renderBtn) renderBtn.click();
  });
});
