"use client";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, BookOpen, Calculator as CalcIcon, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Clock, Eye, EyeOff, Flag, Highlighter, LayoutGrid, Loader2, Maximize, Maximize2, Minimize2, ShieldCheck, WifiOff, MessageCircleQuestion, X,
} from "lucide-react";
import type { ExamCode, Question, ResponseValue } from "@/lib/types";
import { QuestionView } from "./QuestionView";
import type { Span } from "@/lib/exams/highlight";
import { RichText } from "./RichText";
import { Calculator } from "./Calculator";
import { FormulaSheet } from "./FormulaSheet";
import { useProctor } from "./useProctor";
import { useI18n } from "@/components/ui/I18nProvider";

/* Panel papan guru: layar murid Exact Canvas di dalam halaman latihan.
 * Di ponsel menumpuk di bawah soal (45% tinggi), di layar lebar berdampingan
 * di kanan. "Lipat" hanya menyembunyikan — iframe-nya tetap hidup supaya
 * sambungan ke kanvas tidak putus dan bunyi "dibahas" tetap sampai. */
function PapanGuru({ url, mode, onMode, onTutup, t }: {
  url: string; mode: "kecil" | "normal" | "penuh";
  onMode: (m: "kecil" | "normal" | "penuh") => void; onTutup: () => void;
  t: ReturnType<typeof useI18n>["t"];
}) {
  const penuh = mode === "penuh";
  const kecil = mode === "kecil";
  const kelas = penuh
    ? "fixed inset-0 z-[60] flex flex-col"
    : `flex shrink-0 flex-col border-t lg:border-l lg:border-t-0 ${kecil ? "" : "h-[45%] lg:h-auto lg:w-1/2"}`;
  return (
    <section className={kelas} style={{ background: "var(--bg-elev)" }} aria-label={t("exam.boardTitle")}>
      <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs">
        <span className="shrink-0 font-semibold">{t("exam.boardTitle")}</span>
        {!penuh && <span className="hidden truncate muted sm:inline">{t("exam.boardHint")}</span>}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {!penuh && (
            <button className="btn btn-ghost !px-2 !py-1" onClick={() => onMode(kecil ? "normal" : "kecil")} title={kecil ? t("exam.boardShow") : t("exam.boardCollapse")}>
              {kecil ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          )}
          <button className="btn btn-ghost !px-2 !py-1" onClick={() => onMode(penuh ? "normal" : "penuh")} title={penuh ? t("exam.boardBack") : t("exam.boardFull")}>
            {penuh ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button className="btn btn-ghost !px-2 !py-1" onClick={onTutup} title={t("exam.boardClose")}>
            <X size={14} />
          </button>
        </div>
      </div>
      <iframe
        src={url}
        title={t("exam.boardTitle")}
        className="w-full min-h-0 flex-1 border-0"
        hidden={kecil}
        allow="fullscreen; screen-wake-lock; autoplay"
      />
    </section>
  );
}

export interface PlayerSection {
  code: string;
  name: string;
  durationSec: number;
  calculatorAllowed: boolean;
  formulaSheet?: string;
  breakAfterSec?: number;
  /** Jumlah soal di section ini — selalu terisi, walau soalnya belum dikirim. */
  questionCount: number;
  /** Kosong untuk section yang belum dicapai peserta; diisi saat section dimulai. */
  questions: Question[];
}

export interface SectionClock {
  sectionIndex: number;
  remainingSec: number;
  /** Soal section yang baru dimulai — tidak dikirim saat halaman dimuat. */
  questions?: Question[];
}

export interface ExamPlayerProps {
  attemptId: string;
  examCode: ExamCode;
  examName: string;
  studentName: string;
  sections: PlayerSection[];
  isDemo?: boolean;
  locale?: string;
  /** keadaan awal dari server: section mana dan berapa sisa waktunya */
  initial: { sectionIndex: number; remainingSec: number; started: boolean };
  /** Jawaban yang SUDAH tersimpan di server untuk attempt ini.
   *
   *  Tanpa ini, memuat ulang halaman di tengah ujian menampilkan seluruh soal
   *  dalam keadaan kosong. Jawabannya sebenarnya aman — `saveResponses`
   *  menggabungkan, tidak menimpa, jadi tidak ada yang hilang dan penilaian
   *  tetap benar. Tetapi peserta tidak bisa tahu itu: yang ia lihat adalah
   *  seluruh pekerjaannya lenyap di tengah ujian berwaktu. */
  savedResponses?: Record<string, ResponseValue>;
  /** Akomodasi waktu yang berlaku untuk attempt ini (1 = normal).
   *  Ditampilkan supaya peserta tahu durasinya memang sudah disesuaikan dan
   *  tidak mengira jamnya rusak — dan supaya pengawas bisa memverifikasinya. */
  timeMultiplier?: number;
  /** minta server memulai section dan menetapkan tenggatnya */
  onStartSection: (index: number) => Promise<SectionClock | null>;
  /** tanya sisa waktu ke server — browser tidak dipercaya soal waktu */
  onSync: () => Promise<(SectionClock & { status: string }) | null>;
  onSave: (p: { sectionCode: string; responses: Record<string, ResponseValue> }) => Promise<{ expired?: boolean } | void>;
  /** Simpan sekali lagi saat halaman ditutup, memakai `keepalive` supaya
   *  permintaannya tetap terkirim walau tab sudah pergi. Autosave berjalan
   *  tiap 15 detik, jadi tanpa ini jawaban 15 detik terakhir hilang setiap
   *  kali peserta menutup tab, berpindah aplikasi, atau peramban di ponsel
   *  membuang halamannya dari memori. */
  onFlush?: (p: { sectionCode: string; responses: Record<string, ResponseValue> }) => void;
  onProctorEvent?: (type: string, detail?: string) => void;
  onSubmit: (payload: { attemptId: string; responses: Record<string, ResponseValue>; integrity: unknown }) => Promise<void> | void;
}

const fmt = (s: number) => {
  const t = Math.max(0, s);
  const m = Math.floor(t / 60);
  const sec = t % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
};

/** Seberapa sering sisa waktu dicocokkan ulang ke server. */
const SYNC_EVERY_MS = 20_000;
const AUTOSAVE_EVERY_MS = 15_000;

export function ExamPlayer(props: ExamPlayerProps) {
  const { isDemo, examName, studentName, locale, initial } = props;
  const { t, intl, locale: uiLocale } = useI18n();

  /* Soal section berikutnya belum ada di payload awal — server mengirimnya
   * ketika section itu dimulai. Karena itu daftar section disimpan sebagai
   * state, bukan dipakai langsung dari props. */
  const [sections, setSections] = useState<PlayerSection[]>(props.sections);
  const [si, setSi] = useState(Math.min(initial.sectionIndex, props.sections.length - 1));
  const [qi, setQi] = useState(0);
  const [responses, setResponses] = useState<Record<string, ResponseValue>>(
    () => props.savedResponses ?? {},
  );
  const [left, setLeft] = useState(initial.remainingSec);
  const [showTimer, setShowTimer] = useState(true);
  const [navOpen, setNavOpen] = useState(true);
  const [calcOpen, setCalcOpen] = useState(false);
  /* "Tanya guru": soal yang sedang dibuka dikirim ke Exact Canvas (lengkap
   * dengan gambarnya), lalu tab layar murid dibuka supaya ia bisa menyimak
   * pembahasan gurunya. Hanya untuk paket latihan — try out resmi tidak boleh
   * ada bantuan. */
  const [asking, setAsking] = useState<"idle" | "busy" | "done" | "fail">("idle");
  const [askMsg, setAskMsg] = useState("");
  /* Papan guru: layar murid Exact Canvas ditanam di halaman ini (iframe),
   * jadi anak tidak bolak-balik dua aplikasi saat soalnya dibahas. Hanya
   * untuk akun yang berasal dari Canvas (sesinya bisa diterbitkan server);
   * yang lain tetap dibukakan tab Canvas seperti dulu. */
  const [bisaPapan, setBisaPapan] = useState(false);
  const [papan, setPapan] = useState<{ url: string; asal: string } | null>(null);
  const [papanMode, setPapanMode] = useState<"kecil" | "normal" | "penuh">("normal");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [hlMode, setHlMode] = useState(false);
  const [onBreak, setOnBreak] = useState(false);
  const [breakLeft, setBreakLeft] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [started, setStarted] = useState(initial.started);
  const [starting, setStarting] = useState(false);
  const [offline, setOffline] = useState(false);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    if (props.examCode !== "LATIHAN" || isDemo) return;
    let batal = false;
    fetch("/api/latihan/tanya").then((r) => r.json()).then((j) => { if (!batal) setBisaPapan(!!j.papan); }).catch(() => {});
    return () => { batal = true; };
  }, [props.examCode, isDemo]);
  useEffect(() => {
    if (!papan) return;
    const dengar = (e: MessageEvent) => {
      if (e.origin !== papan.asal || !e.data || e.data.t !== "exact-canvas") return;
      /* Guru mulai membahas: panel yang dilipat dibuka lagi supaya coretannya terlihat. */
      if (e.data.apa === "bahas") setPapanMode((m) => (m === "kecil" ? "normal" : m));
    };
    window.addEventListener("message", dengar);
    return () => window.removeEventListener("message", dengar);
  }, [papan]);

  const section = sections[si];
  const question = section?.questions[qi];
  const enteredAt = useRef(Date.now());
  const advancing = useRef(false);

  const proctor = useProctor({
    enabled: !isDemo && started,
    requireFullscreen: !isDemo,
    onEvent: props.onProctorEvent,
  });

  /* ------------------------------------------------- hitung mundur lokal */
  useEffect(() => {
    if (!started || onBreak) return;
    const t = setInterval(() => setLeft((v) => v - 1), 1000);
    return () => clearInterval(t);
  }, [started, onBreak, si]);

  /* --------------------------------------- pencocokan waktu dengan server */
  const sync = useCallback(async () => {
    try {
      const s = await props.onSync();
      setOffline(false);
      if (!s) return;
      setSyncedAt(Date.now());
      if (s.status !== "in_progress") return;
      // server yang menentukan; selisih apa pun dari browser dibuang
      setLeft(s.remainingSec);
      if (s.sectionIndex !== si) { setSi(s.sectionIndex); setQi(0); }
    } catch {
      setOffline(true);
    }
  }, [props, si]);

  useEffect(() => {
    if (!started || onBreak) return;
    const t = setInterval(sync, SYNC_EVERY_MS);
    const onVis = () => { if (!document.hidden) void sync(); };
    window.addEventListener("focus", onVis);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("online", onVis);
    window.addEventListener("offline", () => setOffline(true));
    return () => {
      clearInterval(t);
      window.removeEventListener("focus", onVis);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("online", onVis);
    };
  }, [started, onBreak, sync]);

  /* ------------------------------------------------------ waktu habis */
  useEffect(() => {
    if (left > 0 || !started || onBreak || advancing.current) return;
    advancing.current = true;
    void nextSection(true).finally(() => { advancing.current = false; });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  useEffect(() => {
    if (!onBreak) return;
    const t = setInterval(() => setBreakLeft((v) => {
      if (v <= 1) { setOnBreak(false); return 0; }
      return v - 1;
    }), 1000);
    return () => clearInterval(t);
  }, [onBreak]);

  /* --------------------------------------------------- waktu per soal */
  const stampTime = useCallback(() => {
    if (!question) return;
    const spent = Math.round((Date.now() - enteredAt.current) / 1000);
    enteredAt.current = Date.now();
    setResponses((r) => {
      const cur = r[question.id] ?? blank(question.id);
      return { ...r, [question.id]: { ...cur, visited: true, timeSpentSec: cur.timeSpentSec + spent } };
    });
  }, [question]);

  const goto = useCallback((i: number) => { stampTime(); setQi(i); }, [stampTime]);

  /* ------------------------------------------------------ simpan otomatis */
  const save = useCallback(async () => {
    if (!section) return;
    try {
      const res = await props.onSave({ sectionCode: section.code, responses });
      setOffline(false);
      if (res && "expired" in res && res.expired && !advancing.current) {
        advancing.current = true;
        await nextSection(true);
        advancing.current = false;
      }
    } catch {
      setOffline(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props, section, responses]);

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => void save(), AUTOSAVE_EVERY_MS);
    return () => clearInterval(t);
  }, [started, save]);

  /* Simpan saat halaman ditinggalkan.
   *
   * `pagehide` dipakai, bukan `beforeunload`: Safari dan peramban ponsel
   * sering melewatkan `beforeunload`, dan pada halaman yang masuk bfcache ia
   * tidak pernah menyala sama sekali. `visibilitychange` menangkap perpindahan
   * aplikasi di ponsel, yang justru saat halaman paling mungkin dibuang. */
  const flushRef = useRef<() => void>(() => {});
  flushRef.current = () => {
    if (!started || !section) return;
    props.onFlush?.({ sectionCode: section.code, responses });
  };

  useEffect(() => {
    const onHide = () => flushRef.current();
    const onVisibility = () => { if (document.visibilityState === "hidden") flushRef.current(); };
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  /* -------------------------------------------------------- pintasan */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName?.match(/INPUT|TEXTAREA|SELECT/)) return;
      if (e.key === "ArrowRight") void next();
      if (e.key === "ArrowLeft") prev();
      if (e.key.toLowerCase() === "f") toggleFlag();
      if (e.key.toLowerCase() === "k" && section?.calculatorAllowed) setCalcOpen((v) => !v);
      if (/^[1-5]$/.test(e.key) && question?.type === "mcq_single") {
        const c = question.choices?.[Number(e.key) - 1];
        if (c) setValue(c.id);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  });

  /* ------------------------------------------------------- aksi soal */
  function setValue(v: unknown) {
    if (!question) return;
    setResponses((r) => ({ ...r, [question.id]: { ...(r[question.id] ?? blank(question.id)), raw: v, visited: true } }));
  }
  function toggleFlag() {
    if (!question) return;
    setResponses((r) => {
      const cur = r[question.id] ?? blank(question.id);
      return { ...r, [question.id]: { ...cur, flagged: !cur.flagged } };
    });
  }
  function crossOut(id: string) {
    if (!question) return;
    setResponses((r) => {
      const cur = r[question.id] ?? blank(question.id);
      const list = cur.crossedOut ?? [];
      return { ...r, [question.id]: { ...cur, crossedOut: list.includes(id) ? list.filter((x) => x !== id) : [...list, id] } };
    });
  }

  async function next() {
    if (!section) return;
    if (qi < section.questions.length - 1) goto(qi + 1);
    else await nextSection(false);
  }
  function prev() { if (qi > 0) goto(qi - 1); }

  async function nextSection(auto: boolean) {
    stampTime();
    await save();

    if (si < sections.length - 1) {
      const ns = si + 1;
      const clock = await props.onStartSection(ns);      // server yang menetapkan tenggat
      if (clock?.questions?.length) {
        setSections((prev) => prev.map((s, i) => (i === ns ? { ...s, questions: clock.questions! } : s)));
      }
      setSi(ns);
      setQi(0);
      setLeft(clock?.remainingSec ?? sections[ns].durationSec);
      enteredAt.current = Date.now();
      const brk = section?.breakAfterSec ?? 0;
      if (brk) { setBreakLeft(brk); setOnBreak(true); }
      return;
    }

    if (auto) await doSubmit();
    else setConfirmSubmit(true);
  }

  async function doSubmit() {
    if (submitting) return;
    setSubmitting(true);
    stampTime();
    await props.onSubmit({ attemptId: props.attemptId, responses, integrity: proctor.log });
  }

  async function beginExam() {
    setStarting(true);
    try {
      if (!isDemo) await proctor.enterFullscreen();
      const clock = await props.onStartSection(si);
      if (clock?.questions?.length) {
        setSections((prev) => prev.map((s, i) => (i === si ? { ...s, questions: clock.questions! } : s)));
      }
      setLeft(clock?.remainingSec ?? sections[si].durationSec);
      enteredAt.current = Date.now();
      setStarted(true);
    } finally {
      setStarting(false);
    }
  }

  /* --------------------------------------------------------- turunan */
  const answered = useMemo(
    () => section?.questions.filter((q) => hasValue(responses[q.id]?.raw)).length ?? 0,
    [section, responses],
  );
  const totalAnswered = useMemo(
    () => sections.flatMap((s) => s.questions).filter((q) => hasValue(responses[q.id]?.raw)).length,
    [sections, responses],
  );
  const totalQuestions = sections.reduce((a, s) => a + s.questionCount, 0);

  if (!section || !question) return null;

  if (!started) {
    return (
      <StartGate
        examName={examName}
        studentName={studentName}
        sections={sections}
        isDemo={isDemo}
        busy={starting}
        onStart={beginExam}
        t={t}
      />
    );
  }

  if (onBreak) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="display text-3xl">{t("exam.breakTitle")}</h1>
        <p className="muted">{t("exam.breakBody")}</p>
        <div className="display text-6xl tabular-nums">{fmt(breakLeft)}</div>
        <p className="text-xs muted">{t("exam.breakNote")}</p>
        <button className="btn btn-primary" onClick={() => { setOnBreak(false); setBreakLeft(0); }}>
          {t("exam.breakSkip")}
        </button>
      </div>
    );
  }

  const resp = responses[question.id];
  const hasStimulus = Boolean(question.stimulus);

  return (
    <div className="flex min-h-screen flex-col" style={{ background: "var(--bg)" }}>
      {/* ---------------------------------------------------- header */}
      <header className="flex items-center gap-3 border-b px-4 py-2.5" style={{ background: "var(--bg-elev)" }}>
        <button className="btn btn-ghost !px-2" onClick={() => setNavOpen((v) => !v)} aria-label={t("exam.questionList")}>
          <LayoutGrid size={16} />
        </button>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{section.name}</div>
          <div className="text-[11px] muted">{examName}{isDemo ? ` · ${t("exam.startGateDemo")}` : ""}</div>
        </div>

        <div className="mx-auto flex flex-col items-center">
          {showTimer ? (
            /* role="timer" membuatnya dikenali sebagai jam, dan aria-label
             * memberinya nama — tanpa itu pembaca layar hanya membacakan
             * «34:12» tanpa keterangan apa pun.
             *
             * Sengaja TIDAK aria-live: angkanya berubah tiap detik, dan
             * mengumumkannya tiap detik akan menenggelamkan segala hal lain
             * yang ingin didengar peserta. Pengumuman hanya pada ambang,
             * lihat elemen di bawahnya. */
            <div role="timer" aria-label={t("exam.timeLeftLabel")}
              className={`display text-2xl tabular-nums ${left < 300 ? "animate-pulse" : ""}`}
              style={{ color: left < 300 ? "var(--danger)" : "var(--fg)" }}>
              {fmt(left)}
            </div>
          ) : (
            <div className="h-8" />
          )}

          {/* Peringatan ambang: sekali pada 5 menit, sekali pada 1 menit.
              Ambang yang sama dengan denyut merah yang dilihat peserta awas,
              sehingga keduanya memperoleh isyarat yang setara. */}
          <span className="sr-only" aria-live="polite">
            {left <= 60 ? t("exam.timeWarning", { n: 1 })
              : left <= 300 ? t("exam.timeWarning", { n: 5 })
              : ""}
          </span>
          {/* Peserta berakomodasi melihat durasi yang berbeda dari temannya.
              Tanpa penanda ini ia bisa mengira jamnya salah. */}
          {(props.timeMultiplier ?? 1) !== 1 && (
            <span className="chip mt-0.5 text-[10px]" title="Akomodasi waktu tambahan">
              {String(props.timeMultiplier).replace(".", ",")}× waktu
            </span>
          )}
          <button className="flex items-center gap-1 text-[11px] muted hover:underline" onClick={() => setShowTimer((v) => !v)}>
            {showTimer ? <EyeOff size={11} /> : <Eye size={11} />}
            {showTimer ? t("exam.hideTime") : t("exam.showTime")}
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {offline && (
            <span className="chip" style={{ color: "var(--warn)" }} title={t("exam.offlineHint")}>
              <WifiOff size={12} /> {t("exam.offline")}
            </span>
          )}
          {hasStimulus && (
            <button className={`btn btn-ghost !px-2 ${hlMode ? "!bg-[var(--accent-soft)]" : ""}`}
              onClick={() => setHlMode((v) => !v)} title={t("exam.highlighter")}>
              <Highlighter size={16} />
            </button>
          )}
          {section.formulaSheet && (
            <button className="btn btn-ghost !px-2" onClick={() => setSheetOpen(true)} title={t("exam.formulaSheet")}>
              <BookOpen size={16} />
            </button>
          )}
          {props.examCode === "LATIHAN" && question && (
            <button className={`btn btn-ghost !px-2 ${asking === "done" ? "!bg-[var(--accent-soft)]" : ""}`}
              disabled={asking === "busy"}
              title={askMsg || t("exam.askTeacher")}
              onClick={async () => {
                setAsking("busy"); setAskMsg(t("exam.asking"));
                /* Tab dibuka SEBELUM await: peramban ponsel memblokir window.open
                 * yang tidak lagi berada di dalam gestur klik. Kalau papan guru
                 * bisa ditanam di sini, tidak ada tab yang perlu dibuka. */
                const tab = bisaPapan ? null : window.open("", "_blank");
                try {
                  const r = await fetch("/api/latihan/tanya", {
                    method: "POST", headers: { "content-type": "application/json" },
                    body: JSON.stringify({ attemptId: props.attemptId, questionId: question.id, number: qi + 1 }),
                  });
                  const j = await r.json();
                  if (j.papan) {
                    tab?.close();
                    /* Iframe yang sudah hidup dibiarkan (sesinya sama); cuma dibuka lagi kalau terlipat. */
                    setPapan((p) => p ?? { url: j.papan, asal: new URL(j.papan).origin });
                    setPapanMode((m) => (m === "kecil" ? "normal" : m));
                    setAsking("done"); setAskMsg(t("exam.askedBoard"));
                  } else if (j.url) { if (tab) tab.location.href = j.url; else window.open(j.url, "_blank"); setAsking("done"); setAskMsg(t("exam.asked")); }
                  else { tab?.close(); setAsking("fail"); setAskMsg(j.error || "Gagal"); }
                } catch { tab?.close(); setAsking("fail"); setAskMsg("Gagal menghubungi server"); }
              }}>
              <MessageCircleQuestion size={16} />
              <span className="hidden sm:inline text-xs">{asking === "idle" ? t("exam.askTeacher") : askMsg}</span>
            </button>
          )}
          {section.calculatorAllowed && (
            <button className={`btn btn-ghost !px-2 ${calcOpen ? "!bg-[var(--accent-soft)]" : ""}`}
              onClick={() => setCalcOpen((v) => !v)} title={`${t("exam.calculator")} (K)`}>
              <CalcIcon size={16} />
            </button>
          )}
          {!isDemo && (
            <span className="chip" title={`Skor integritas ${proctor.log.integrityScore}`}>
              <ShieldCheck size={12} /> {proctor.log.integrityScore}
            </span>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* ------------------------------------------- side navigator */}
        {navOpen && (
          /* Di ponsel daftar soal muncul sebagai LACI MELAYANG, bukan kolom.
           *
           * Lebar tetap 240 px memakan dua pertiga layar 360 px, menyisakan
           * ruang baca yang lebih sempit daripada soalnya sendiri. Sebagai laci
           * ia menutupi konten sementara, lalu ditutup dengan mengetuk latar —
           * sedangkan di layar lebar perilakunya tidak berubah sama sekali. */
          <div
            className="fixed inset-0 z-40 bg-black/40 md:hidden"
            onClick={() => setNavOpen(false)}
            aria-hidden
          />
        )}
        {navOpen && (
          <nav className="fixed inset-y-0 left-0 z-50 w-64 shrink-0 overflow-y-auto border-r p-3 md:static md:z-auto md:w-60"
            style={{ background: "var(--bg-elev)" }}>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider muted">{t("exam.questionList")}</div>
            <div className="grid grid-cols-5 gap-1.5">
              {section.questions.map((q, i) => {
                const r = responses[q.id];
                const cur = i === qi;
                const done = hasValue(r?.raw);
                return (
                  <button
                    key={q.id}
                    onClick={() => goto(i)}
                    className="relative flex h-9 items-center justify-center rounded-lg border text-xs font-medium"
                    style={{
                      background: cur ? "var(--accent)" : done ? "var(--accent-soft)" : "transparent",
                      color: cur ? "var(--accent-fg)" : "var(--fg)",
                      borderColor: cur ? "transparent" : done ? "transparent" : "var(--border-strong)",
                      borderStyle: r?.visited && !done ? "dashed" : "solid",
                    }}
                    aria-current={cur}
                  >
                    {i + 1}
                    {r?.flagged && (
                      <Flag size={9} className="absolute -right-0.5 -top-0.5" style={{ color: "var(--warn)", fill: "var(--warn)" }} />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 space-y-1.5 text-[11px] muted">
              <Legend color="var(--accent)" label={t("exam.legendCurrent")} />
              <Legend color="var(--accent-soft)" label={t("exam.legendAnswered")} />
              <Legend color="transparent" label={t("exam.legendUnanswered")} border />
              <Legend color="var(--warn)" label={t("exam.legendFlagged")} />
            </div>

            <div className="mt-5 rounded-lg p-3 text-xs" style={{ background: "var(--bg-sunken)" }}>
              <div className="flex justify-between"><span className="muted">{t("exam.thisSection")}</span><span>{answered}/{section.questions.length}</span></div>
              <div className="mt-1 flex justify-between"><span className="muted">{t("exam.overall")}</span><span>{totalAnswered}/{totalQuestions}</span></div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--border)" }}>
                <div className="h-full rounded-full" style={{ width: `${(totalAnswered / totalQuestions) * 100}%`, background: "var(--accent)" }} />
              </div>
              {syncedAt && (
                <div className="mt-2 text-[10px] muted">
                  {t("exam.syncedAt", { time: new Date(syncedAt).toLocaleTimeString(intl) })}
                </div>
              )}
            </div>

            <div className="mt-4 space-y-1">
              {sections.map((s, i) => (
                <div key={s.code} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px]"
                  style={{ background: i === si ? "var(--accent-soft)" : "transparent", opacity: i < si ? 0.5 : 1 }}>
                  <span className="flex h-4 w-4 items-center justify-center rounded-full text-[9px]"
                    style={{ background: i < si ? "var(--ok)" : i === si ? "var(--accent)" : "var(--border)", color: "var(--accent-fg)" }}>
                    {i + 1}
                  </span>
                  <span className="truncate">{s.name}</span>
                </div>
              ))}
            </div>
          </nav>
        )}

        {/* ---------------------------------------------------- konten */}
        {/* Bacaan dan soal BERDAMPINGAN di layar lebar, MENUMPUK di ponsel.
         *
         * Dua kolom `w-1/2` pada layar 360 px menyisakan sekitar 116 px teks
         * setelah dikurangi padding — satu sampai dua kata per baris. Menumpuk
         * ke bawah mengembalikan lebar baca penuh, dan masing-masing bagian
         * tetap punya gulirannya sendiri sehingga bacaan bisa ditelusuri tanpa
         * kehilangan pilihan jawaban dari layar. */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          {hasStimulus ? (
            <>
              <section className="h-2/5 w-full shrink-0 overflow-y-auto border-b px-4 py-5 md:h-auto md:w-1/2 md:shrink md:border-b-0 md:border-r md:px-8 md:py-6">
                <Stimulus q={question} hlMode={hlMode} />
              </section>
              <section className="flex-1 overflow-y-auto px-4 py-5 md:w-1/2 md:flex-none md:px-8 md:py-6">
                <QHead index={qi} flagged={resp?.flagged} onFlag={toggleFlag} difficulty={question.difficulty} t={t} />
                <QuestionView
                  question={question}
                  value={resp?.raw}
                  onChange={setValue}
                  crossedOut={resp?.crossedOut}
                  onCrossOut={crossOut}
                  locale={locale ?? uiLocale}
                />
              </section>
            </>
          ) : (
            <section className="mx-auto w-full max-w-3xl overflow-y-auto px-4 py-5 md:px-8 md:py-6">
              <QHead index={qi} flagged={resp?.flagged} onFlag={toggleFlag} difficulty={question.difficulty} t={t} />
              <QuestionView
                question={question}
                value={resp?.raw}
                onChange={setValue}
                crossedOut={resp?.crossedOut}
                onCrossOut={crossOut}
                locale={locale}
              />
            </section>
          )}
        </main>
        {papan && (
          <PapanGuru url={papan.url} mode={papanMode} onMode={setPapanMode} onTutup={() => setPapan(null)} t={t} />
        )}
        </div>
      </div>

      {/* ---------------------------------------------------- footer */}
      <footer className="flex items-center gap-3 border-t px-4 py-2.5" style={{ background: "var(--bg-elev)" }}>
        <span className="truncate text-sm font-medium">{studentName}</span>
        <div className="mx-auto flex items-center gap-2 text-sm">
          <Clock size={13} className="muted" />
          <span className="muted">{t("exam.questionOf", { n: qi + 1, total: section.questions.length })}</span>
        </div>
        <button className="btn btn-ghost" onClick={prev} disabled={qi === 0}>
          <ChevronLeft size={16} /> {t("common.back")}
        </button>
        {si === sections.length - 1 && qi === section.questions.length - 1 ? (
          <button className="btn btn-primary" onClick={() => setConfirmSubmit(true)}>{t("exam.finish")}</button>
        ) : (
          <button className="btn btn-primary" onClick={() => void next()}>
            {t("common.next")} <ChevronRight size={16} />
          </button>
        )}
      </footer>

      {calcOpen && <Calculator onClose={() => setCalcOpen(false)} />}
      {sheetOpen && <FormulaSheet sheetId={section.formulaSheet} onClose={() => setSheetOpen(false)} />}

      {proctor.needsFullscreen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,.75)" }}>
          <div className="card max-w-md p-6 text-center">
            <AlertTriangle size={28} className="mx-auto mb-3" style={{ color: "var(--warn)" }} />
            <h2 className="mb-1 text-lg font-semibold">{t("exam.fsTitle")}</h2>
            <p className="mb-4 text-sm muted">
              {t("exam.fsBody")}
            </p>
            <button className="btn btn-primary w-full" onClick={proctor.enterFullscreen}>
              <Maximize size={16} /> {t("exam.fsButton")}
            </button>
          </div>
        </div>
      )}

      {confirmSubmit && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,.55)" }}>
          <div className="card max-w-md p-6">
            <h2 className="mb-2 text-lg font-semibold">{t("exam.submitTitle")}</h2>
            <p className="mb-4 text-sm muted">
              {t("exam.submitBody", { answered: totalAnswered, total: totalQuestions })}
              {totalAnswered < totalQuestions && ` ${t("exam.submitBlankWarn")}`}
            </p>
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1" onClick={() => setConfirmSubmit(false)}>{t("exam.submitCheck")}</button>
              <button className="btn btn-primary flex-1" onClick={() => void doSubmit()} disabled={submitting}>
                {submitting ? <><Loader2 size={15} className="animate-spin" /> {t("exam.submitting")}</> : t("exam.submitConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ bagian kecil */

function QHead({ index, flagged, onFlag, difficulty, t }: { index: number; flagged?: boolean; onFlag: () => void; difficulty: string; t: (k: never, p?: Record<string, string | number>) => string }) {
  return (
    <div className="mb-4 flex items-center gap-2 border-b pb-2.5">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold"
        style={{ background: "var(--fg)", color: "var(--bg)" }}>{index + 1}</span>
      <button onClick={onFlag} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs hover:bg-[var(--bg-sunken)]"
        style={{ color: flagged ? "var(--warn)" : "var(--fg-muted)" }}>
        <Flag size={13} style={{ fill: flagged ? "var(--warn)" : "none" }} />
        {flagged ? t("exam.flagged" as never) : t("exam.flag" as never)}
      </button>
      <span className="chip ml-auto">{{ E: t("common.easy" as never), M: t("common.medium" as never), H: t("common.hard" as never) }[difficulty] ?? difficulty}</span>
    </div>
  );
}

/* Sorotan disimpan sebagai rentang KARAKTER di dalam teks bacaan.
 *
 * Dua kesalahan yang sudah dilewati, keduanya layak dicatat:
 *
 * 1. `range.surroundContents()` melempar galat begitu seleksi melewati batas
 *    elemen — menyeret melintasi dua kalimat yang dipisah <em> sudah cukup —
 *    dan `catch` di bawahnya menelannya, sehingga menyorot tampak «tidak
 *    terjadi apa-apa» tanpa penjelasan apa pun.
 * 2. Penggantinya memasang <mark> dengan menyunting DOM setelah React
 *    merender. Sorotannya muncul — kuning, benar — lalu lenyap pada render
 *    berikutnya, karena bagi React bagian itu masih persis seperti terakhir
 *    kali ia menuliskannya.
 *
 * Sekarang offset-nya diteruskan ke RichText dan <mark> disisipkan ke dalam
 * HTML sebelum React merender. React yang memiliki sorotan itu, jadi tidak ada
 * render yang bisa menghapusnya. Logikanya murni dan diuji di
 * lib/exams/highlight.ts.
 */
const KOSONG: Span[] = [];

/** Ubah seleksi peserta menjadi offset karakter di dalam teks bacaan.
 *
 *  Diukur dengan rentang bantu, bukan dengan mencocokkan `range.startContainer`
 *  ke daftar simpul teks. Pencocokan itu gagal justru pada kasus tersering:
 *  saat peserta menyeret melintasi seluruh paragraf atau mengeklik tiga kali,
 *  peramban menyetel container-nya ke ELEMEN <p>, bukan ke simpul teks di
 *  dalamnya. */
function spanOfSelection(root: HTMLElement, range: Range): Span | null {
  const sebelum = document.createRange();
  sebelum.selectNodeContents(root);
  try {
    sebelum.setEnd(range.startContainer, range.startOffset);
  } catch {
    return null;                       // seleksi bermula di luar bacaan
  }
  const start = sebelum.toString().length;
  const end = start + range.toString().length;
  return end > start ? { start, end } : null;
}

const Stimulus = memo(function Stimulus({ q, hlMode }: { q: Question; hlMode: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  /* Per soal, supaya berpindah soal lalu kembali tidak menghapus sorotan. */
  const [spans, setSpans] = useState<Record<string, Span[]>>({});
  /* Referensi stabil supaya useMemo di RichText tidak menghitung ulang
   * seluruh HTML setiap render. */
  const milikSoal = useMemo(() => spans[q.id] ?? KOSONG, [spans, q.id]);

  function highlight() {
    if (!hlMode || !ref.current) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!ref.current.contains(range.commonAncestorContainer)) return;

    const span = spanOfSelection(ref.current, range);
    sel.removeAllRanges();
    if (!span) return;

    setSpans((prev) => {
      const ada = prev[q.id] ?? [];
      /* Menyorot ulang bagian yang sudah disorot berarti menghapusnya —
       * itu cara peserta membatalkan tanpa perlu tombol tersendiri. */
      const tumpang = ada.find((s) => s.start < span.end && span.start < s.end);
      const berikut = tumpang
        ? ada.filter((s) => s !== tumpang)
        : [...ada, span];
      return { ...prev, [q.id]: berikut };
    });
  }

  return (
    <div>
      {q.stimulus?.title && <h2 className="display mb-2 text-lg">{q.stimulus.title}</h2>}
      <div ref={ref} onMouseUp={highlight} className={`passage ${hlMode ? "cursor-text" : ""}`}>
        <RichText highlights={milikSoal}>{q.stimulus?.content ?? ""}</RichText>
      </div>
      {q.stimulus?.source && <p className="mt-3 text-xs muted">{q.stimulus.source}</p>}
    </div>
  );
});

function Legend({ color, label, border }: { color: string; label: string; border?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-3.5 w-3.5 rounded" style={{ background: color, border: border ? "1px dashed var(--border-strong)" : "none" }} />
      {label}
    </div>
  );
}

function StartGate({ examName, studentName, sections, isDemo, busy, onStart, t }: {
  examName: string; studentName: string; sections: PlayerSection[];
  isDemo?: boolean; busy: boolean; onStart: () => void;
  t: (k: never, p?: Record<string, string | number>) => string;
}) {
  const total = sections.reduce((a, s) => a + s.durationSec, 0);
  const count = sections.reduce((a, s) => a + s.questionCount, 0);
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="card w-full max-w-lg p-7 rise">
        <div className="chip mb-3">{isDemo ? t("exam.startGateDemo" as never) : t("exam.startGateProctored" as never)}</div>
        <h1 className="display mb-1 text-2xl">{examName}</h1>
        <p className="mb-5 text-sm muted">{t("exam.candidate" as never)}: {studentName}</p>

        <dl className="mb-5 grid grid-cols-3 gap-3 text-center">
          <Stat label={t("exam.sections" as never)} value={String(sections.length)} />
          <Stat label={t("common.questions" as never)} value={String(count)} />
          <Stat label={t("exam.duration" as never)} value={`${Math.round(total / 60)} m`} />
        </dl>

        <ul className="mb-6 space-y-2 text-sm muted">
          <li>• {t("exam.rule.clock" as never)}</li>
          {!isDemo && <li>• {t("exam.rule.fullscreen" as never)}</li>}
          {!isDemo && <li>• {t("exam.rule.proctor" as never)}</li>}
          <li>• {t("exam.rule.autosave" as never)}</li>
          <li>• {t("exam.rule.startsNow" as never)}</li>
        </ul>

        <button className="btn btn-primary w-full" onClick={onStart} disabled={busy}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Maximize size={16} />} {t("exam.start" as never)}
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-3 py-3" style={{ background: "var(--bg-sunken)" }}>
      <div className="display text-xl">{value}</div>
      <div className="text-[11px] muted">{label}</div>
    </div>
  );
}

const blank = (id: string): ResponseValue => ({ questionId: id, raw: null, flagged: false, crossedOut: [], timeSpentSec: 0, visited: false });

function hasValue(v: unknown) {
  if (v === null || v === undefined || v === "") return false;
  if (Array.isArray(v)) return v.some((x) => x !== null && x !== undefined && x !== "");
  if (typeof v === "object") return Object.values(v as object).some((x) => x !== null && x !== undefined && x !== "");
  return true;
}
