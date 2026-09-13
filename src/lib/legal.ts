import type { Locale } from "@/lib/i18n/dictionaries";
import { LEGAL_VERSION } from "@/lib/privacy";

/* =========================================================================
 * DOKUMEN HUKUM
 *
 * Ditulis untuk memenuhi UU PDP No. 27/2022 (Indonesia) dan GDPR (Uni Eropa)
 * sekaligus, karena aplikasi ini menerima pendaftar dari keduanya.
 *
 * PENTING: ini draf yang disusun dengan cermat, BUKAN nasihat hukum. Sebelum
 * menerima pembayaran pertama, mintalah pengacara memeriksanya — terutama
 * bagian penahanan data, transfer lintas negara, dan persetujuan anak di
 * bawah umur, yang menjadi mayoritas penggunamu.
 * ========================================================================= */

export interface LegalSection { heading: string; body: string[] }
export interface LegalDoc {
  title: string;
  updated: string;
  intro: string;
  sections: LegalSection[];
  disclaimer: string;
}

export const LEGAL_UPDATED = LEGAL_VERSION;

const CONTACT = "privacy@exacttryout.com";

/* --------------------------------------------------------------- privasi */

const privacyEn: LegalDoc = {
  title: "Privacy Policy",
  updated: LEGAL_UPDATED,
  intro:
    "This policy explains what Exact Practice collects about you, why, how long it is kept, and how you can get it back or have it erased. It applies to everyone, wherever you live.",
  disclaimer:
    "This document is a carefully written draft, not legal advice. Have it reviewed by a qualified lawyer in your jurisdiction before relying on it.",
  sections: [
    {
      heading: "1. Who is responsible",
      body: [
        "Exact Practice is operated by Exact Group. For anything in this policy, write to " + CONTACT + ".",
        "Under GDPR we act as the data controller for candidate accounts. Under Indonesia's Personal Data Protection Law (UU No. 27/2022) we are the Pengendali Data Pribadi.",
      ],
    },
    {
      heading: "2. What we collect",
      body: [
        "**When you register:** full name, email address, country, mobile number in international format, and optionally your school. Your email is also your candidate ID.",
        "**When you sit a test:** your answers, the time spent on each question, your score, and a proctoring log — tab switches, full-screen exits, and copy or paste attempts.",
        "**When you pay:** the order, amount, currency, and a payment reference. We never see or store your card number; that stays with Stripe or Midtrans.",
        "**Automatically:** your interface language, chosen theme, and an approximate rate-limit record tied to your IP address. We do not run advertising trackers.",
      ],
    },
    {
      heading: "3. Why we are allowed to use it",
      body: [
        "**Performance of a contract** — running the tests you bought, scoring them, and keeping your history. Without this data the service cannot work.",
        "**Legitimate interests** — proctoring to keep scores meaningful, rate limiting to stop abuse, and aggregate statistics used to calibrate question difficulty.",
        "**Consent** — the affiliate referral cookie, and any marketing email. You can withdraw consent at any time without affecting the tests you have already bought.",
        "**Legal obligation** — keeping financial records of your purchases.",
      ],
    },
    {
      heading: "4. Proctoring, stated plainly",
      body: [
        "During a paid test the browser records when you leave full screen, switch tabs, or attempt to copy, paste, or right-click. These events produce an integrity score.",
        "We do **not** use your camera, microphone, or screen recording, and we do not install anything on your computer.",
        "A low integrity score removes an attempt from the leaderboard. It never cancels a score automatically — a person reviews it first.",
      ],
    },
    {
      heading: "5. Who else sees your data",
      body: [
        "**Supabase** hosts the database and authentication. **Vercel** serves the application. **Stripe** and **Midtrans** process payments. **Resend** delivers email.",
        "AI providers (Anthropic, Google, OpenAI) are used to write questions. Your personal data is never sent to them — only the question specifications.",
        "We do not sell your data, and we do not share it with anyone for their own marketing.",
      ],
    },
    {
      heading: "6. Where your data is processed",
      body: [
        "Our processors operate outside your country in some cases. Transfers out of the EEA and the UK rely on the European Commission's Standard Contractual Clauses.",
        "You can ask us which region your data currently sits in by writing to " + CONTACT + ".",
      ],
    },
    {
      heading: "7. How long we keep it",
      body: [
        "**Account and test history:** while your account is open, then deleted on request.",
        "**Financial records:** ten years after the transaction, as tax law requires. These are pseudonymised once you delete your account — the amount and date remain, your identity does not.",
        "**Proctoring events:** two years, then deleted.",
        "**Rate-limit records:** less than one hour.",
      ],
    },
    {
      heading: "8. Your rights, and how to use them",
      body: [
        "**Get a copy of everything** — Settings → Your data → *Download my data*. You receive a machine-readable JSON file immediately, no request form and no waiting period.",
        "**Delete your account** — Settings → Your data → *Delete my account*. This erases your profile, answers, scores, and proctoring log at once. Financial records are kept but pseudonymised, as explained above.",
        "**Correct, object, or restrict** — write to " + CONTACT + " and we answer within 30 days.",
        "**Complain** — you may lodge a complaint with your local supervisory authority, or in Indonesia with the authority designated under UU PDP.",
      ],
    },
    {
      heading: "9. Candidates under 18",
      body: [
        "Most people preparing for these exams are school students. If you are under the age of digital consent where you live (16 in much of the EU, 18 under Indonesia's UU PDP), a parent or guardian must agree on your behalf before you register.",
        "If you believe a child registered without that agreement, write to " + CONTACT + " and we will delete the account.",
      ],
    },
    {
      heading: "10. Security",
      body: [
        "Passwords are hashed and never stored in readable form. Sessions use HTTP-only cookies. Answer keys are removed on the server before any question reaches your browser, and marking happens on the server.",
        "No system is perfectly secure. If we discover a breach affecting you, we notify you and the relevant authority within 72 hours.",
      ],
    },
  ],
};

