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

use crate::server::{admin_sah, sah, tolak, Hub, QueryPin};
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

pub fn alamat_klien(headers: &HeaderMap) -> String {
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
pub fn kebanjiran(headers: &HeaderMap) -> bool {
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

pub fn koneksi() -> Result<rusqlite::Connection, String> {
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
            "INSERT INTO students (id, name, room, first_seen, last_seen) VALUES (?1, ?2, 1, ?3, ?3)
             ON CONFLICT(id) DO UPDATE SET name = excluded.name, last_seen = excluded.last_seen",
            rusqlite::params![m.murid, nama, kini],
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
    pub sesi: Option<String>,
}

/// Grup tempat murid ini berada (kalau ada) beserta targetnya, dan
/// pertanyaannya yang masih terbuka — semua yang dibutuhkan HP untuk
/// memutuskan siapa yang diikuti dan apa yang ditampilkan di bilah bawah.
pub async fn api_saya(State(hub): State<Arc<Hub>>, headers: HeaderMap, Query(q): Query<QuerySaya>) -> Response {
    if !crate::server::sah_lengkap(&hub, &headers, q.pin.as_deref(), q.sesi.as_deref(), None) {
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
        let (boleh, sketsa) = izin_murid(&c, &murid);
        // Kanvas yang harus ditampilkan (grup kalau bergrup, sendiri kalau
        // tidak) — beda dari `sketsa` di atas yang cuma terisi kalau boleh
        // mencoret. Ini dipakai HP untuk selalu memaku diri ke kanvasnya
        // sendiri, apa pun yang sedang dibuka guru di tempat lain.
        let kanvas = sketsa_murid(&c, &murid);
        Ok(json!({
            "grup": grup.map(|(id, nama, target)| json!({ "id": id, "nama": nama, "target": target })),
            "tanya": tanya.map(|(id, status, dibuat, teks)| json!({ "id": id, "status": status, "dibuat": dibuat, "teks": teks, "urutan": urutan.map(|u| u + 1) })),
            "boleh": boleh,
            "sketsa": sketsa,
            "kanvas": kanvas,
        }))
    })
    .await;
    match hasil {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => (StatusCode::BAD_REQUEST, e).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/* ── Izin mencoret ─────────────────────────────────────────────────── */

/// Kanvas tempat murid ini boleh menulis: kanvas grupnya kalau ia bergrup,
/// kalau tidak kanvas pribadinya — aturan yang sama dengan "Open on canvas".
/// Hanya kanvas yang masih ada yang dikembalikan.
fn sketsa_murid(c: &rusqlite::Connection, murid: &str) -> Option<String> {
    let ada = |id: &str| -> bool {
        c.query_row("SELECT 1 FROM canvases WHERE id = ?1", rusqlite::params![id], |_| Ok(()))
            .is_ok()
            && vault::canvas_read(id.to_string()).ok().flatten().is_some()
    };
    // Kanvas grup berlaku satu hari: besok grup yang sama mulai di kanvas
    // baru, materi kemarin tetap bisa dibuka dari daftar sketsa.
    let grup: Option<(Option<String>, Option<String>)> = c
        .query_row(
            "SELECT g.sketch_id, g.sketch_day FROM groups g JOIN group_members m ON m.group_id = g.id WHERE m.student_id = ?1 ORDER BY g.sort_order LIMIT 1",
            rusqlite::params![murid],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .ok();
    if let Some((sketsa, hari)) = grup {
        return sketsa.filter(|s| hari.as_deref() == Some(hari_ini().as_str()) && ada(s));
    }
    let sendiri: Option<String> = c
        .query_row("SELECT sketch_id FROM students WHERE id = ?1", rusqlite::params![murid], |r| r.get::<_, Option<String>>(0))
        .ok()
        .flatten();
    sendiri.filter(|s| ada(s))
}

/// (boleh mencoret?, kanvas yang boleh dicoret).
pub fn izin_murid(c: &rusqlite::Connection, murid: &str) -> (bool, Option<String>) {
    let boleh: bool = c
        .query_row("SELECT can_draw FROM students WHERE id = ?1", rusqlite::params![murid], |r| r.get::<_, i64>(0))
        .map(|n| n != 0)
        .unwrap_or(false);
    let sketsa = if boleh { sketsa_murid(c, murid) } else { None };
    (boleh && sketsa.is_some(), sketsa)
}

/// Izin terkini per murid, dibagi semua koneksi WebSocket. Diisi saat koneksi
/// pertama murid itu dan ditulis ulang oleh `api_izin` sebelum siarannya —
/// jadi pencabutan berlaku seketika, bukan setelah siaran sampai ke koneksi.
static IZIN: std::sync::Mutex<Option<std::collections::HashMap<String, (bool, Option<String>)>>> = std::sync::Mutex::new(None);

/// Izin murid untuk koneksi WebSocket: dari cache bersama, atau dari database
/// kalau belum pernah dibaca.
pub fn izin_murid_terkini(murid: &str) -> (bool, Option<String>) {
    if let Some(z) = IZIN.lock().ok().and_then(|g| g.as_ref().and_then(|p| p.get(murid).cloned())) {
        return z;
    }
    let z = match koneksi() {
        Ok(c) => izin_murid(&c, murid),
        Err(_) => (false, None),
    };
    if let Ok(mut g) = IZIN.lock() {
        g.get_or_insert_with(Default::default).insert(murid.to_string(), z.clone());
    }
    z
}

fn catat_izin(murid: &str, boleh: bool, sketsa: Option<String>) {
    if let Ok(mut g) = IZIN.lock() {
        g.get_or_insert_with(Default::default).insert(murid.to_string(), (boleh, sketsa));
    }
}

/// Sketsa kosong A4 buatan server, sama bentuknya dengan `buatKanvas` di sisi depan.
fn buat_sketsa_kosong(c: &rusqlite::Connection, judul: &str) -> Result<String, String> {
    let kini = sekarang();
    let acak: String = format!("{:x}", SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_nanos()).unwrap_or(0));
    let id = format!("cnv_{}{}", radix36(kini as u128), &acak[acak.len().saturating_sub(5)..]);
    let lapisan = |n: u32| json!({ "nama": format!("Layer {n}"), "tampak": true, "kunci": false });
    let berkas = json!({
        "id": id, "title": judul, "strokes": [], "images": [], "objects": [], "texts": [],
        "layers": [lapisan(1), lapisan(2), lapisan(3)], "paper": "a4", "pages": 1, "updated_at": kini,
    });
    vault::canvas_write(id.clone(), berkas.to_string())?;
    c.execute(
        "INSERT OR REPLACE INTO canvases (id, title, updated_at) VALUES (?1, ?2, ?3)",
        rusqlite::params![id, judul, kini],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

/// 'YYYY-MM-DD' waktu lokal Mac — sama dengan `kunciTanggal` di sisi depan.
pub fn hari_ini() -> String {
    chrono::Local::now().format("%Y-%m-%d").to_string()
}

/// "6 Sep" — sama dengan `tanggalPendek` di sisi depan.
fn tanggal_pendek() -> String {
    const BULAN: [&str; 12] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    let kini = chrono::Local::now();
    use chrono::Datelike;
    format!("{} {}", kini.day(), BULAN[(kini.month0() as usize).min(11)])
}

fn radix36(mut n: u128) -> String {
    const D: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    if n == 0 {
        return "0".into();
    }
    let mut s = Vec::new();
    while n > 0 {
        s.push(D[(n % 36) as usize]);
        n /= 36;
    }
    s.reverse();
    String::from_utf8(s).unwrap_or_default()
}

#[derive(Deserialize)]
pub struct Izin {
    pub murid: String,
    pub boleh: bool,
}

/// Guru mengizinkan (atau mencabut izin) seorang murid mencoret kanvasnya
/// sendiri. Kanvasnya dibuat di sini kalau belum ada, supaya HP murid punya
/// tempat menulis seketika. Siarannya dipakai server sendiri (koneksi WS
/// murid itu) dan HP-nya (tombol Draw muncul/hilang).
pub async fn api_izin(State(hub): State<Arc<Hub>>, headers: HeaderMap, Json(z): Json<Izin>) -> Response {
    if !sah(&hub, &headers, None) {
        return tolak();
    }
    if !admin_sah(&hub, &headers, None) {
        return (StatusCode::UNAUTHORIZED, "Admin password required.").into_response();
    }
    let murid = z.murid.clone();
    let boleh = z.boleh;
    let hasil = tokio::task::spawn_blocking(move || -> Result<(Option<String>, Option<String>), String> {
        let c = koneksi()?;
        let nama: String = c
            .query_row("SELECT name FROM students WHERE id = ?1", rusqlite::params![murid], |r| r.get(0))
            .map_err(|_| "Student not found.".to_string())?;
        c.execute("UPDATE students SET can_draw = ?1 WHERE id = ?2", rusqlite::params![boleh as i64, murid]).map_err(|e| e.to_string())?;
        if !boleh {
            return Ok((None, None));
        }
        let mut baru = None;
        let mut sketsa = sketsa_murid(&c, &murid);
        if sketsa.is_none() {
            // Bergrup → kanvas grup; sendiri → kanvas pribadi.
            let grup: Option<(String, String)> = c
                .query_row(
                    "SELECT g.id, g.name FROM groups g JOIN group_members m ON m.group_id = g.id WHERE m.student_id = ?1 ORDER BY g.sort_order LIMIT 1",
                    rusqlite::params![murid],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .ok();
            let id = match &grup {
                Some((gid, gnama)) => {
                    let id = buat_sketsa_kosong(&c, &format!("Grup · {gnama} · {}", tanggal_pendek()))?;
                    c.execute("UPDATE groups SET sketch_id = ?1, sketch_day = ?2 WHERE id = ?3", rusqlite::params![id, hari_ini(), gid])
                        .map_err(|e| e.to_string())?;
                    id
                }
                None => {
                    let id = buat_sketsa_kosong(&c, &format!("Tanya · {nama}"))?;
                    c.execute("UPDATE students SET sketch_id = ?1 WHERE id = ?2", rusqlite::params![id, murid]).map_err(|e| e.to_string())?;
                    id
                }
            };
            baru = Some(id.clone());
            sketsa = Some(id);
        }
        Ok((sketsa, baru))
    })
    .await;
    match hasil {
        Ok(Ok((sketsa, baru))) => {
            catat_izin(&z.murid, boleh && sketsa.is_some(), sketsa.clone());
            if let Some(id) = &baru {
                let _ = hub.tx.send(json!({ "t": "data", "kanal": "canvas", "payload": { "id": id, "src": "server" } }).to_string());
            }
            let _ = hub.tx.send(json!({ "t": "izin", "murid": z.murid, "boleh": boleh && sketsa.is_some(), "sketsa": sketsa }).to_string());
            kabari(&hub, "izin", json!({ "murid": z.murid, "boleh": boleh }));
            Json(json!({ "sketsa": sketsa })).into_response()
        }
        Ok(Err(e)) => (StatusCode::BAD_REQUEST, e).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/* ── Menyimpan coretan murid ───────────────────────────────────────── */

/// Perubahan dari HP murid yang belum ditulis ke berkas, per sketsa. Ditulis
/// sekaligus sekitar 1,2 detik setelah goresan terakhir: puluhan goresan
/// berturut-turut jadi satu kali baca-tulis, bukan puluhan.
static TERTUNDA: std::sync::Mutex<Option<std::collections::HashMap<String, Vec<Value>>>> = std::sync::Mutex::new(None);

pub fn antre_coretan_murid(hub: Arc<Hub>, id_kanvas: String, ubah: Value) {
    let pertama = {
        let mut g = TERTUNDA.lock().unwrap_or_else(|e| e.into_inner());
        let peta = g.get_or_insert_with(Default::default);
        let daftar = peta.entry(id_kanvas.clone()).or_default();
        daftar.push(ubah);
        daftar.len() == 1
    };
    if pertama {
        tokio::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_millis(1200)).await;
            let ops = {
                let mut g = TERTUNDA.lock().unwrap_or_else(|e| e.into_inner());
                g.as_mut().and_then(|p| p.remove(&id_kanvas)).unwrap_or_default()
            };
            if ops.is_empty() {
                return;
            }
            let id2 = id_kanvas.clone();
            let hasil = tokio::task::spawn_blocking(move || tulis_coretan_murid(&id2, &ops)).await;
            match hasil {
                Ok(Ok(())) => {
                    let _ = hub.tx.send(json!({ "t": "data", "kanal": "canvas", "payload": { "id": id_kanvas, "src": "server" } }).to_string());
                }
                Ok(Err(e)) => eprintln!("[kelas] coretan murid tidak tersimpan ({id_kanvas}): {e}"),
                Err(e) => eprintln!("[kelas] coretan murid: {e}"),
            }
        });
    }
}

/// Terapkan pesan-pesan `ubah` (hanya coretan) ke berkas sketsa, lalu tulis.
/// Id goresan bercap `murid` ini di berkas kanvas — yang boleh ia hapus lagi
/// sesudah HP-nya memuat ulang. Berkas yang hilang atau rusak berarti kosong.
pub fn goresan_milik(id_kanvas: &str, murid: &str) -> std::collections::HashSet<String> {
    let Ok(Some(teks)) = vault::canvas_read(id_kanvas.to_string()) else { return Default::default() };
    let Ok(d) = serde_json::from_str::<Value>(&teks) else { return Default::default() };
    d["strokes"]
        .as_array()
        .map(|s| {
            s.iter()
                .filter(|c| c["murid"].as_str() == Some(murid))
                .filter_map(|c| c["id"].as_str().map(|i| i.to_string()))
                .collect()
        })
        .unwrap_or_default()
}

fn tulis_coretan_murid(id: &str, ops: &[Value]) -> Result<(), String> {
    let teks = vault::canvas_read(id.to_string())?.ok_or_else(|| "Sketch is gone.".to_string())?;
    let mut d: Value = serde_json::from_str(&teks).map_err(|e| e.to_string())?;
    if !d.is_object() {
        return Err("Sketch file is not an object.".into());
    }
    if !d["strokes"].is_array() {
        d["strokes"] = Value::Array(vec![]);
    }
    let strokes = d["strokes"].as_array_mut().expect("array");
    for op in ops {
        if let Some(hapus) = op["hapus"]["coretan"].as_array() {
            let ids: std::collections::HashSet<&str> = hapus.iter().filter_map(|x| x.as_str()).collect();
            if !ids.is_empty() {
                strokes.retain(|s| !s["id"].as_str().map(|i| ids.contains(i)).unwrap_or(false));
            }
        }
        if let Some(tambah) = op["tambah"]["coretan"].as_array() {
            for c in tambah {
                let Some(cid) = c["id"].as_str() else { continue };
                if let Some(ada) = strokes.iter_mut().find(|s| s["id"].as_str() == Some(cid)) {
                    *ada = c.clone();
                } else {
                    strokes.push(c.clone());
                }
            }
        }
    }
    let kini = sekarang();
    d["updated_at"] = json!(kini);
    vault::canvas_write(id.to_string(), d.to_string())?;
    let c = koneksi()?;
    let _ = c.execute("UPDATE canvases SET updated_at = ?1 WHERE id = ?2", rusqlite::params![kini, id]);
    Ok(())
}

/* ── Pertanyaan ────────────────────────────────────────────────────── */

#[derive(Deserialize)]
pub struct Tanya {
    pub murid: String,
    pub nama: String,
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
            "INSERT INTO questions (id, student_id, name, room, text, photo, status, created_at) VALUES (?1, ?2, ?3, 1, ?4, ?5, 'menunggu', ?6)",
            rusqlite::params![id, t.murid, t.nama.trim().chars().take(40).collect::<String>(), if teks.is_empty() { None } else { Some(teks.clone()) }, nama_foto, kini],
        )
        .map_err(|e| e.to_string())?;
        Ok(json!({ "id": id, "nama": t.nama, "teks": teks, "foto": nama_foto.is_some() }))
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
    if !admin_sah(&hub, &headers, None) {
        return (StatusCode::UNAUTHORIZED, "Admin password required.").into_response();
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
pub async fn api_foto(State(hub): State<Arc<Hub>>, headers: HeaderMap, Query(q): Query<crate::server::QueryAdmin>, Path(nama): Path<String>) -> Response {
    if !sah(&hub, &headers, q.pin.as_deref()) {
        return tolak();
    }
    // Foto pertanyaan anak hanya untuk guru.
    if !admin_sah(&hub, &headers, q.admin.as_deref()) {
        return (StatusCode::UNAUTHORIZED, "Admin password required.").into_response();
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

#[derive(Deserialize)]
pub struct Paham {
    pub murid: String,
}

/// Murid menutup pertanyaannya sendiri ("Got it") — tanpa hak admin.
pub async fn api_paham(State(hub): State<Arc<Hub>>, headers: HeaderMap, Json(p): Json<Paham>) -> Response {
    if !sah(&hub, &headers, None) {
        return tolak();
    }
    let murid = p.murid.clone();
    let hasil = tokio::task::spawn_blocking(move || -> Result<usize, String> {
        let c = koneksi()?;
        c.execute(
            "UPDATE questions SET status = 'selesai', handled_at = ?1 WHERE student_id = ?2 AND status != 'selesai'",
            rusqlite::params![sekarang(), murid],
        )
        .map_err(|e| e.to_string())
    })
    .await;
    match hasil {
        Ok(Ok(n)) => {
            if n > 0 {
                kabari(&hub, "ubah", json!({ "murid": p.murid, "status": "selesai" }));
            }
            StatusCode::NO_CONTENT.into_response()
        }
        Ok(Err(e)) => (StatusCode::BAD_REQUEST, e).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// Sketsa yang terakhir disentuh — untuk layar pengikut yang baru menyala.
pub async fn api_terbaru(State(hub): State<Arc<Hub>>, headers: HeaderMap, Query(q): Query<QueryPin>) -> Response {
    if !crate::server::sah_lengkap(&hub, &headers, q.pin.as_deref(), q.sesi.as_deref(), None) {
        return tolak();
    }
    let hasil = tokio::task::spawn_blocking(|| -> Result<Option<String>, String> {
        let c = koneksi()?;
        Ok(c.query_row("SELECT id FROM canvases ORDER BY updated_at DESC LIMIT 1", [], |r| r.get::<_, String>(0)).ok())
    })
    .await;
    match hasil {
        Ok(Ok(id)) => Json(json!({ "id": id })).into_response(),
        Ok(Err(e)) => (StatusCode::BAD_REQUEST, e).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
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

/* ── Grup belajar mandiri ──────────────────────────────────────────── */
//
// Guru masih bisa mengatur grup dari panel (lewat SQL admin), tapi murid
// juga boleh membentuk atau bergabung ke grup belajarnya sendiri dari HP —
// satu murid satu grup, sama seperti yang guru atur.

const WARNA_GRUP: [&str; 6] = ["#b4531a", "#1f6f5c", "#1d4ed8", "#7c3aed", "#d97706", "#0891b2"];

#[derive(Deserialize)]
pub struct BuatGrup {
    pub murid: String,
    pub nama: String,
}

/// Murid membuat grup belajarnya sendiri dan langsung jadi anggotanya.
pub async fn api_grup_buat(State(hub): State<Arc<Hub>>, headers: HeaderMap, Json(g): Json<BuatGrup>) -> Response {
    if !sah(&hub, &headers, None) {
        return tolak();
    }
    if kebanjiran(&headers) {
        return terlalu_sering();
    }
    let nama = g.nama.trim().chars().take(40).collect::<String>();
    if nama.is_empty() || g.murid.is_empty() {
        return (StatusCode::BAD_REQUEST, "A group name is required.").into_response();
    }
    let hasil = tokio::task::spawn_blocking(move || -> Result<(String, String), String> {
        let mut c = koneksi()?;
        let jumlah: i64 = c.query_row("SELECT COUNT(*) FROM groups", [], |r| r.get(0)).unwrap_or(0);
        let warna = WARNA_GRUP[(jumlah as usize) % WARNA_GRUP.len()];
        let id = id_baru("grp");
        let tx = c.transaction().map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT INTO groups (id, name, color, target, sort_order) VALUES (?1, ?2, ?3, NULL, ?4)",
            rusqlite::params![id, nama, warna, sekarang()],
        )
        .map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM group_members WHERE student_id = ?1", rusqlite::params![g.murid]).map_err(|e| e.to_string())?;
        tx.execute("INSERT INTO group_members (group_id, student_id) VALUES (?1, ?2)", rusqlite::params![id, g.murid])
            .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok((id, nama))
    })
    .await;
    match hasil {
        Ok(Ok((id, nama))) => {
            kabari(&hub, "grup", Value::Null);
            Json(json!({ "id": id, "nama": nama })).into_response()
        }
        Ok(Err(e)) => (StatusCode::BAD_REQUEST, e).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/// Daftar grup yang bisa digabung murid — nama, warna, jumlah anggota saja.
pub async fn api_grup_daftar(State(hub): State<Arc<Hub>>, headers: HeaderMap, Query(q): Query<QueryPin>) -> Response {
    if !crate::server::sah_lengkap(&hub, &headers, q.pin.as_deref(), q.sesi.as_deref(), None) {
        return tolak();
    }
    let hasil = tokio::task::spawn_blocking(move || -> Result<Vec<Value>, String> {
        let c = koneksi()?;
        let mut st = c
            .prepare(
                "SELECT g.id, g.name, g.color, COUNT(m.student_id) FROM groups g \
                 LEFT JOIN group_members m ON m.group_id = g.id \
                 GROUP BY g.id ORDER BY g.sort_order, g.name COLLATE NOCASE",
            )
            .map_err(|e| e.to_string())?;
        let baris = st
            .query_map([], |r| {
                Ok(json!({
                    "id": r.get::<_, String>(0)?,
                    "nama": r.get::<_, String>(1)?,
                    "warna": r.get::<_, Option<String>>(2)?,
                    "anggota": r.get::<_, i64>(3)?,
                }))
            })
            .map_err(|e| e.to_string())?
            .flatten()
            .collect();
        Ok(baris)
    })
    .await;
    match hasil {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => (StatusCode::BAD_REQUEST, e).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

#[derive(Deserialize)]
pub struct GabungGrup {
    pub murid: String,
    pub grup: String,
}

/// Murid bergabung ke grup yang sudah ada, keluar dari grup lamanya kalau ada.
pub async fn api_grup_gabung(State(hub): State<Arc<Hub>>, headers: HeaderMap, Json(g): Json<GabungGrup>) -> Response {
    if !sah(&hub, &headers, None) {
        return tolak();
    }
    if g.murid.is_empty() || g.grup.is_empty() {
        return (StatusCode::BAD_REQUEST, "Missing student or group.").into_response();
    }
    let hasil = tokio::task::spawn_blocking(move || -> Result<(), String> {
        let mut c = koneksi()?;
        let ada: bool = c.query_row("SELECT 1 FROM groups WHERE id = ?1", rusqlite::params![g.grup], |_| Ok(())).is_ok();
        if !ada {
            return Err("That group no longer exists.".into());
        }
        let tx = c.transaction().map_err(|e| e.to_string())?;
        tx.execute("DELETE FROM group_members WHERE student_id = ?1", rusqlite::params![g.murid]).map_err(|e| e.to_string())?;
        tx.execute(
            "INSERT OR IGNORE INTO group_members (group_id, student_id) VALUES (?1, ?2)",
            rusqlite::params![g.grup, g.murid],
        )
        .map_err(|e| e.to_string())?;
        tx.commit().map_err(|e| e.to_string())?;
        Ok(())
    })
    .await;
    match hasil {
        Ok(Ok(())) => {
            kabari(&hub, "grup", Value::Null);
            StatusCode::NO_CONTENT.into_response()
        }
        Ok(Err(e)) => (StatusCode::BAD_REQUEST, e).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

#[derive(Deserialize)]
pub struct KeluarGrup {
    pub murid: String,
}

/// Murid keluar dari grupnya, kembali sendirian di kanvas pribadinya.
pub async fn api_grup_keluar(State(hub): State<Arc<Hub>>, headers: HeaderMap, Json(g): Json<KeluarGrup>) -> Response {
    if !sah(&hub, &headers, None) {
        return tolak();
    }
    let hasil = tokio::task::spawn_blocking(move || -> Result<(), String> {
        let c = koneksi()?;
        c.execute("DELETE FROM group_members WHERE student_id = ?1", rusqlite::params![g.murid]).map_err(|e| e.to_string())?;
        Ok(())
    })
    .await;
    match hasil {
        Ok(Ok(())) => {
            kabari(&hub, "grup", Value::Null);
            StatusCode::NO_CONTENT.into_response()
        }
        Ok(Err(e)) => (StatusCode::BAD_REQUEST, e).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}
