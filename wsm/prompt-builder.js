// Built by "Buat Prompt AI" into a ready-made prompt for an external
// chatbot (Gemini by default) that spells out exactly the format this
// app's parser expects, so the reply can be pasted straight back in with
// "Tempel dari Clipboard" and render correctly the first time.
//
// Unlike the old one-size-fits-all template, this is assembled per
// request from the "Buat Prompt AI" modal: only the item types and
// diagram docs actually needed get included, since a full listing of
// every section format and all 16 diagram types (most never relevant to
// a given subject) made the prompt long enough that Gemini would
// sometimes truncate or drift from the format on longer worksheets.
//
// Shared between the browser UI (app.js, loaded via <script> before it —
// classic scripts share one top-level scope, so these declarations are
// visible there without any window.* assignment) and Node (default-prompt.js,
// the menu bar app's "Copy Prompt" action) via the module.exports below.
// One source of truth so both stay in sync.

// One line of syntax documentation per diagram type — pulled in selectively
// per subject below instead of always listing all of them.
const DIAGRAM_DOCS = {
  grafik: '   grafik        — grafik fungsi matematika, sampai 5 fungsi sekaligus dalam satu bidang kartesius (f1..f5, tiap fungsi otomatis dibedakan pakai pola garis putus-putus + legenda). Parameter tambahan: sumbux/sumbuy (nama+satuan sumbu), domain=f1:-2,3 (batasi jangkauan gambar satu kurva), arsir=f1:0,3 (arsir luas di bawah kurva antara dua nilai x), singgung=f1:2 (garis singgung di x=2 lengkap dengan segitiga gradien berlabel), asimtot=x=2,y=0 (garis putus-putus asimtot). Contoh: [[grafik: f1=x^2-4; xmin=-5; xmax=5; ymin=-6; ymax=12; sumbux=Waktu (s); arsir=f1:0,3; singgung=f1:2]]',
  programlinear: '   programlinear — daerah himpunan penyelesaian program linear, garis batas tiap pertidaksamaan digambar dan diberi nomor, daerah penyelesaian diarsir, titik pojok otomatis dihitung dan diberi label koordinat. Contoh: [[programlinear: pertidaksamaan=2x+y<=10,x+3y<=12,x>=0,y>=0; xmax=8; ymax=8]] (tiap pertidaksamaan pisah koma, hanya suku x/y berkoefisien bulat/desimal + operator <=,>=,<,>)',
  transformasi: '   transformasi  — transformasi geometri pada grid koordinat: bentuk asli (garis penuh) dan bayangan (garis putus-putus, dilabel tanda aksen \') digambar sekaligus. jenis salah satu: translasi (perlu vektor=dx,dy) / refleksi (perlu garis=x-axis,y-axis,y=x,y=-x, atau x=k / y=k) / rotasi (perlu pusat=x,y; sudut=derajat; arah=berlawanan/searah jarum jam) / dilatasi (perlu pusat=x,y; faktor=skala). Contoh: [[transformasi: titik=A:1:1,B:4:1,C:1:5; jenis=rotasi; pusat=0,0; sudut=90; arah=berlawanan]]',
  pohonpeluang: '   pohonpeluang  — diagram pohon peluang (probability tree), cabang berlabel pecahan, peluang gabungan tiap ujung cabang otomatis dihitung (perkalian). level1=Kejadian:pecahan,... (pisah koma), level2 sama formatnya untuk cabang tahap kedua (opsional level3 untuk 3 tahap). Contoh: [[pohonpeluang: level1=Merah:2/5,Biru:3/5; level2=Merah:2/5,Biru:3/5]]',
  vektor: '   vektor        — diagram vektor pada grid koordinat, dari titik asal atau berantai (ujung satu jadi pangkal berikutnya), resultan (jumlah vektor) otomatis digambar garis merah putus-putus. v=nama:dx,dy|nama:dx,dy|... (pisah "|"). Contoh: [[vektor: v=a:4,2|b:-2,3]] (resultan=tidak untuk sembunyikan resultan)',
  bearing: '   bearing       — diagram arah mata angin (bearing), tiap kaki perjalanan diberi garis utara putus-putus + busur sudut dari utara + jarak berlabel. jalur=Label:sudutBearing:jarak|... (pisah "|", sudut bearing 0-360 searah jarum jam dari utara). Contoh: [[bearing: jalur=B:065:8|C:140:5]]',
  ogive: '   ogive         — kurva frekuensi kumulatif (cumulative frequency curve), kuartil Q1/Q2/Q3 otomatis dihitung dan ditandai garis putus-putus. Pakai data=daftar_nilai_mentah (dipisah koma, diurutkan otomatis) ATAU batas=batas_atas_kelas,...; kumulatif=frekuensi_kumulatif,... untuk data berkelompok. Contoh: [[ogive: data=12,15,15,18,20,22,25,28,30,35]]',
  boxplot: '   boxplot       — diagram kotak-garis (box-and-whisker), lima serangkai (min,Q1,median,Q3,max) diberi label di atas kotak. Pakai data=daftar_nilai_mentah (kuartil dihitung otomatis) ATAU min=...;q1=...;median=...;q3=...;max=... langsung. Contoh: [[boxplot: data=12,15,15,18,20,22,25,28,30,35]]',
  bangun: '   bangun        — bangun datar. bentuk salah satu: segitiga-sembarang (param a,b,c) / segitiga-siku (alas,tinggi) / persegi (sisi) / persegi-panjang (panjang,lebar) / trapesium (atas,bawah,tinggi) / lingkaran (jari) / setengah-lingkaran (jari). Contoh: [[bangun: bentuk=persegi; sisi=5]]',
  bangunruang: '   bangunruang   — bangun ruang 3D. bentuk salah satu: kubus (sisi) / balok (panjang,lebar,tinggi) / tabung (jari,tinggi) / kerucut (jari,tinggi) / bola (jari) / limas-segiempat (alas,tinggi) / prisma-segitiga (alas,tinggi,panjang). Contoh: [[bangunruang: bentuk=tabung; jari=4; tinggi=8]]',
  garisbilangan: '   garisbilangan — garis bilangan dengan titik berlabel. Contoh: [[garisbilangan: min=-10; max=10; step=1; titik=3:A,-5:B]]',
  venn: '   venn          — diagram Venn 2 atau 3 himpunan, selalu digambar di dalam kotak himpunan semesta S (opsional custom nama lewat s=...). Contoh: [[venn: a=A; b=B; onlyA=5; onlyB=4; ab=2]] (tambah c=... dan onlyC=...,ac=...,bc=...,abc=... untuk 3 himpunan)',
  statistik: '   statistik     — grafik batang/diagram lingkaran(pie chart)/garis. tipe=lingkaran menomori tiap juring dan menaruh legenda nama+persentase di sisi kanan. Contoh: [[statistik: tipe=lingkaran; label=Bola,Basket,Renang; data=12,8,5]]',
  pohonfaktor: '   pohonfaktor   — pohon faktor bilangan. Contoh: [[pohonfaktor: n=60; jawaban=kosong]] (jawaban=kosong untuk diisi siswa, atau lengkap untuk kunci jawaban)',
  pembagian: '   pembagian     — pembagian bersusun panjang (long division) langkah demi langkah, dengan kotak kosong bertitik-titik yang harus diisi siswa. Contoh: [[pembagian: dividen=968; pembagi=4; jawaban=kosong]] (jawaban=kosong untuk diisi siswa, atau lengkap untuk kunci jawaban lengkap semua langkah)',
  piktogram: '   piktogram     — piktogram/diagram gambar berulang. Contoh: [[piktogram: simbol=bintang; skala=5; label=Sen,Sel; data=15,10]]',
  sudut: '   sudut         — sudut bangun datar atau garis sejajar+transversal. Contoh: [[sudut: mode=polygon; sisi=4; label=A:80,B:100,C:75,D:105]] (mode=sejajar untuk garis sejajar)',
  tabel: '   tabel         — tabel data. Baris dipisah "|", kolom dalam satu baris dipisah ",". Contoh: [[tabel: judul=Data Nilai; header=Nama,Nilai; baris=Andi,80|Budi,90]]',
  lewis: '   lewis         — struktur Lewis (kimia). molekul salah satu: h2o, co2, nh3, ch4, o2, n2, hcl, co, ccl4, c2h4, ch2o, nacl, mgo. Contoh: [[lewis: molekul=nh3]]',
  hidrokarbon: '   hidrokarbon   — rantai karbon (kimia). Contoh: [[hidrokarbon: rantai=4; ikatan=2:2]] (rantai=jumlah atom C pada rantai utama, ikatan=posisi:jenis ikatan rangkap, opsional)',
  bentukmolekul: '   bentukmolekul — bentuk molekul VSEPR (kimia). tipe salah satu: ax2, ax2e1, ax2e2, ax3, ax3e1, ax3e2, ax4, ax4e1, ax4e2, ax5, ax5e1, ax6. Contoh: [[bentukmolekul: tipe=ax4e2; nama=XeF4]]',
  gaya: '   gaya          — diagram gaya/free body diagram (Hukum Newton, fisika). Setiap gaya format nama:besar:sudut (0°=kanan, 90°=atas, 180°=kiri, 270°=bawah), beberapa gaya dipisah "|". Tambahkan sudutBidang=20 untuk memiringkan permukaan (bidang miring/inclined plane). Contoh: [[gaya: objek=Balok; gaya=W:20:270|N:20:90|F:15:0; sudutBidang=20]]',
  rangkaian: '   rangkaian     — rangkaian listrik seri/paralel/campuran (fisika), simbol resistor kotak IEC + simbol sumber tegangan. tipe=seri atau paralel pakai komponen=nama:ohm,... (pisah koma). Untuk campuran (gabungan seri+paralel) pakai susunan=nama:ohm+(nama:ohm|nama:ohm)+... dengan "+" = seri dan "(a|b)" = grup paralel. Contoh seri: [[rangkaian: tipe=seri; komponen=R1:10,R2:20,R3:30; sumber=12]] — Contoh campuran: [[rangkaian: tipe=campuran; susunan=R1:10+(R2:20|R3:30)+R4:15; sumber=12]]. Selain resistor, komponen boleh ditulis nama:jenis — jenis salah satu: lampu, saklar, saklar-tutup, amperemeter, voltmeter, geser (hambatan geser), termistor, ldr, dioda, led, kapasitor, motor, sekring; tambahkan nilai di belakangnya bila perlu (Rv:geser:20). Voltmeter dipasang paralel dengan komponen yang diukur lewat grup kurung, mis. susunan=R1:10+(R2:20|V1:voltmeter). Contoh: [[rangkaian: tipe=seri; komponen=R1:10,A1:amperemeter,S1:saklar,L1:lampu; sumber=12]]',
  sinar: '   sinar         — diagram sinar (ray diagram) lensa cembung/cekung, sinar utama otomatis ditelusuri dari puncak objek untuk menentukan bayangan (nyata/maya, tegak/terbalik). alat=cembung atau cekung; f=jarak fokus; objek_jarak=jarak benda ke lensa; objek_tinggi=tinggi benda. Contoh: [[sinar: alat=cembung; f=3; objek_jarak=6; objek_tinggi=2]]',
  gerak: '   gerak         — grafik gerak kinematika (jarak-waktu atau kecepatan-waktu) dari titik-titik bersambung garis lurus, luas di bawah kurva diarsir otomatis dan gradien tiap segmen dilabel. tipe=jarak-waktu atau kecepatan-waktu; titik=waktu:nilai,... (pisah koma). Contoh: [[gerak: tipe=kecepatan-waktu; titik=0:0,2:10,5:10,8:0]] (arsir=tidak atau gradien=tidak untuk menyembunyikan salah satunya)',
  gelombang: '   gelombang     — diagram gelombang transversal (kurva sinus, amplitudo+panjang gelombang berlabel) atau longitudinal (garis rapatan/renggangan). jenis=transversal atau longitudinal; amplitudo, panjanggelombang, jumlah (banyak gelombang berurutan). Contoh: [[gelombang: jenis=transversal; amplitudo=20; panjanggelombang=60; jumlah=2]]',
  medan: '   medan         — garis medan listrik/magnet. jenis=positif atau negatif (garis medan radial dari muatan titik) / kawat (lingkaran konsentris di sekitar kawat berarus, perlu arus=keluar atau masuk) / solenoida (garis medan sejajar dalam kumparan). Contoh: [[medan: jenis=positif]]',
  rantaimakanan: '   rantaimakanan — rantai makanan (biologi), organisme dipisah koma dari produsen. Contoh: [[rantaimakanan: organisme=Rumput,Belalang,Katak,Ular,Elang]]',
  tingkatenergi: '   tingkatenergi — diagram tingkat energi (kimia: entalpi reaksi eksoterm/endoterm, energi aktivasi, konfigurasi elektron, dsb). level=Nama:nilai,... (pisah koma, tinggi tiap "anak tangga" otomatis proporsional terhadap nilai), tiap pasangan level berurutan otomatis dihubungkan panah putus-putus berlabel selisih (ΔE). Contoh 2 level (entalpi): [[tingkatenergi: level=Reaktan:0,Produk:-50; satuan=kJ/mol]] — Contoh 3 level (dengan energi aktivasi): [[tingkatenergi: level=Reaktan:0,Kompleks Aktif:80,Produk:-40; satuan=kJ/mol]]',
  kulitelektron: '   kulitelektron — model atom Bohr, kulit elektron K/L/M/N digambar sebagai lingkaran konsentris dengan elektron berlabel titik. nomor=nomor atom (pengisian kulit 2,8,8,18 dihitung otomatis, atau override manual lewat kulit=2,8,1). Contoh: [[kulitelektron: unsur=Na; nomor=11]]',
  titrasi: '   titrasi       — kurva titrasi asam-basa (pH vs volume titran), bentuk kurva menyesuaikan jenis, titik ekuivalen ditandai garis putus-putus. jenis salah satu: kuat-kuat, lemah-kuat, kuat-lemah, lemah-lemah; volume_awal=volume larutan yang dititrasi (mL). Contoh: [[titrasi: jenis=kuat-kuat; volume_awal=25]]',
  katalis: '   katalis       — perluasan diagram tingkat energi: dua kurva jalur reaksi sekaligus (dengan dan tanpa katalis) dari Reaktan ke Produk, tiap puncak diberi label Ea. reaktan, produk, ea_tanpa, ea_dengan (semua dalam satuan yang sama, mis. kJ/mol). Contoh: [[katalis: reaktan=0; produk=-40; ea_tanpa=80; ea_dengan=40; satuan=kJ/mol]]',
  kisi: '   kisi          — struktur kristal/kisi (kimia). jenis=ionik (kisi kubus ion berselang-seling, perlu formula=NaCl dst) atau kovalen (kisi raksasa, perlu bentuk=intan untuk jaringan tetrahedral atau bentuk=grafit untuk lapisan heksagonal). Contoh: [[kisi: jenis=ionik; formula=NaCl]]',
  piramida: '   piramida      — piramida ekologi (biologi) bertingkat, lebar tiap tingkat proporsional terhadap nilainya (skala logaritmik karena nilai antar tingkat trofik biasa berbeda jauh). tingkat=Nama:nilai,... berurutan dari produsen di dasar; tipe=jumlah/biomassa/energi (label saja). Contoh: [[piramida: tingkat=Produsen:500,Konsumen I:50,Konsumen II:5,Konsumen III:1; tipe=jumlah]]',
  sel: '   sel           — sel hewan/tumbuhan berlabel (biologi). Contoh: [[sel: tipe=hewan; label=ya]] (tipe=hewan atau tumbuhan; label=ya untuk berlabel, tidak untuk kosong diisi siswa)',
  pencar: '   pencar        — diagram pencar (scatter) + garis lurus terbaik yang dihitung otomatis dengan metode kuadrat terkecil; titik digambar sebagai tanda silang sesuai konvensi penilaian. x= dan y= (pisah koma, jumlahnya sama), sumbux/sumbuy untuk nama+satuan sumbu, galat= untuk batang galat (satu angka berlaku untuk semua titik, atau satu angka per titik), rerata=ya untuk menandai titik rata-rata yang wajib dilewati garis, garis=tidak kalau siswa yang harus menarik garisnya. Contoh: [[pencar: x=1,2,3,4,5; y=2.1,3.9,6.2,7.8,10.1; sumbux=Massa (g); sumbuy=Panjang (cm); galat=0.3]]',
  histogram: '   histogram     — histogram dengan LEBAR KELAS BOLEH TIDAK SAMA: sumbu tegaknya densitas frekuensi (frekuensi dibagi lebar kelas), sehingga LUAS batang yang mewakili frekuensi, bukan tingginya. batas= berisi n+1 batas kelas, frekuensi= berisi n frekuensi. Contoh: [[histogram: batas=0,10,20,50; frekuensi=5,8,12]]',
  batangdaun: '   batangdaun    — diagram batang-daun (stem-and-leaf) lengkap dengan baris kunci; batang kosong di antara batang terisi tetap ditampilkan supaya bentuk sebarannya jujur. satuan=10 berarti batang mewakili puluhan. Contoh: [[batangdaun: data=12,15,15,21,23,34,38,41; satuan=10]]',
  alatlab: '   alatlab       — rangkaian alat laboratorium bergaris penunjuk nama bagian. jenis salah satu: destilasi / titrasi / elektrolisis / tabunggas (tabung suntik gas) / penyaringan / pemanasan (kaki tiga + pembakar Bunsen). Pakai label=tidak untuk menghilangkan semua nama bagian, yaitu bentuk soal "sebutkan nama bagian alat berikut". Contoh: [[alatlab: jenis=titrasi]]',
  lingkaranteorema: '   lingkaranteorema — diagram teorema lingkaran lengkap dengan busur penanda sudut dan tanda siku-siku. jenis salah satu: sudut-pusat (sudut pusat = 2x sudut keliling, boleh tambah sudut=110) / sudut-keliling (sudut pada busur yang sama) / semilingkaran (sudut pada setengah lingkaran = 90) / segiempat-talibusur / tangen-jari (garis singgung tegak lurus jari-jari) / dua-tangen. Contoh: [[lingkaranteorema: jenis=semilingkaran]]',
  jaring: '   jaring        — jaring-jaring (net) bangun ruang yang dibentangkan. bentuk salah satu: kubus / balok / prisma-segitiga / limas-segiempat / tabung / kerucut. Contoh: [[jaring: bentuk=limas-segiempat]]',
  pandangan: '   pandangan     — pandangan depan, samping, dan atas sebuah bangun ruang, masing-masing dalam kotaknya sendiri. bentuk salah satu: kubus / balok / tabung / kerucut / limas-segiempat / prisma-segitiga / bola. Pakai jawaban=kosong untuk menampilkan tiga kotak kosong yang harus digambar siswa. Contoh: [[pandangan: bentuk=kerucut; jawaban=kosong]]',
  punnett: '   punnett       — kotak Punnett persilangan genetika; gamet, isi kotak, rasio genotipe dan rasio fenotipe semuanya dihitung otomatis. Mendukung monohibrid (Aa x Aa, kotak 2x2) maupun dihibrid (AaBb x AaBb, kotak 4x4). Pakai jawaban=kosong agar kotaknya kosong untuk diisi siswa. Contoh: [[punnett: induk1=AaBb; induk2=AaBb]]',
  kuncideterminasi: '   kuncideterminasi — kunci determinasi dikotomi. langkah= berisi cabang-cabang dipisah "|", tiap cabang format nomor:ciri:hasil. Hasil berupa nama organisme, atau berupa ANGKA yang berarti "lanjut ke langkah nomor itu". Contoh: [[kuncideterminasi: langkah=1a:Berdaun jarum:Pinus|1b:Berdaun lebar:2|2a:Bertulang menjari:Pepaya|2b:Bertulang menyirip:Mangga]]',
  jaringmakanan: '   jaringmakanan — jaring-jaring makanan (food web, bukan rantai lurus): tingkat trofik tiap organisme dihitung otomatis dari hubungan yang diberikan, produsen di dasar, panah mengikuti arah aliran energi (dimakan menuju pemakan). hubungan= berisi pasangan "dimakan>pemakan" dipisah koma. Contoh: [[jaringmakanan: hubungan=Rumput>Belalang, Rumput>Tikus, Belalang>Katak, Tikus>Ular, Katak>Ular, Ular>Elang]]',
  figur: '   figur         — membungkus satu atau beberapa diagram jadi SATU gambar bernomor berketerangan, seperti "Fig. 2.1" pada naskah ujian internasional; panel kedua dan seterusnya otomatis dilabeli (a), (b), (c) dan ditata berdampingan. Rujuk dari kalimat soal ("Gambar 1 menunjukkan..."). PENTING: parameter "panel=" WAJIB jadi parameter TERAKHIR, isinya satu atau beberapa tag diagram biasa TANPA tanda kurung siku, dipisah "//". Nomor boleh dikosongkan supaya dinomori otomatis urut. Contoh: [[figur: judul=Rangkaian percobaan; panel=rangkaian: tipe=seri; komponen=R1:10,R2:20; sumber=12 // gerak: tipe=kecepatan-waktu; titik=0:0,2:10,5:10]]',
  kertasgrafik: '   kertasgrafik  — KERTAS GRAFIK KOSONG berskala untuk DIPLOT SISWA SENDIRI (bukan grafik jadi): kotak besar + kotak kecil seperti kertas milimeter, sumbu berlabel nama+satuan. Pakai untuk perintah "plot titik-titik berikut lalu tarik garis lurus terbaik". Kosongkan "titik" agar siswa memplot semuanya, atau isi sebagian sebagai contoh. Contoh: [[kertasgrafik: xmin=0; xmax=10; ymin=0; ymax=20; sumbux=Waktu (s); sumbuy=Jarak (m); subkotak=5]]',
  tabelkosong: '   tabelkosong   — tabel berheader dengan baris KOSONG untuk diisi siswa (tabel hasil percobaan, tabel pengamatan). Contoh: [[tabelkosong: header=Percobaan,Massa (g),Waktu (s); baris=5]]',
  garisjawab: '   garisjawab    — garis-garis bertitik sebagai ruang menulis jawaban uraian; banyak garis disesuaikan bobot nilai soal (kira-kira 2 garis per poin nilai). Contoh: [[garisjawab: baris=6]]',
  anotasi: '   (anotasi)     — BUKAN jenis diagram tersendiri, tapi parameter tambahan yang boleh ditempelkan ke diagram SVG mana pun untuk memberi label/panah/garis ukuran di atasnya. Koordinat dalam PERSEN kotak gambar (0-100, titik asal pojok kiri-atas), beberapa anotasi dipisah "|". teks=x,y:tulisan — panah=x1,y1>x2,y2:tulisan (label ada di pangkal panah) — ukuran=x1,y1>x2,y2:tulisan (garis ukuran berpalang di kedua ujung). Contoh: [[bangun: bentuk=trapesium; atas=4; bawah=8; tinggi=5; teks=50,15:Sisi sejajar; ukuran=15,88>85,88:8 cm]]'
};