const privacyId: LegalDoc = {
  title: "Kebijakan Privasi",
  updated: LEGAL_UPDATED,
  intro:
    "Kebijakan ini menjelaskan data apa yang Exact Practice kumpulkan tentang kamu, untuk apa, berapa lama disimpan, dan bagaimana kamu bisa mengambilnya kembali atau menghapusnya. Berlaku untuk semua pengguna, di mana pun kamu tinggal.",
  disclaimer:
    "Dokumen ini draf yang disusun dengan cermat, bukan nasihat hukum. Mintalah pengacara memeriksanya sebelum kamu bergantung padanya.",
  sections: [
    {
      heading: "1. Siapa yang bertanggung jawab",
      body: [
        "Exact Practice dioperasikan oleh Exact Group. Untuk hal apa pun dalam kebijakan ini, hubungi " + CONTACT + ".",
        "Menurut UU Perlindungan Data Pribadi No. 27/2022, kami adalah Pengendali Data Pribadi. Menurut GDPR, kami bertindak sebagai data controller.",
      ],
    },
    {
      heading: "2. Data yang kami kumpulkan",
      body: [
        "**Saat mendaftar:** nama lengkap, alamat email, negara, nomor HP dalam format internasional, dan opsional nama sekolah. Emailmu sekaligus menjadi ID peserta.",
        "**Saat mengerjakan tes:** jawabanmu, waktu yang dihabiskan per soal, skor, dan catatan pengawasan — perpindahan tab, keluar layar penuh, serta percobaan salin dan tempel.",
        "**Saat membayar:** pesanan, nominal, mata uang, dan nomor rujukan pembayaran. Kami tidak pernah melihat atau menyimpan nomor kartumu; itu tinggal di Stripe atau Midtrans.",
        "**Otomatis:** bahasa antarmuka, tema yang kamu pilih, dan catatan pembatas laju yang terkait alamat IP. Kami tidak memasang pelacak iklan.",
      ],
    },
    {
      heading: "3. Dasar kami boleh memakainya",
      body: [
        "**Pelaksanaan perjanjian** — menjalankan tes yang kamu beli, menilainya, dan menyimpan riwayatmu. Tanpa data ini layanannya tidak bisa berjalan.",
        "**Kepentingan yang sah** — pengawasan agar skor tetap bermakna, pembatas laju untuk mencegah penyalahgunaan, dan statistik agregat untuk mengkalibrasi tingkat kesulitan soal.",
        "**Persetujuan** — cookie rujukan afiliasi dan email pemasaran. Kamu bisa menariknya kapan saja tanpa memengaruhi tes yang sudah kamu beli.",
        "**Kewajiban hukum** — menyimpan catatan keuangan atas pembelianmu.",
      ],
    },
    {
      heading: "4. Pengawasan ujian, apa adanya",
      body: [
        "Selama tes berbayar, browser mencatat kapan kamu keluar dari layar penuh, berpindah tab, atau mencoba menyalin, menempel, dan klik kanan. Kejadian itu menghasilkan skor integritas.",
        "Kami **tidak** memakai kamera, mikrofon, maupun perekaman layar, dan tidak memasang apa pun di komputermu.",
        "Skor integritas rendah mengeluarkan satu percobaan dari papan peringkat. Ia tidak pernah membatalkan skor secara otomatis — selalu ada manusia yang meninjau lebih dulu.",
      ],
    },
    {
      heading: "5. Siapa lagi yang melihat datamu",
      body: [
        "**Supabase** menyimpan basis data dan autentikasi. **Vercel** melayani aplikasinya. **Stripe** dan **Midtrans** memproses pembayaran. **Resend** mengirim email.",
        "Penyedia AI (Anthropic, Google, OpenAI) dipakai untuk menulis soal. Data pribadimu tidak pernah dikirim ke sana — hanya spesifikasi soal.",
        "Kami tidak menjual datamu dan tidak membaginya kepada siapa pun untuk pemasaran mereka.",
      ],
    },
    {
      heading: "6. Di mana datamu diproses",
      body: [
        "Sebagian pemroses kami beroperasi di luar negaramu. Transfer keluar dari EEA dan Inggris bersandar pada Standard Contractual Clauses Komisi Eropa.",
        "Kamu bisa menanyakan wilayah tempat datamu berada saat ini ke " + CONTACT + ".",
      ],
    },
    {
      heading: "7. Berapa lama kami menyimpannya",
      body: [
        "**Akun dan riwayat tes:** selama akunmu aktif, lalu dihapus bila diminta.",
        "**Catatan keuangan:** sepuluh tahun setelah transaksi, sesuai ketentuan perpajakan. Catatan ini dianonimkan begitu kamu menghapus akun — nominal dan tanggalnya tetap, identitasmu tidak.",
        "**Catatan pengawasan:** dua tahun, lalu dihapus.",
        "**Catatan pembatas laju:** kurang dari satu jam.",
      ],
    },
    {
      heading: "8. Hakmu, dan cara memakainya",
      body: [
        "**Mengambil salinan seluruh data** — Pengaturan → Data kamu → *Unduh data saya*. Kamu langsung menerima berkas JSON, tanpa formulir permintaan dan tanpa masa tunggu.",
        "**Menghapus akun** — Pengaturan → Data kamu → *Hapus akun saya*. Profil, jawaban, skor, dan catatan pengawasan terhapus seketika. Catatan keuangan tetap disimpan tetapi dianonimkan, seperti dijelaskan di atas.",
        "**Memperbaiki, menolak, atau membatasi** — hubungi " + CONTACT + " dan kami menjawab dalam 30 hari.",
        "**Mengadu** — kamu dapat mengadu ke otoritas pengawas di wilayahmu, atau di Indonesia kepada lembaga yang ditunjuk berdasarkan UU PDP.",
      ],
    },
    {
      heading: "9. Peserta di bawah 18 tahun",
      body: [
        "Sebagian besar peserta ujian ini adalah pelajar. Bila usiamu di bawah batas persetujuan digital di wilayahmu (16 tahun di sebagian besar Uni Eropa, 18 tahun menurut UU PDP), orang tua atau wali harus menyetujui atas namamu sebelum kamu mendaftar.",
        "Bila kamu menemukan anak yang mendaftar tanpa persetujuan itu, hubungi " + CONTACT + " dan kami akan menghapus akunnya.",
      ],
    },
    {
      heading: "10. Keamanan",
      body: [
        "Kata sandi di-hash dan tidak pernah disimpan dalam bentuk terbaca. Sesi memakai cookie HTTP-only. Kunci jawaban dibuang di server sebelum soal sampai ke browsermu, dan penilaian dilakukan di server.",
        "Tidak ada sistem yang sempurna. Bila kami menemukan kebocoran yang memengaruhimu, kami memberi tahu kamu dan otoritas terkait dalam 72 jam.",
      ],
    },
  ],
};

