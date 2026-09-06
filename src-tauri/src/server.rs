//! Berbagi di jaringan.
//!
//! Aplikasi ini menjadi server kecil di Wi-Fi: TV membuka `/tv` di browsernya
//! sebagai layar pengikut, tablet membuka `/` sebagai editor. Semua data tetap
//! di vault Mac — klien lain hanya jendela ke sana lewat API kecil, dan
//! peristiwa langsung (pandangan, goresan yang sedang ditarik) diteruskan
//! apa adanya lewat satu hub WebSocket: server tidak menafsirkan isinya,
//! cuma menyiarkan ke semua klien lain.

use std::net::{IpAddr, SocketAddr, TcpListener as StdTcpListener, UdpSocket};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use axum::{
    body::Body,
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::get,
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use tauri::AppHandle;
use tokio::sync::{broadcast, oneshot};

use crate::vault;

const PORT_AWAL: u16 = 4747;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Klien {
    pub id: String,
    pub nama: String,
    pub peran: String,
}

pub struct Hub {
    pub pin: String,
    pub port: u16,
    pub tx: broadcast::Sender<String>,
    pub klien: Mutex<Vec<Klien>>,
    pub app: AppHandle,
}

struct Aktif {
    hub: Arc<Hub>,
    matikan: Option<oneshot::Sender<()>>,
}

static BERBAGI: Mutex<Option<Aktif>> = Mutex::new(None);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct InfoBerbagi {
    pub url: String,
    pub url_tv: String,
    pub pin: String,
    pub port: u16,
    pub ip: String,
    pub klien: Vec<Klien>,
}

/* ── Alamat ────────────────────────────────────────────────────────── */

/// IP Mac ini di jaringan lokal.
///
/// Trik soket UDP: "menyambung" ke alamat luar tidak mengirim apa pun, tapi
/// memaksa sistem memilih antarmuka keluar — itulah IP yang dilihat TV.
/// Tanpa jalur ke luar (Wi-Fi tanpa internet), jatuh ke `ipconfig`.
fn ip_lokal() -> String {
    if let Ok(s) = UdpSocket::bind("0.0.0.0:0") {
        if s.connect("8.8.8.8:80").is_ok() {
            if let Ok(a) = s.local_addr() {
                if !a.ip().is_loopback() {
                    return a.ip().to_string();
                }
            }
        }
    }
    for iface in ["en0", "en1", "en2", "en3"] {
        if let Ok(o) = std::process::Command::new("/usr/sbin/ipconfig")
            .args(["getifaddr", iface])
            .output()
        {
            let s = String::from_utf8_lossy(&o.stdout).trim().to_string();
            if !s.is_empty() {
                return s;
            }
        }
    }
    "127.0.0.1".into()
}

fn pin_acak() -> String {
    // Empat digit dari nanodetik sekarang — bukan kriptografi, cuma pagar
    // supaya tetangga yang menebak alamatnya tidak langsung masuk.
    let n = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or(1234);
    format!("{:04}", (n % 9000) + 1000)
}

fn info(hub: &Hub) -> InfoBerbagi {
    let ip = ip_lokal();
    InfoBerbagi {
        url: format!("http://{ip}:{}/?pin={}", hub.port, hub.pin),
        url_tv: format!("http://{ip}:{}/tv?pin={}", hub.port, hub.pin),
        pin: hub.pin.clone(),
        port: hub.port,
        ip,
        klien: hub.klien.lock().map(|k| k.clone()).unwrap_or_default(),
    }
}

/* ── Perintah ──────────────────────────────────────────────────────── */

#[tauri::command]
pub async fn share_start(app: AppHandle, pin: Option<String>) -> Result<InfoBerbagi, String> {
    if let Some(a) = BERBAGI.lock().unwrap_or_else(|e| e.into_inner()).as_ref() {
        return Ok(info(&a.hub));
    }

    // Port berikutnya dicoba kalau 4747 sedang dipakai proses lain.
    let mut listener = None;
    let mut port = PORT_AWAL;
    for p in PORT_AWAL..PORT_AWAL + 10 {
        if let Ok(l) = StdTcpListener::bind(SocketAddr::new(IpAddr::from([0, 0, 0, 0]), p)) {
            l.set_nonblocking(true).map_err(|e| e.to_string())?;
            listener = Some(l);
            port = p;
            break;
        }
    }
    let listener = listener.ok_or("No free port between 4747 and 4756.")?;

    let (tx, _) = broadcast::channel::<String>(512);
    let hub = Arc::new(Hub {
        pin: pin.filter(|p| p.len() == 4 && p.chars().all(|c| c.is_ascii_digit())).unwrap_or_else(pin_acak),
        port,
        tx,
        klien: Mutex::new(Vec::new()),
        app: app.clone(),
    });

    let (kirim_matikan, terima_matikan) = oneshot::channel::<()>();
    let router = rute(hub.clone());
    let listener = tokio::net::TcpListener::from_std(listener).map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn(async move {
        let hasil = axum::serve(listener, router)
            .with_graceful_shutdown(async {
                let _ = terima_matikan.await;
            })
            .await;
        if let Err(e) = hasil {
            eprintln!("[server] berhenti: {e}");
        }
    });

    let hasil = info(&hub);
    *BERBAGI.lock().unwrap_or_else(|e| e.into_inner()) = Some(Aktif { hub, matikan: Some(kirim_matikan) });
    Ok(hasil)
}

#[tauri::command]
pub fn share_stop() {
    if let Some(mut a) = BERBAGI.lock().unwrap_or_else(|e| e.into_inner()).take() {
        if let Some(m) = a.matikan.take() {
            let _ = m.send(());
        }
        // Klien yang masih tersambung diberi tahu supaya layarnya tidak
        // membeku diam-diam menampilkan halaman terakhir.
        let _ = a.hub.tx.send(json!({ "t": "server-mati" }).to_string());
    }
}

#[tauri::command]
pub fn share_status() -> Option<InfoBerbagi> {
    BERBAGI
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .as_ref()
        .map(|a| info(&a.hub))
}

/// QR sebagai SVG, untuk dipindai tablet.
#[tauri::command]
pub fn share_qr(text: String) -> Result<String, String> {
    use qrcode::render::svg;
    let kode = qrcode::QrCode::new(text.as_bytes()).map_err(|e| e.to_string())?;
    Ok(kode
        .render::<svg::Color>()
        .min_dimensions(220, 220)
        .quiet_zone(true)
        .dark_color(svg::Color("#111111"))
        .light_color(svg::Color("#ffffff"))
        .build())
}

/* ── Rute ──────────────────────────────────────────────────────────── */

fn rute(hub: Arc<Hub>) -> Router {
    Router::new()
        .route("/", get(halaman_utama))
        .route("/tv", get(halaman_tv))
        .route("/api/vault", get(api_vault))
        .route("/api/canvas", get(api_canvas_list))
        .route(
            "/api/canvas/{id}",
            get(api_canvas_read).put(api_canvas_write).delete(api_canvas_delete),
        )
        .route("/api/sql", axum::routing::post(api_sql))
        .route("/ws", get(ws_masuk))
        .fallback(aset_lain)
        .with_state(hub)
}

#[derive(Deserialize)]
struct QueryPin {
    pin: Option<String>,
}

fn sah(hub: &Hub, headers: &HeaderMap, q: Option<&str>) -> bool {
    let dari_header = headers
        .get("x-exact-pin")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == hub.pin)
        .unwrap_or(false);
    dari_header || q == Some(hub.pin.as_str())
}