// Figur, kertas grafik, tabel kosong, garis jawaban, dan anotasi tidak
// terikat mata pelajaran — semuanya soal BENTUK naskah ujian, bukan isinya —
// jadi setiap preset diakhiri dengan blok yang sama ini.
const SHARED_LAYOUT_DIAGRAMS = ['figur', 'kertasgrafik', 'tabelkosong', 'garisjawab', 'anotasi'];

const SUBJECT_PRESETS = {
  matematika: { label: 'Matematika', diagrams: ['grafik', 'programlinear', 'transformasi', 'pohonpeluang', 'vektor', 'bearing', 'ogive', 'boxplot', 'bangun', 'bangunruang', 'garisbilangan', 'venn', 'statistik', 'pohonfaktor', 'pembagian', 'piktogram', 'sudut', 'lingkaranteorema', 'jaring', 'pandangan', 'pencar', 'histogram', 'batangdaun', 'tabel'].concat(SHARED_LAYOUT_DIAGRAMS) },
  fisika: { label: 'Fisika', diagrams: ['grafik', 'gaya', 'rangkaian', 'sinar', 'gerak', 'gelombang', 'medan', 'garisbilangan', 'pencar', 'alatlab', 'statistik', 'tabel'].concat(SHARED_LAYOUT_DIAGRAMS) },
  kimia: { label: 'Kimia', diagrams: ['lewis', 'hidrokarbon', 'bentukmolekul', 'tingkatenergi', 'kulitelektron', 'titrasi', 'katalis', 'kisi', 'alatlab', 'pencar', 'tabel', 'statistik'].concat(SHARED_LAYOUT_DIAGRAMS) },
  biologi: { label: 'Biologi', diagrams: ['rantaimakanan', 'sel', 'piramida', 'jaringmakanan', 'punnett', 'kuncideterminasi', 'venn', 'statistik', 'pencar', 'piktogram', 'tabel'].concat(SHARED_LAYOUT_DIAGRAMS) },
  'bahasa-indonesia': { label: 'Bahasa Indonesia', diagrams: ['tabel', 'venn'].concat(SHARED_LAYOUT_DIAGRAMS) },
  'bahasa-inggris': { label: 'Bahasa Inggris', diagrams: ['tabel', 'venn'].concat(SHARED_LAYOUT_DIAGRAMS) },
  lainnya: { label: '', diagrams: ['tabel', 'statistik'].concat(SHARED_LAYOUT_DIAGRAMS) }
};