const privacyZh: LegalDoc = {
  title: "隐私政策",
  updated: LEGAL_UPDATED,
  intro:
    "本政策说明 Exact Practice 收集你的哪些信息、用途、保存期限，以及你如何取回或删除这些信息。无论你身在何处，本政策均适用。",
  disclaimer: "本文件是经过认真撰写的草稿，不构成法律意见。在依赖本文件之前，请交由所在司法辖区的执业律师审阅。",
  sections: [
    {
      heading: "一、责任主体",
      body: [
        "Exact Practice 由 Exact Group 运营。与本政策有关的任何事宜，请联系 " + CONTACT + "。",
        "根据欧盟 GDPR，我们是数据控制者；根据印度尼西亚《个人数据保护法》（第 27/2022 号法令），我们是个人数据控制方。",
      ],
    },
    {
      heading: "二、我们收集哪些信息",
      body: [
        "**注册时：** 姓名、电子邮箱、国家或地区、国际格式的手机号码，以及可选填的学校名称。你的邮箱同时作为考生 ID。",
        "**考试时：** 你的作答内容、每题用时、成绩，以及监考记录——切换标签页、退出全屏、复制或粘贴尝试。",
        "**付款时：** 订单、金额、币种与支付参考号。我们从不接触也不存储你的银行卡号，卡号仅保存在 Stripe 或 Midtrans。",
        "**自动收集：** 界面语言、所选主题，以及与 IP 地址关联的限流记录。我们不使用广告追踪工具。",
      ],
    },
    {
      heading: "三、我们据以处理的合法性基础",
      body: [
        "**履行合同** —— 运行你购买的考试、评分并保存记录。没有这些数据，服务无法运作。",
        "**正当利益** —— 通过监考维持成绩的可信度、通过限流防止滥用，以及用汇总统计校准题目难度。",
        "**同意** —— 推荐计划的 Cookie 与营销邮件。你可随时撤回同意，且不影响已购买的考试。",
        "**法定义务** —— 保存你的交易财务记录。",
      ],
    },
    {
      heading: "四、关于监考的明确说明",
      body: [
        "在付费考试期间，浏览器会记录你何时退出全屏、切换标签页，或尝试复制、粘贴与右键操作。这些事件生成诚信分。",
        "我们**不会**使用你的摄像头、麦克风或屏幕录制，也不会在你的电脑上安装任何程序。",
        "诚信分过低会使该次考试不计入排行榜，但绝不会自动取消成绩——始终先由人工复核。",
      ],
    },
    {
      heading: "五、还有谁能接触你的数据",
      body: [
        "**Supabase** 提供数据库与身份认证，**Vercel** 提供应用托管，**Stripe** 与 **Midtrans** 处理支付，**Resend** 负责邮件送达。",
        "我们使用 AI 服务（Anthropic、Google、OpenAI）撰写题目，但**从不**向其发送你的个人数据，只发送题目规格。",
        "我们不出售你的数据，也不会将其提供给任何第三方用于其自身营销。",
      ],
    },
    {
      heading: "六、数据处理地点",
      body: [
        "部分服务商在你所在国家或地区之外运营。向欧洲经济区和英国境外的传输依据欧盟委员会《标准合同条款》进行。",
        "你可以写信至 " + CONTACT + " 询问你的数据当前存放的区域。",
      ],
    },
    {
      heading: "七、保存期限",
      body: [
        "**账号与考试记录：** 账号存续期间保存，收到请求后删除。",
        "**财务记录：** 交易后保存十年，以符合税务法规。你删除账号后，这些记录将被去标识化——金额与日期保留，你的身份不再保留。",
        "**监考事件：** 保存两年后删除。",
        "**限流记录：** 保存不足一小时。",
      ],
    },
    {
      heading: "八、你的权利及行使方式",
      body: [
        "**获取全部数据副本** —— 设置 → 你的数据 → *下载我的数据*。你会立即收到机器可读的 JSON 文件，无需申请表，也无需等待。",
        "**删除账号** —— 设置 → 你的数据 → *删除我的账号*。个人资料、作答内容、成绩与监考记录将立即清除。财务记录按上述方式保留但去标识化。",
        "**更正、反对或限制处理** —— 请联系 " + CONTACT + "，我们将在 30 天内答复。",
        "**投诉** —— 你可以向所在地监管机构投诉；在印度尼西亚，可向依《个人数据保护法》指定的机构投诉。",
      ],
    },
    {
      heading: "九、未满 18 周岁的考生",
      body: [
        "备考这些考试的大多是在校学生。如果你未达到所在地的数字同意年龄（欧盟多数国家为 16 岁，印度尼西亚《个人数据保护法》为 18 岁），须由父母或监护人代为同意后方可注册。",
        "如果你发现有儿童在未获同意的情况下注册，请联系 " + CONTACT + "，我们将删除该账号。",
      ],
    },
    {
      heading: "十、安全",
      body: [
        "密码经哈希处理，绝不以可读形式存储。会话使用 HTTP-only Cookie。题目送达浏览器之前，服务器已移除答案，评分全部在服务器完成。",
        "没有系统是绝对安全的。若发现涉及你的数据泄露，我们将在 72 小时内通知你及相关监管机构。",
      ],
    },
  ],
};