fn tolak() -> Response {
    (StatusCode::UNAUTHORIZED, "PIN salah.").into_response()
}

/* ── Berkas frontend ───────────────────────────────────────────────── */

/// Ambil berkas hasil build frontend.
///
/// Saat dibundel, berkasnya tertanam di dalam aplikasi lewat penyelesai aset
/// Tauri. Saat `tauri dev`, tidak ada yang tertanam — dibaca dari folder
/// `dist` hasil `npm run build` supaya servernya tetap bisa diuji.
fn aset(app: &AppHandle, path: &str) -> Option<(Vec<u8>, String)> {
    let bersih = path.trim_start_matches('/');
    let bersih = if bersih.is_empty() { "index.html" } else { bersih };
    if let Some(a) = app.asset_resolver().get(format!("/{bersih}")) {
        return Some((a.bytes().to_vec(), a.mime_type().to_string()));
    }
    let mut cwd = std::env::current_dir().ok()?;
    for _ in 0..3 {
        let calon = cwd.join("dist").join(bersih);
        if calon.is_file() {
            let isi = std::fs::read(&calon).ok()?;
            return Some((isi, mime_dari(bersih).to_string()));
        }
        cwd = cwd.parent()?.to_path_buf();
    }
    None
}

fn mime_dari(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript",
        "css" => "text/css",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "json" => "application/json",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

fn balas_aset(app: &AppHandle, path: &str) -> Response {
    match aset(app, path) {
        Some((isi, mime)) => {
            let mut r = Response::new(Body::from(isi));
            r.headers_mut().insert(header::CONTENT_TYPE, mime.parse().unwrap());
            // Berkas berhash boleh di-cache lama; HTML jangan, supaya versi baru
            // aplikasi langsung terlihat di TV tanpa membersihkan cache.
            let cache = if path.ends_with(".html") || path == "/" || path.is_empty() {
                "no-cache"
            } else {
                "public, max-age=31536000, immutable"
            };
            r.headers_mut().insert(header::CACHE_CONTROL, cache.parse().unwrap());
            r
        }
        None => (StatusCode::NOT_FOUND, "Not found").into_response(),
    }
}

async fn halaman_utama(State(hub): State<Arc<Hub>>) -> Response {
    balas_aset(&hub.app, "index.html")
}

async fn halaman_tv(State(hub): State<Arc<Hub>>) -> Response {
    balas_aset(&hub.app, "tv.html")
}

async fn aset_lain(State(hub): State<Arc<Hub>>, uri: axum::http::Uri) -> Response {
    balas_aset(&hub.app, uri.path())
}

/* ── API vault ─────────────────────────────────────────────────────── */

async fn api_vault(State(hub): State<Arc<Hub>>, headers: HeaderMap, Query(q): Query<QueryPin>) -> Response {
    if !sah(&hub, &headers, q.pin.as_deref()) {
        return tolak();
    }
    Json(vault::vault_info()).into_response()
}

async fn api_canvas_list(State(hub): State<Arc<Hub>>, headers: HeaderMap) -> Response {
    if !sah(&hub, &headers, None) {
        return tolak();
    }
    Json(vault::canvas_list()).into_response()
}

async fn api_canvas_read(State(hub): State<Arc<Hub>>, headers: HeaderMap, Path(id): Path<String>) -> Response {
    if !sah(&hub, &headers, None) {
        return tolak();
    }
    match vault::canvas_read(id) {
        // Sebagai teks, bukan JSON: klien menyimpan berkasnya apa adanya dan
        // mengurainya sendiri, sama seperti saat membaca dari disk.
        Ok(Some(isi)) => ([(header::CONTENT_TYPE, "text/plain; charset=utf-8")], isi).into_response(),
        Ok(None) => StatusCode::NOT_FOUND.into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, e).into_response(),
    }
}