const ITEM_TYPE_DOCS = {
  PG: '   (PG) Pilihan Ganda — tiap soal: "PG1. [pertanyaan]" lalu pilihan di baris/kalimat terpisah "A. ... B. ... C. ... D. ..."',
  B: '   (B)  Benar/Salah — tiap soal: "B1. [pernyataan yang harus dinilai benar atau salah]"',
  I: '   (I)  Isian singkat — tiap soal: "I1. [pertanyaan, pakai ______ untuk tempat isian]"',
  E: '   (E)  Esai/uraian — tiap soal: "E1. [pertanyaan]"'
};

// opts: { subject, topic, grade, language, counts: {PG,B,I,E}, includeDiagrams, includeExplanation,
//         editableBlank: leave topic/jumlah soal/bahasa out of the running text and ask for them
//         as a labeled fill-in-the-blank block at the very bottom instead — used by the "skip the
//         form" flows (buildDefaultAIPrompt) where those three are never actually collected, so
//         burying fixed defaults mid-paragraph just meant hunting through prose to edit them. }
function buildAIPrompt(opts) {
  const preset = SUBJECT_PRESETS[opts.subject] || SUBJECT_PRESETS.lainnya;
  const blank = !!opts.editableBlank;
  // "lainnya" with no subjectCustom typed in (the menu bar's one-click
  // "Lainnya... (ketik manual)" case) has no subject name to put in the
  // sentence yet — point at the same end-of-message fill-in block the rest
  // of editableBlank uses instead of silently guessing "pelajaran ini".
  const needsSubjectBlank = blank && opts.subject === 'lainnya' && !opts.subjectCustom;
  const subjectLabel = opts.subject === 'lainnya'
    ? (opts.subjectCustom || (needsSubjectBlank ? 'mata pelajaran yang saya isi di bagian PALING BAWAH pesan ini' : 'pelajaran ini'))
    : preset.label;

  const counts = opts.counts;
  const activeTypes = ['PG', 'B', 'I', 'E'].filter((t) => counts[t] > 0);
  const countsLine = activeTypes.map((t) => counts[t] + ' soal ' + ({ PG: 'Pilihan Ganda', B: 'Benar/Salah', I: 'Isian Singkat', E: 'Esai/Uraian' })[t]).join(', ');

  const DIFFICULTY_LABELS = { mudah: 'mudah', sedang: 'sedang', sulit: 'sulit', campuran: 'campuran (mudah, sedang, sulit merata)' };
  const difficultyLabel = DIFFICULTY_LABELS[opts.difficulty] || DIFFICULTY_LABELS.campuran;
  const hotsNote = opts.includeHots
    ? ' Sertakan porsi soal HOTS (Higher Order Thinking Skills) yang butuh analisis/penalaran, bukan sekadar hafalan atau rumus langsung.'
    : '';

  const setCount = Math.max(1, opts.setCount || 1);

  const parts = [];
  parts.push(`Buatkan naskah soal ${subjectLabel}${(!blank && opts.topic) ? ' tentang "' + opts.topic + '"' : ''}${opts.grade ? ' untuk ' + opts.grade : ''} dalam FORMAT KHUSUS di bawah ini, PERSIS termasuk tanda baca dan spasinya (hasilnya akan ditempel langsung ke aplikasi pembuat lembar kerja yang mem-parsing teks polos ini).`);
  if (blank) {
    parts.push(`Baca dulu blok "ISI DULU SEBELUM MENGIRIM PESAN INI" di bagian PALING BAWAH pesan ini — apa pun yang saya tulis di situ berlaku dan mengalahkan contoh apa pun di dalam pesan ini. Baris yang KOSONG bukan berarti kurang informasi: pakai standarnya langsung, dan JANGAN bertanya balik atau menunda membuat soal. Standarnya — Topik: bebas, ambil topik inti mata pelajaran ini; Kelas/Jenjang: tingkat menengah yang lazim untuk mata pelajaran ini; Jumlah set: 1; Jumlah soal per set: 5 Pilihan Ganda + 2 Benar/Salah + 2 Isian Singkat + 1 Esai/Uraian; Tingkat kesulitan: campuran (mudah, sedang, sulit merata); Bahasa: Indonesia; Contoh acuan: tidak ada (abaikan paragraf lampiran).${hotsNote} Tulis semua soal${opts.includeExplanation ? ', kunci jawaban, dan pembahasan' : ' dan kunci jawaban'} sekaligus dalam satu balasan (jangan dipotong/disingkat), tanpa markdown (tanpa **tebal**, #, -, dst) di mana pun.`);
  } else {
    parts.push(`Buat ${setCount > 1 ? setCount + ' SET soal berbeda (lihat instruksi SET di bawah), tiap set berisi ' : ''}${countsLine}. Tingkat kesulitan: ${difficultyLabel}.${hotsNote} Bahasa soal: ${opts.language}. Tulis semua soal${opts.includeExplanation ? ', kunci jawaban, dan pembahasan' : ' dan kunci jawaban'} sekaligus dalam satu balasan (jangan dipotong/disingkat), tanpa markdown (tanpa **tebal**, #, -, dst) di mana pun.`);
  }

  if (blank) {
    // Jumlah set is a fill-in field here, not a number known at build time,
    // so the multi-set rules always ship — phrased as a condition on what
    // the teacher types — plus an explicit "kalau 1 set, jangan tulis SET"
    // so a single-set run doesn't come back with a stray "SET 1" header.
    parts.push(`PENTING — KALAU "Jumlah set" yang saya isi LEBIH DARI 1: buat sebanyak itu set soal terpisah dengan STRUKTUR DAN URUTAN BAGIAN YANG SAMA PERSIS di tiap set (jenis dan jumlah soal identik, ikuti aturan FORMAT di bawah), tapi ISI PERTANYAAN/ANGKA/PILIHAN JAWABAN harus berbeda-beda tiap set — jangan mengulang soal yang sama dan jangan sekadar menukar urutan pilihan jawaban. Tiap set punya judul, kunci jawaban${opts.includeExplanation ? ', dan pembahasan' : ''} sendiri. Pisahkan SETIAP set (termasuk set pertama) dengan baris PERSIS begini, sendirian di barisnya, tanpa tambahan apa pun:\nSET 1\n[naskah set 1 lengkap: judul, daftar rumus jika ada, semua bagian soal, Kunci Jawaban${opts.includeExplanation ? ', Pembahasan' : ''}]\nSET 2\n[naskah set 2, format persis sama]\n...dan seterusnya sampai set terakhir. KALAU jumlah setnya 1 (atau saya kosongkan), JANGAN tulis baris "SET" sama sekali.`);
  } else if (setCount > 1) {
    parts.push(`PENTING — ${setCount} SET SOAL: Buat ${setCount} set soal terpisah dengan STRUKTUR DAN URUTAN BAGIAN YANG SAMA PERSIS di setiap set (jenis dan jumlah soal identik, ikuti aturan FORMAT di bawah), tapi ISI PERTANYAAN/ANGKA/PILIHAN JAWABAN harus berbeda-beda tiap set (jangan mengulang soal yang sama). Pisahkan SETIAP set (termasuk set pertama) dengan baris PERSIS begini, sendirian di barisnya, tanpa tambahan apa pun:\nSET 1\n[naskah set 1 lengkap: judul, daftar rumus jika ada, semua bagian soal, Kunci Jawaban${opts.includeExplanation ? ', Pembahasan' : ''}]\nSET 2\n[naskah set 2, format persis sama]\n...dan seterusnya sampai SET ${setCount}.`);
  }

  // Teachers usually have a real exam paper in hand — a PDF or a phone photo
  // of last year's naskah — and want "soal seperti ini". Attaching it to the
  // chatbot only works if the prompt says what to copy (gaya, bobot, sebaran)
  // and what NOT to (the questions themselves), and above all that pictures
  // in the attachment must come back as [[...]] tags: without that line the
  // model happily writes "perhatikan gambar berikut" with no gambar, which
  // this app cannot render.
  parts.push(`KALAU SAYA MELAMPIRKAN PDF/FOTO/TANGKAPAN LAYAR CONTOH NASKAH di chat ini, jadikan lampiran itu ACUAN dan tiru semirip mungkin: (a) topik dan cakupan materinya, (b) tingkat kesulitan serta kedalaman penalarannya, (c) gaya bahasa dan kata perintah tiap soal, (d) jenis, urutan, dan jumlah soal tiap bagian${opts.includeMarks ? ', termasuk bobot nilai dan pola sub-soal (a)/(b)/(i)/(ii)-nya' : ''}, (e) jenis gambar/diagram/tabel yang dipakai. ${opts.includeDiagrams ? 'SETIAP gambar, grafik, atau tabel pada lampiran WAJIB dibuat ulang memakai tag [[...]] di bawah — jangan menulis "perhatikan gambar terlampir", jangan menyuruh siswa menggambar sendiri, dan jangan melewatkan sebuah soal hanya karena ada gambarnya.' : 'Soal bergambar pada lampiran tulis ulang jadi soal yang bisa dijawab tanpa gambar (semua data yang perlu disebutkan di kalimat soalnya) — jangan menulis "perhatikan gambar terlampir".'} Yang dibuat tetap soal BARU yang setara, bukan salinan: konteks, angka, dan pilihan jawaban harus diganti, kecuali saya memang minta persis sama. ${blank ? 'Kalau isi lampiran bentrok dengan isian di bagian paling bawah pesan ini, isian yang menang.' : 'Kalau isi lampiran bentrok dengan permintaan di atas (jumlah soal, jenis soal, bahasa), permintaan di atas yang menang.'} Formatnya tetap FORMAT teks di bawah, walaupun lampirannya berbentuk lain. Kalau tidak ada lampiran, abaikan paragraf ini.`);

  parts.push((setCount > 1 || blank) ? 'FORMAT (wajib diikuti persis, berlaku untuk setiap SET):' : 'FORMAT (wajib diikuti persis):');

  let n = 1;
  parts.push(`${n++}. Baris pertama: judul singkat naskah soal, tanpa label apa pun.`);

  if (activeTypes.includes('PG') || activeTypes.includes('E')) {
    parts.push(`${n++}. (Opsional, lewati jika tidak relevan) Daftar rumus, masing-masing di baris sendiri: "F1 (Nama Rumus): $rumus dalam LaTeX$"`);
  }

  const typeLines = activeTypes.map((t) => ITEM_TYPE_DOCS[t]).join('\n');
  parts.push(`${n++}. Setiap bagian soal diawali "Bagian [Nama Bagian]: (KODE)" — KODE di dalam kurung tepat sebelum titik dua adalah salah satu dari:\n${typeLines}\n   Jangan menyisipkan sub-judul tambahan di TENGAH satu bagian — kalau perlu mengelompokkan topik berbeda, buat tiap kelompok sebagai "Bagian" terpisah (boleh kode yang sama).`);

  if (opts.includeMarks) {
    parts.push(`${n++}. BOBOT NILAI & SUB-SOAL BERJENJANG (bentuk naskah ujian internasional):
   - Tulis bobot nilai di AKHIR kalimat tiap soal dalam kurung siku, hanya angkanya: "Hitung hambatan totalnya. [3]". Jangan menulis kata "poin", "nilai", atau "marks" di dalam kurung.
   - Soal Esai/Uraian (E) boleh dipecah menjadi sub-soal bertingkat. Taruh tiap penanda sub-soal di AWAL BARIS seperti contoh di bawah (kalau baris barunya hilang saat disalin, aplikasi tetap bisa membacanya asalkan ada spasi tepat sebelum tanda kurung):
     E1. [kalimat pengantar, boleh memuat tag diagram]
     (a) [pertanyaan] [1]
     (b) (i) [pertanyaan] [3]
     (ii) [pertanyaan] [2]
   - Tingkat pertama memakai huruf (a), (b), (c) dan seterusnya, PALING JAUH sampai (h). Tingkat kedua memakai angka romawi kecil (i), (ii), (iii) dan seterusnya, dan selalu bernaung di bawah huruf terakhir yang dibuka.
   - Penanda sub-soal harus selalu didahului spasi dan berisi HANYA hurufnya, misalnya " (a) " atau " (ii) ". Notasi rumus seperti f(x), C(n, r), atau \sin(x) tidak pernah dianggap sub-soal karena tidak ada spasi sebelum kurungnya — jadi jangan menulis penanda sub-soal menempel pada kata sebelumnya.
   - Di Kunci Jawaban, sub-soal dirujuk dengan menyambung kode soal + huruf + (untuk tingkat kedua) titik + angka romawi: "E1a-", "E1b.i-", "E1b.ii-". Soal induk yang hanya menjadi pengantar (E1 dan huruf (b) pada contoh di atas) TIDAK perlu kunci jawaban sendiri.
   - JANGAN menuliskan total nilai per soal, per bagian, atau total naskah — semuanya dijumlahkan otomatis oleh aplikasi.
   - Pilih kata perintah yang tegas dan sepadan dengan bobotnya: Nyatakan/Sebutkan/Tuliskan untuk 1 nilai; Jelaskan/Uraikan untuk 2-3; Hitung/Tentukan untuk 2-4; Bandingkan/Analisis/Evaluasi untuk 3-5.`);
  }

  parts.push(`${n++}. SEMUA simbol/rumus matematika, fisika, atau kimia WAJIB dibungkus tanda dolar $...$ (termasuk di pilihan jawaban, kunci jawaban${opts.includeExplanation ? ', dan pembahasan' : ''}). Jangan menulis rumus mentah tanpa $...$.`);

  parts.push(`${n++}. Setiap soal, pilihan jawaban, dan paragraf harus jelas terpisah (baris baru) — jangan menggabungkan dua kalimat tanpa spasi.`);

  const answerExample = activeTypes.map((t) => ({
    PG: 'PG1-B', B: 'B1-Benar', I: 'I1-[jawaban singkat]',
    // With marks on, essay answers are keyed per sub-part, so the example
    // has to show that shape or the model keys the parent instead.
    E: opts.includeMarks ? 'E1a-[jawaban], E1b.i-[jawaban], E1b.ii-[jawaban]' : 'E1-[jawaban/rumus singkat]'
  })[t]).join(', ');
  parts.push(`${n++}. Di akhir naskah, tulis kunci jawaban PERSIS begini — kode soal diikuti TANDA HUBUNG "-" (bukan titik) lalu jawabannya, dipisah koma, satu paragraf mengalir:\nKunci Jawaban\n${answerExample}`);

  if (opts.includeExplanation) {
    const expExample = activeTypes.map((t) => t + '1-[penjelasan singkat]').join('');
    parts.push(`${n++}. Setelah Kunci Jawaban, tulis pembahasan dengan format SAMA (tanda hubung "-", bukan titik):\nPembahasan\n${expExample}`);
  }

  if (opts.includeDiagrams && preset.diagrams.length) {
    const diagramLines = preset.diagrams.map((k) => DIAGRAM_DOCS[k]).join('\n');
    parts.push(`${n++}. (Opsional) Untuk diagram/gambar/tabel, taruh tag berikut LANGSUNG di kalimat soal (PG: sebelum pilihan A/B/C), format "[[jenis: param1=nilai1; param2=nilai2]]". Pakai HANYA jika relevan — jangan dipaksakan. Jenis yang tersedia:\n${diagramLines}`);
  }

  if (blank) {
    const subjectLine = needsSubjectBlank ? 'Mata Pelajaran: \n' : '';
    // Every line ships EMPTY on purpose: prefilled values only meant deleting
    // them before typing your own. Blank = pakai standar (dijabarkan di
    // paragraf pembuka), jadi mengirim blok ini apa adanya tetap sah.
    parts.push(`ISI DULU SEBELUM MENGIRIM PESAN INI (yang saya biarkan KOSONG berarti pakai standar, jangan ditanyakan balik):\n${subjectLine}Topik: \nKelas/Jenjang: \nJumlah set: \nJumlah soal per set: \nTingkat kesulitan: \nBahasa: \nContoh acuan: `);
  }

  return parts.join('\n\n');
}