/* -------------------------------------------------------------- ketentuan */

const termsEn: LegalDoc = {
  title: "Terms of Service",
  updated: LEGAL_UPDATED,
  intro: "These terms govern your use of Exact Practice. By creating an account you agree to them.",
  disclaimer:
    "This document is a carefully written draft, not legal advice. Have it reviewed by a qualified lawyer before you accept payments.",
  sections: [
    {
      heading: "1. What Exact Practice is — and is not",
      body: [
        "Exact Practice is independent practice software. **We are not affiliated with, sponsored by, or endorsed by** College Board, Cambridge Assessment International Education, the China Scholarship Council, or the organisers of UTBK-SNBT.",
        "SAT and Bluebook are trademarks of College Board. A Level is a trademark of Cambridge. We use those names only to describe the kind of exam being simulated.",
        "Our questions are original, written with AI assistance and reviewed by teachers. They are not reproductions of past papers.",
      ],
    },
    {
      heading: "2. Scores here are practice scores",
      body: [
        "A score produced by Exact Practice is an estimate generated by our own model. It is not an official score, carries no weight with any university or examination board, and may differ from your result in the real exam.",
        "We make no promise about the score you will achieve in the actual exam.",
      ],
    },
    {
      heading: "3. Your account",
      body: [
        "One account per person. Your email is your candidate ID. Keep your password to yourself — you are responsible for what happens under your account.",
        "Test quota is tied to your account, valid for 12 months from purchase, and cannot be transferred or resold.",
      ],
    },
    {
      heading: "4. Fair use during tests",
      body: [
        "Do not copy, record, or redistribute our questions. Do not use another person or an AI assistant to answer during a proctored test.",
        "Attempts with an integrity score below 60 are excluded from the leaderboard. Repeated or deliberate breaches may lead to score cancellation and account closure, after review by a person.",
      ],
    },
    {
      heading: "5. Payment and refunds",
      body: [
        "Prices are shown in your local currency and charged through Stripe or Midtrans. Quota is granted only after the payment provider confirms the payment.",
        "**Refunds:** a full refund within 14 days of purchase, provided you have not started more than one full test. After that, or once more than one test has been started, the purchase is final. Write to " + CONTACT + " to request one.",
      ],
    },
    {
      heading: "6. Affiliate programme",
      body: [
        "Commission is earned only on genuine purchases by people you referred. Referring yourself, creating additional accounts to refer yourself, or buying through your own link voids the commission and closes the affiliate account.",
        "Commission is held for 14 days to cover the refund window, then approved and paid on request above the minimum threshold. Refunded orders void the related commission.",
      ],
    },
    {
      heading: "7. Availability",
      body: [
        "We aim to keep the service running but do not guarantee uninterrupted access. If a technical fault on our side ruins a test attempt, write to us and we restore the quota.",
      ],
    },
    {
      heading: "8. Liability",
      body: [
        "To the extent the law allows, our liability is limited to the amount you paid us in the 12 months before the claim. Nothing here limits liability that cannot lawfully be limited.",
      ],
    },
    {
      heading: "9. Changes and governing law",
      body: [
        "We may change these terms; material changes are announced in the application and require your renewed agreement.",
        "These terms are governed by the laws of the Republic of Indonesia. Nothing in this clause removes consumer rights you hold under the law of your own country of residence.",
      ],
    },
  ],
};

