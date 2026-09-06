//! Kelas langsung: murid masuk dengan nama dari HP, angkat tangan atau kirim
//! pertanyaan berfoto, guru membahasnya dari Mac atau tablet.
//!
//! Semua data di SQLite vault (tabel `students`, `groups`, `questions`); foto
//! di `vault/tanya/`. Server hanya menulis dan menyiarkan kabar `data:kelas`
//! supaya panel di Mac/tablet dan layar HP menyegarkan diri. Foto dan
//! pertanyaan dihapus otomatis setelah 24 jam — ini antrian, bukan arsip.

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};

use crate::server::{sah, tolak, Hub, QueryPin};
use crate::vault;

const UMUR_FOTO_MS: i64 = 24 * 60 * 60 * 1000;

/* ── Anti-spam ─────────────────────────────────────────────────────── */

/// Jeda minimum antar pertanyaan dari satu murid.
const JEDA_TANYA_MS: i64 = 20_000;
/// Paling banyak sekian pertanyaan per murid dalam sepuluh menit.
const KUOTA_TANYA: i64 = 6;
const JENDELA_KUOTA_MS: i64 = 10 * 60 * 1000;
/// Permintaan endpoint kelas per alamat per menit; di atas ini ditolak.
const BATAS_PER_ALAMAT: u32 = 90;

static HITUNG_ALAMAT: std::sync::Mutex<Option<std::collections::HashMap<String, (u32, std::time::Instant)>>> =
    std::sync::Mutex::new(None);

fn alamat_klien(headers: &HeaderMap) -> String {
    for nama in ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"] {
        if let Some(v) = headers.get(nama).and_then(|v| v.to_str().ok()) {
            let pertama = v.split(',').next().unwrap_or("").trim();
            if !pertama.is_empty() {
                return pertama.to_string();
            }
        }
    }
    "lokal".into()
}

/// Terlalu sering dari satu alamat → 429. Satu HP normal mengirim beberapa
/// permintaan per menit; skrip yang membanjiri mengirim ratusan.
fn kebanjiran(headers: &HeaderMap) -> bool {
    let asal = alamat_klien(headers);
    let mut g = HITUNG_ALAMAT.lock().unwrap_or_else(|e| e.into_inner());
    let peta = g.get_or_insert_with(std::collections::HashMap::new);
    let kini = std::time::Instant::now();
    let jumlah = {
        let masuk = peta.entry(asal).or_insert((0, kini));
        if kini.duration_since(masuk.1).as_secs() >= 60 {
            *masuk = (0, kini);
        }
        masuk.0 += 1;
        masuk.0
    };
    if peta.len() > 5000 {
        peta.retain(|_, (_, t)| kini.duration_since(*t).as_secs() < 60);
    }
    jumlah > BATAS_PER_ALAMAT
}

fn terlalu_sering() -> Response {
    (StatusCode::TOO_MANY_REQUESTS, "Too many requests — slow down.").into_response()
}

fn sekarang() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

fn id_baru(awalan: &str) -> String {
    let n = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0);
    format!("{awalan}_{:x}", n)
}

fn koneksi() -> Result<rusqlite::Connection, String> {
    let c = rusqlite::Connection::open(vault::db_path()).map_err(|e| e.to_string())?;
    c.busy_timeout(std::time::Duration::from_millis(15000)).map_err(|e| e.to_string())?;
    Ok(c)
}

/// Kabari semua klien bahwa data kelas berubah (bentuknya sama dengan siaran
/// `pancarkan('kelas')` dari sisi depan, jadi pendengar yang sama yang menangkap).
fn kabari(hub: &Hub, apa: &str, payload: Value) {
    let _ = hub.tx.send(json!({ "t": "data", "kanal": "kelas", "payload": { "apa": apa, "isi": payload } }).to_string());
}

/* ── Murid masuk ───────────────────────────────────────────────────── */

#[derive(Deserialize)]
pub struct Masuk {
    pub murid: String,
    pub nama: String,
    pub ruang: i64,
}