async fn api_canvas_write(
    State(hub): State<Arc<Hub>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    body: String,
) -> Response {
    if !sah(&hub, &headers, None) {
        return tolak();
    }
    match vault::canvas_write(id, body) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, e).into_response(),
    }
}

async fn api_canvas_delete(State(hub): State<Arc<Hub>>, headers: HeaderMap, Path(id): Path<String>) -> Response {
    if !sah(&hub, &headers, None) {
        return tolak();
    }
    match vault::canvas_delete(id) {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(e) => (StatusCode::BAD_REQUEST, e).into_response(),
    }
}

/* ── API SQL ───────────────────────────────────────────────────────── */

#[derive(Deserialize)]
struct PermintaanSql {
    sql: String,
    #[serde(default)]
    params: Vec<Value>,
}

fn ke_param(v: &Value) -> rusqlite::types::Value {
    use rusqlite::types::Value as V;
    match v {
        Value::Null => V::Null,
        Value::Bool(b) => V::Integer(*b as i64),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                V::Integer(i)
            } else {
                V::Real(n.as_f64().unwrap_or(0.0))
            }
        }
        Value::String(s) => V::Text(s.clone()),
        lain => V::Text(lain.to_string()),
    }
}

fn dari_sql(v: rusqlite::types::Value) -> Value {
    use rusqlite::types::Value as V;
    match v {
        V::Null => Value::Null,
        V::Integer(i) => json!(i),
        V::Real(f) => json!(f),
        V::Text(t) => json!(t),
        V::Blob(b) => json!(b),
    }
}