const termsId: LegalDoc = {
  title: "Ketentuan Layanan",
  updated: LEGAL_UPDATED,
  intro: "Ketentuan ini mengatur penggunaanmu atas Exact Practice. Dengan membuat akun, kamu menyetujuinya.",
  disclaimer:
    "Dokumen ini draf yang disusun dengan cermat, bukan nasihat hukum. Mintalah pengacara memeriksanya sebelum kamu menerima pembayaran.",
  sections: [
    {
      heading: "1. Apa itu Exact Practice — dan apa yang bukan",
      body: [
        "Exact Practice adalah perangkat lunak latihan yang independen. **Kami tidak berafiliasi dengan, tidak disponsori oleh, dan tidak didukung oleh** College Board, Cambridge Assessment International Education, China Scholarship Council, maupun penyelenggara UTBK-SNBT.",
        "SAT dan Bluebook adalah merek dagang College Board. A Level adalah merek dagang Cambridge. Nama-nama itu kami pakai semata untuk menerangkan jenis ujian yang disimulasikan.",
        "Soal kami orisinal, disusun dengan bantuan AI dan ditinjau pengajar. Soal kami bukan salinan past paper.",
      ],
    },
    {
      heading: "2. Skor di sini adalah skor latihan",
      body: [
        "Skor yang dihasilkan Exact Practice adalah estimasi dari model kami sendiri. Ia bukan skor resmi, tidak memiliki bobot apa pun di mata universitas atau badan ujian, dan bisa berbeda dari hasilmu di ujian sesungguhnya.",
        "Kami tidak menjanjikan skor tertentu di ujian yang sebenarnya.",
      ],
    },
    {
      heading: "3. Akunmu",
      body: [
        "Satu akun untuk satu orang. Emailmu adalah ID peserta. Jaga kata sandimu — kamu bertanggung jawab atas apa pun yang terjadi di akunmu.",
        "Kuota try out melekat pada akunmu, berlaku 12 bulan sejak pembelian, dan tidak dapat dipindahtangankan atau dijual kembali.",
      ],
    },
    {
      heading: "4. Penggunaan wajar selama ujian",
      body: [
        "Jangan menyalin, merekam, atau menyebarkan ulang soal kami. Jangan meminta bantuan orang lain atau asisten AI untuk menjawab selama ujian terproktor.",
        "Percobaan dengan skor integritas di bawah 60 dikeluarkan dari papan peringkat. Pelanggaran berulang atau disengaja dapat berujung pada pembatalan skor dan penutupan akun, setelah ditinjau manusia.",
      ],
    },
    {
      heading: "5. Pembayaran dan pengembalian dana",
      body: [
        "Harga ditampilkan dalam mata uang lokalmu dan ditagih melalui Stripe atau Midtrans. Kuota diberikan hanya setelah penyedia pembayaran mengonfirmasi pembayaranmu.",
        "**Pengembalian dana:** penuh dalam 14 hari sejak pembelian, sepanjang kamu belum memulai lebih dari satu try out penuh. Setelah itu, atau setelah lebih dari satu try out dimulai, pembelian bersifat final. Ajukan ke " + CONTACT + ".",
      ],
    },
    {
      heading: "6. Program afiliasi",
      body: [
        "Komisi hanya diperoleh dari pembelian sungguhan oleh orang yang kamu ajak. Merujuk diri sendiri, membuat akun tambahan untuk merujuk diri sendiri, atau membeli lewat tautanmu sendiri membatalkan komisi dan menutup akun afiliasi.",
        "Komisi ditahan 14 hari untuk menutup masa pengembalian dana, lalu disetujui dan dibayarkan atas permintaan setelah melewati batas minimum. Pesanan yang direfund membatalkan komisinya.",
      ],
    },
    {
      heading: "7. Ketersediaan layanan",
      body: [
        "Kami berusaha menjaga layanan tetap berjalan, tetapi tidak menjamin akses tanpa gangguan. Bila gangguan teknis dari pihak kami merusak satu percobaan ujian, hubungi kami dan kuotamu kami kembalikan.",
      ],
    },
    {
      heading: "8. Tanggung jawab",
      body: [
        "Sejauh diizinkan hukum, tanggung jawab kami terbatas pada jumlah yang kamu bayarkan kepada kami dalam 12 bulan sebelum klaim. Tidak ada bagian di sini yang membatasi tanggung jawab yang secara hukum tidak dapat dibatasi.",
      ],
    },
    {
      heading: "9. Perubahan dan hukum yang berlaku",
      body: [
        "Kami dapat mengubah ketentuan ini; perubahan material diumumkan di aplikasi dan memerlukan persetujuanmu kembali.",
        "Ketentuan ini tunduk pada hukum Republik Indonesia. Tidak ada bagian dari klausul ini yang menghapus hak konsumen yang kamu miliki menurut hukum negara tempat tinggalmu.",
      ],
    },
  ],
};