pub async fn api_masuk(State(hub): State<Arc<Hub>>, headers: HeaderMap, Json(m): Json<Masuk>) -> Response {
    if !sah(&hub, &headers, None) {
        return tolak();
    }
    if kebanjiran(&headers) {
        return terlalu_sering();
    }
    let nama = m.nama.trim().chars().take(40).collect::<String>();
    if nama.is_empty() || m.murid.is_empty() {
        return (StatusCode::BAD_REQUEST, "Name is required.").into_response();
    }
    let hasil = tokio::task::spawn_blocking(move || -> Result<(), String> {
        let c = koneksi()?;
        let kini = sekarang();
        c.execute(
            "INSERT INTO students (id, name, room, first_seen, last_seen) VALUES (?1, ?2, ?3, ?4, ?4)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, room = excluded.room, last_seen = excluded.last_seen",
            rusqlite::params![m.murid, nama, m.ruang.clamp(1, 9), kini],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    })
    .await;
    match hasil {
        Ok(Ok(())) => {
            kabari(&hub, "masuk", Value::Null);
            StatusCode::NO_CONTENT.into_response()
        }
        Ok(Err(e)) => (StatusCode::BAD_REQUEST, e).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/* ── Apa yang harus diikuti murid ini ──────────────────────────────── */

#[derive(Deserialize)]
pub struct QuerySaya {
    pub murid: String,
    pub pin: Option<String>,
}

/// Grup tempat murid ini berada (kalau ada) beserta targetnya, dan
/// pertanyaannya yang masih terbuka — semua yang dibutuhkan HP untuk
/// memutuskan siapa yang diikuti dan apa yang ditampilkan di bilah bawah.
pub async fn api_saya(State(hub): State<Arc<Hub>>, headers: HeaderMap, Query(q): Query<QuerySaya>) -> Response {
    if !sah(&hub, &headers, q.pin.as_deref()) {
        return tolak();
    }
    let murid = q.murid.clone();
    let hasil = tokio::task::spawn_blocking(move || -> Result<Value, String> {
        let c = koneksi()?;
        let _ = c.execute("UPDATE students SET last_seen = ?1 WHERE id = ?2", rusqlite::params![sekarang(), murid]);
        let grup: Option<(String, String, Option<String>)> = c
            .query_row(
                "SELECT g.id, g.name, g.target FROM groups g JOIN group_members m ON m.group_id = g.id WHERE m.student_id = ?1 ORDER BY g.sort_order LIMIT 1",
                rusqlite::params![murid],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .ok();
        let tanya: Option<(String, String, i64, Option<String>)> = c
            .query_row(
                "SELECT id, status, created_at, text FROM questions WHERE student_id = ?1 AND status != 'selesai' ORDER BY created_at DESC LIMIT 1",
                rusqlite::params![murid],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
            )
            .ok();
        // Nomor antrean: berapa yang menunggu lebih dulu.
        let urutan: Option<i64> = tanya.as_ref().and_then(|t| {
            c.query_row(
                "SELECT COUNT(*) FROM questions WHERE status = 'menunggu' AND created_at < ?1",
                rusqlite::params![t.2],
                |r| r.get(0),
            )
            .ok()
        });
        Ok(json!({
            "grup": grup.map(|(id, nama, target)| json!({ "id": id, "nama": nama, "target": target })),
            "tanya": tanya.map(|(id, status, dibuat, teks)| json!({ "id": id, "status": status, "dibuat": dibuat, "teks": teks, "urutan": urutan.map(|u| u + 1) })),
        }))
    })
    .await;
    match hasil {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => (StatusCode::BAD_REQUEST, e).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/* ── Pertanyaan ────────────────────────────────────────────────────── */

#[derive(Deserialize)]
pub struct Tanya {
    pub murid: String,
    pub nama: String,
    pub ruang: i64,
    #[serde(default)]
    pub teks: String,
    /// Data URL JPEG yang sudah diperkecil di HP; boleh kosong (angkat tangan).
    #[serde(default)]
    pub foto: String,
}

pub async fn api_tanya(State(hub): State<Arc<Hub>>, headers: HeaderMap, Json(t): Json<Tanya>) -> Response {
    if !sah(&hub, &headers, None) {
        return tolak();
    }
    if kebanjiran(&headers) {
        return terlalu_sering();
    }
    let hasil = tokio::task::spawn_blocking(move || -> Result<Value, String> {
        let c = koneksi()?;
        let id = id_baru("tny");
        let kini = sekarang();

        // ── anti-spam per murid
        let dibisukan: Option<i64> = c
            .query_row("SELECT muted_until FROM students WHERE id = ?1", rusqlite::params![t.murid], |r| r.get(0))
            .ok()
            .flatten();
        if let Some(sampai) = dibisukan {
            if sampai > kini {
                let menit = ((sampai - kini) as f64 / 60_000.0).ceil() as i64;
                return Err(format!("MUTED:The teacher muted questions from you for {menit} more min."));
            }
        }
        let terakhir: Option<i64> = c
            .query_row("SELECT MAX(created_at) FROM questions WHERE student_id = ?1", rusqlite::params![t.murid], |r| r.get(0))
            .ok()
            .flatten();
        if let Some(tk) = terakhir {
            if kini - tk < JEDA_TANYA_MS {
                let sisa = ((JEDA_TANYA_MS - (kini - tk)) as f64 / 1000.0).ceil() as i64;
                return Err(format!("TUNGGU:{sisa}:Please wait {sisa} s before asking again."));
            }
        }
        let dalam_10_menit: i64 = c
            .query_row(
                "SELECT COUNT(*) FROM questions WHERE student_id = ?1 AND created_at > ?2",
                rusqlite::params![t.murid, kini - JENDELA_KUOTA_MS],
                |r| r.get(0),
            )
            .unwrap_or(0);
        if dalam_10_menit >= KUOTA_TANYA {
            return Err("TUNGGU:120:That's a lot of questions in a row — take a breath and try again in a couple of minutes.".into());
        }
        // Sudah antre tanpa membawa hal baru: jangan tambah antrean, cukup katakan posisinya.
        let terbuka: Option<(String, i64)> = c
            .query_row(
                "SELECT status, created_at FROM questions WHERE student_id = ?1 AND status != 'selesai' ORDER BY created_at DESC LIMIT 1",
                rusqlite::params![t.murid],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .ok();
        if let Some((status, dibuat)) = &terbuka {
            if status == "menunggu" && t.teks.trim().is_empty() && t.foto.is_empty() {
                let urutan: i64 = c
                    .query_row("SELECT COUNT(*) FROM questions WHERE status = 'menunggu' AND created_at < ?1", rusqlite::params![dibuat], |r| r.get(0))
                    .unwrap_or(0);
                return Err(format!("ANTRE:You're already in the queue, #{}. The teacher will get to you.", urutan + 1));
            }
        }
        let mut nama_foto: Option<String> = None;
        if !t.foto.is_empty() {
            let (mime, bytes) = crate::server::dekode_data_url(&t.foto).ok_or("Attachment is not a data URL.")?;
            let pdf = mime.contains("pdf");
            // Foto sudah diperkecil di HP; PDF boleh lebih besar, tapi tetap ada pagarnya.
            if bytes.len() > if pdf { 40 * 1024 * 1024 } else { 4 * 1024 * 1024 } {
                return Err(if pdf { "PDF is too large (max 40 MB)." } else { "Photo is too large." }.into());
            }
            let ext = if pdf { "pdf" } else if mime.contains("png") { "png" } else { "jpg" };
            let nama = format!("{id}.{ext}");
            std::fs::create_dir_all(vault::tanya_dir()).map_err(|e| e.to_string())?;
            std::fs::write(vault::tanya_dir().join(&nama), bytes).map_err(|e| e.to_string())?;
            nama_foto = Some(nama);
        }
        let teks = t.teks.trim().chars().take(400).collect::<String>();
        // Satu murid satu pertanyaan terbuka: yang lama ditutup dulu.
        let _ = c.execute(
            "UPDATE questions SET status = 'selesai', handled_at = ?1 WHERE student_id = ?2 AND status != 'selesai'",
            rusqlite::params![kini, t.murid],
        );
        c.execute(
            "INSERT INTO questions (id, student_id, name, room, text, photo, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'menunggu', ?7)",
            rusqlite::params![id, t.murid, t.nama.trim().chars().take(40).collect::<String>(), t.ruang, if teks.is_empty() { None } else { Some(teks.clone()) }, nama_foto, kini],
        )
        .map_err(|e| e.to_string())?;
        Ok(json!({ "id": id, "nama": t.nama, "ruang": t.ruang, "teks": teks, "foto": nama_foto.is_some() }))
    })
    .await;
    match hasil {
        Ok(Ok(v)) => {
            kabari(&hub, "tanya", v.clone());
            Json(v).into_response()
        }
        // Penolakan anti-spam dibedakan kodenya supaya HP bisa menampilkan
        // hitung mundur, bukan sekadar "gagal".
        Ok(Err(e)) if e.starts_with("TUNGGU:") => (StatusCode::TOO_MANY_REQUESTS, e).into_response(),
        Ok(Err(e)) if e.starts_with("ANTRE:") => (StatusCode::CONFLICT, e).into_response(),
        Ok(Err(e)) if e.starts_with("MUTED:") => (StatusCode::FORBIDDEN, e).into_response(),
        Ok(Err(e)) => (StatusCode::BAD_REQUEST, e).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

#[derive(Deserialize)]
pub struct UbahTanya {
    pub id: String,
    /// 'dibahas' | 'selesai'
    pub status: String,
    /// Id klien editor yang membahas — HP murid langsung mengikutinya.
    #[serde(default)]
    pub editor: Option<String>,
    /// Kanvas tempat pertanyaan ini dibahas; HP murid dipaku ke sana.
    #[serde(default)]
    pub sketsa: Option<String>,
}

/// Guru membuka ("dibahas") atau menutup pertanyaan. Saat dibuka, HP murid
/// itu — dan anggota grupnya — diberi kabar supaya berbunyi.
pub async fn api_ubah_tanya(State(hub): State<Arc<Hub>>, headers: HeaderMap, Json(u): Json<UbahTanya>) -> Response {
    if !sah(&hub, &headers, None) {
        return tolak();
    }
    if u.status != "dibahas" && u.status != "selesai" {
        return (StatusCode::BAD_REQUEST, "Unknown status.").into_response();
    }
    let hasil = tokio::task::spawn_blocking(move || -> Result<Value, String> {
        let c = koneksi()?;
        let kini = sekarang();
        c.execute(
            "UPDATE questions SET status = ?1, handled_at = ?2 WHERE id = ?3",
            rusqlite::params![u.status, kini, u.id],
        )
        .map_err(|e| e.to_string())?;
        let (murid, nama): (String, String) = c
            .query_row("SELECT student_id, name FROM questions WHERE id = ?1", rusqlite::params![u.id], |r| Ok((r.get(0)?, r.get(1)?)))
            .map_err(|e| e.to_string())?;
        // Anggota grup yang sama ikut dikabari: "pertanyaan Dina sedang dibahas".
        let mut anggota: Vec<String> = Vec::new();
        let mut grup: Option<String> = None;
        if let Ok((gid, gnama)) = c.query_row(
            "SELECT g.id, g.name FROM groups g JOIN group_members m ON m.group_id = g.id WHERE m.student_id = ?1 LIMIT 1",
            rusqlite::params![murid],
            |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)),
        ) {
            grup = Some(gnama);
            let mut st = c.prepare("SELECT student_id FROM group_members WHERE group_id = ?1").map_err(|e| e.to_string())?;
            anggota = st
                .query_map(rusqlite::params![gid], |r| r.get::<_, String>(0))
                .map_err(|e| e.to_string())?
                .flatten()
                .collect();
        }
        Ok(json!({ "id": u.id, "status": u.status, "murid": murid, "nama": nama, "grup": grup, "anggota": anggota, "editor": u.editor, "sketsa": u.sketsa }))
    })
    .await;
    match hasil {
        Ok(Ok(v)) => {
            if v["status"] == "dibahas" {
                let _ = hub.tx.send(json!({ "t": "bahas", "tanya": v }).to_string());
            }
            kabari(&hub, "ubah", v.clone());
            Json(v).into_response()
        }
        Ok(Err(e)) => (StatusCode::BAD_REQUEST, e).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// Foto pertanyaan, untuk panel guru dan untuk ditempel ke sketsa.
pub async fn api_foto(State(hub): State<Arc<Hub>>, headers: HeaderMap, Query(q): Query<QueryPin>, Path(nama): Path<String>) -> Response {
    if !sah(&hub, &headers, q.pin.as_deref()) {
        return tolak();
    }
    let Ok(p) = vault::resolve_within(&vault::tanya_dir(), &nama) else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    match std::fs::read(&p) {
        Ok(bytes) => {
            let mime = if nama.ends_with(".pdf") {
                "application/pdf"
            } else if nama.ends_with(".png") {
                "image/png"
            } else {
                "image/jpeg"
            };
            let mut r = Response::new(Body::from(bytes));
            r.headers_mut().insert(header::CONTENT_TYPE, mime.parse().unwrap());
            r.headers_mut().insert(header::CACHE_CONTROL, "private, max-age=86400".parse().unwrap());
            r
        }
        Err(_) => StatusCode::NOT_FOUND.into_response(),
    }
}

/* ── Pembersihan ───────────────────────────────────────────────────── */

/// Buang pertanyaan dan fotonya yang lebih tua dari sehari. Dipanggil saat
/// server menyala dan tiap jam sesudahnya.
pub fn bersihkan() {
    let Ok(c) = koneksi() else { return };
    let batas = sekarang() - UMUR_FOTO_MS;
    if let Ok(mut st) = c.prepare("SELECT photo FROM questions WHERE created_at < ?1 AND photo IS NOT NULL") {
        if let Ok(rows) = st.query_map(rusqlite::params![batas], |r| r.get::<_, String>(0)) {
            for nama in rows.flatten() {
                if let Ok(p) = vault::resolve_within(&vault::tanya_dir(), &nama) {
                    let _ = std::fs::remove_file(p);
                }
            }
        }
    }
    let _ = c.execute("DELETE FROM questions WHERE created_at < ?1", rusqlite::params![batas]);
    // Berkas yatim (baris sudah hilang, berkas tertinggal) ikut dibuang kalau tua.
    if let Ok(entries) = std::fs::read_dir(vault::tanya_dir()) {
        for e in entries.flatten() {
            let tua = e
                .metadata()
                .and_then(|m| m.modified())
                .map(|t| t.elapsed().map(|d| d.as_millis() as i64 > UMUR_FOTO_MS).unwrap_or(false))
                .unwrap_or(false);
            if tua {
                let _ = std::fs::remove_file(e.path());
            }
        }
    }
}