/// Jalankan satu pernyataan di database vault.
///
/// Klien web memakai lapisan data yang sama dengan aplikasi Mac; yang berbeda
/// hanya jalannya. SELECT dan PRAGMA mengembalikan baris; sisanya mengembalikan
/// jumlah baris yang berubah — bentuk yang sama dengan tauri-plugin-sql.
fn jalankan_sql(req: PermintaanSql) -> Result<Value, String> {
    let conn = rusqlite::Connection::open(vault::db_path()).map_err(|e| e.to_string())?;
    conn.busy_timeout(Duration::from_millis(15000)).map_err(|e| e.to_string())?;
    let params: Vec<rusqlite::types::Value> = req.params.iter().map(ke_param).collect();
    let awal = req.sql.trim_start().to_ascii_uppercase();
    let membaca = awal.starts_with("SELECT") || awal.starts_with("PRAGMA") || awal.starts_with("WITH");
    if membaca {
        let mut stmt = conn.prepare(&req.sql).map_err(|e| e.to_string())?;
        let kolom: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
        let baris = stmt
            .query_map(rusqlite::params_from_iter(params.iter()), |row| {
                let mut obj = Map::new();
                for (i, k) in kolom.iter().enumerate() {
                    let v: rusqlite::types::Value = row.get(i)?;
                    obj.insert(k.clone(), dari_sql(v));
                }
                Ok(Value::Object(obj))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        Ok(json!({ "rows": baris }))
    } else {
        let n = conn
            .execute(&req.sql, rusqlite::params_from_iter(params.iter()))
            .map_err(|e| e.to_string())?;
        Ok(json!({ "rowsAffected": n }))
    }
}

async fn api_sql(State(hub): State<Arc<Hub>>, headers: HeaderMap, Json(req): Json<PermintaanSql>) -> Response {
    if !sah(&hub, &headers, None) {
        return tolak();
    }
    match tokio::task::spawn_blocking(move || jalankan_sql(req)).await {
        Ok(Ok(v)) => Json(v).into_response(),
        Ok(Err(e)) => (StatusCode::BAD_REQUEST, e).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

/* ── Hub WebSocket ─────────────────────────────────────────────────── */

#[derive(Deserialize)]
struct QueryWs {
    pin: Option<String>,
    id: Option<String>,
    name: Option<String>,
    role: Option<String>,
}

async fn ws_masuk(
    ws: WebSocketUpgrade,
    State(hub): State<Arc<Hub>>,
    headers: HeaderMap,
    Query(q): Query<QueryWs>,
) -> Response {
    if !sah(&hub, &headers, q.pin.as_deref()) {
        return tolak();
    }
    let klien = Klien {
        id: q.id.unwrap_or_else(|| format!("k{}", pin_acak())),
        nama: q.name.unwrap_or_else(|| "Device".into()),
        peran: q.role.unwrap_or_else(|| "editor".into()),
    };
    ws.on_upgrade(move |soket| layani(soket, hub, klien))
}

fn siarkan_klien(hub: &Hub) {
    let daftar = hub.klien.lock().map(|k| k.clone()).unwrap_or_default();
    let _ = hub.tx.send(json!({ "t": "klien", "daftar": daftar }).to_string());
}

async fn layani(soket: WebSocket, hub: Arc<Hub>, klien: Klien) {
    let id = klien.id.clone();
    if let Ok(mut k) = hub.klien.lock() {
        k.retain(|x| x.id != id);
        k.push(klien);
    }
    siarkan_klien(&hub);

    let (mut tulis, mut baca) = soket.split();
    let mut rx = hub.tx.subscribe();

    loop {
        tokio::select! {
            masuk = baca.next() => {
                match masuk {
                    Some(Ok(Message::Text(t))) => {
                        let _ = hub.tx.send(t.to_string());
                    }
                    Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                    _ => {}
                }
            }
            keluar = rx.recv() => {
                match keluar {
                    Ok(pesan) => {
                        if tulis.send(Message::Text(pesan.into())).await.is_err() {
                            break;
                        }
                    }
                    // Tertinggal: klien lambat kehilangan beberapa pesan langsung;
                    // pesan berikutnya membawa keadaan terbaru, jadi lanjut saja.
                    Err(broadcast::error::RecvError::Lagged(_)) => {}
                    Err(_) => break,
                }
            }
        }
    }

    if let Ok(mut k) = hub.klien.lock() {
        k.retain(|x| x.id != id);
    }
    siarkan_klien(&hub);
}