const termsZh: LegalDoc = {
  title: "服务条款",
  updated: LEGAL_UPDATED,
  intro: "本条款约束你对 Exact Practice 的使用。创建账号即表示你同意本条款。",
  disclaimer: "本文件是经过认真撰写的草稿，不构成法律意见。在开始收款之前，请交由执业律师审阅。",
  sections: [
    {
      heading: "一、Exact Practice 是什么，不是什么",
      body: [
        "Exact Practice 是独立的备考练习软件。我们与 College Board、剑桥国际考评部、中国国家留学基金管理委员会及 UTBK-SNBT 主办方**均无隶属、赞助或背书关系**。",
        "SAT 与 Bluebook 是 College Board 的商标，A Level 是剑桥的商标。我们使用这些名称仅为说明所模拟的考试类型。",
        "我们的题目均为原创，由 AI 辅助撰写并经教师审核，不是往年真题的复制。",
      ],
    },
    {
      heading: "二、此处的成绩是练习成绩",
      body: [
        "Exact Practice 给出的分数是我们自有模型的估算值。它不是官方成绩，对任何大学或考试机构均无效力，也可能与你在真实考试中的结果不同。",
        "我们不对你在真实考试中的成绩作出任何承诺。",
      ],
    },
    {
      heading: "三、你的账号",
      body: [
        "一人一号。你的邮箱即考生 ID。请妥善保管密码——账号项下发生的一切由你负责。",
        "考试额度与账号绑定，自购买之日起 12 个月内有效，不得转让或转售。",
      ],
    },
    {
      heading: "四、考试期间的合理使用",
      body: [
        "不得复制、录制或再传播我们的题目。在监考考试期间，不得借助他人或 AI 助手作答。",
        "诚信分低于 60 的考试记录不计入排行榜。屡次或蓄意违规，经人工复核后可能导致成绩取消与账号关闭。",
      ],
    },
    {
      heading: "五、付款与退款",
      body: [
        "价格以你所在地区的货币显示，通过 Stripe 或 Midtrans 收取。只有在支付服务商确认付款后，额度才会发放。",
        "**退款：** 购买后 14 天内，且尚未开始超过一场完整考试的，可全额退款。超过期限或已开始一场以上考试的，购买视为最终交易。请联系 " + CONTACT + " 申请。",
      ],
    },
    {
      heading: "六、推荐计划",
      body: [
        "佣金仅来自你推荐之人的真实购买。推荐自己、为推荐自己而注册额外账号，或通过自己的链接购买，将使佣金作废并关闭推荐账号。",
        "佣金冻结 14 天以覆盖退款期，之后经审核通过，在达到最低提现门槛后按申请支付。已退款的订单，其对应佣金作废。",
      ],
    },
    {
      heading: "七、服务可用性",
      body: [
        "我们努力保持服务运行，但不保证不间断访问。若因我方技术故障导致某次考试作废，请联系我们，我们将恢复该次额度。",
      ],
    },
    {
      heading: "八、责任限制",
      body: [
        "在法律允许的范围内，我们的责任以你在索赔前 12 个月内向我们支付的金额为限。本条不限制依法不可限制的责任。",
      ],
    },
    {
      heading: "九、条款变更与适用法律",
      body: [
        "我们可能修改本条款；重大变更将在应用内公告，并需要你重新确认同意。",
        "本条款适用印度尼西亚共和国法律。本条不排除你依所在居住国法律享有的消费者权利。",
      ],
    },
  ],
};

export const PRIVACY: Record<Locale, LegalDoc> = { en: privacyEn, id: privacyId, zh: privacyZh };
export const TERMS: Record<Locale, LegalDoc> = { en: termsEn, id: termsId, zh: termsZh };