// Sensible defaults for a "copy prompt right now, skip the form" action —
// used by the web UI's quick-copy button, default-prompt.js (CLI), and the
// menu bar app's "Copy Prompt AI" menu. A generic 10-question worksheet
// (5 PG, 2 B/S, 2 isian, 1 esai), mixed difficulty, diagrams + pembahasan
// included — the same shape as a typical worksheet made with this app.
//
// Since this flow never opens the form, everything the form would have asked
// (topik, kelas, jumlah set, jumlah soal, tingkat kesulitan, bahasa, plus a
// slot for an attached contoh naskah) ships as one labeled block of EMPTY
// lines at the very bottom (editableBlank) — one place to look and fill in
// after pasting, instead of defaults buried mid-paragraph. The lines stay
// empty rather than prefilled so nothing has to be deleted first; the
// defaults below are spelled out in the prompt's opening paragraph as what
// an empty line means.
function buildDefaultAIPrompt(subject) {
  const key = SUBJECT_PRESETS[subject] ? subject : 'matematika';
  return buildAIPrompt({
    subject: key,
    subjectCustom: '',
    topic: '',
    grade: '',
    language: 'Indonesia',
    counts: { PG: 5, B: 2, I: 2, E: 1 },
    setCount: 1,
    difficulty: 'campuran',
    includeHots: true,
    includeDiagrams: true,
    includeExplanation: true,
    includeMarks: true,
    editableBlank: true
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DIAGRAM_DOCS, SUBJECT_PRESETS, ITEM_TYPE_DOCS, buildAIPrompt, buildDefaultAIPrompt };
}
