//! Berkas kantor yang diseret ke kanvas: Word, PowerPoint, dan kerabatnya.
//!
//! Dua jalur, sengaja bertingkat. LibreOffice — kalau terpasang — mengubah
//! apa pun jadi PDF dengan tata letak utuh, dan kanvas sudah punya pengimpor
//! PDF. Tanpa LibreOffice, `textutil` bawaan macOS masih bisa membaca keluarga
//! Word menjadi HTML; PowerPoint tidak dikenalnya sama sekali, dan itu dikatakan
//! terus terang alih-alih gagal diam-diam.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

#[derive(Serialize)]
pub struct HasilKonversi {
    /// "pdf" atau "html" — menentukan cara sisi depan menggambarnya.
    pub kind: String,
    pub pdf: Option<Vec<u8>>,
    pub html: Option<String>,
}

/// Keluarga Word: satu-satunya yang punya jalur cadangan tanpa LibreOffice.
const WORD: [&str; 5] = ["doc", "docx", "rtf", "odt", "wordml"];

const KANTOR: [&str; 10] = [
    "doc", "docx", "rtf", "odt", "wordml", "ppt", "pptx", "odp", "key", "pages",
];

pub fn didukung(ext: &str) -> bool {
    KANTOR.contains(&ext)
}

fn cari_soffice() -> Option<PathBuf> {
    const TEMPAT: [&str; 4] = [
        "/Applications/LibreOffice.app/Contents/MacOS/soffice",
        "/opt/homebrew/bin/soffice",
        "/usr/local/bin/soffice",
        "/usr/bin/soffice",
    ];
    for p in TEMPAT {
        let pb = PathBuf::from(p);
        if pb.exists() {
            return Some(pb);
        }
    }
    let keluar = Command::new("/usr/bin/which").arg("soffice").output().ok()?;
    if !keluar.status.success() {
        return None;
    }
    let jalur = String::from_utf8_lossy(&keluar.stdout).trim().to_string();
    if jalur.is_empty() {
        None
    } else {
        Some(PathBuf::from(jalur))
    }
}

/// Buang tag yang bisa menjalankan sesuatu.
///
/// `textutil` menyusun HTML-nya sendiri dari isi dokumen, jadi seharusnya tidak
/// pernah ada skrip di sana. "Seharusnya" bukan alasan untuk menyerahkan HTML
/// mentah dari berkas yang baru saja diseret orang ke dalam aplikasi.
fn bersihkan(html: &str) -> String {
    let mut out = String::with_capacity(html.len());
    let mut sisa = html;
    loop {
        let bawah = sisa.to_lowercase();
        let awal = ["<script", "<iframe", "<object", "<embed"]
            .iter()
            .filter_map(|t| bawah.find(t))
            .min();
        let Some(i) = awal else {
            out.push_str(sisa);
            return out;
        };
        out.push_str(&sisa[..i]);
        // Lompati sampai penutup tag yang cocok; kalau tidak ketemu, buang sisanya.
        let ekor = &bawah[i..];
        let tutup = ["</script>", "</iframe>", "</object>", "</embed>"]
            .iter()
            .filter_map(|t| ekor.find(t).map(|p| p + t.len()))
            .min();
        match tutup {
            Some(p) => sisa = &sisa[i + p..],
            None => return out,
        }
    }
}

fn konversi(dir: &Path, masuk: &Path, ext: &str) -> Result<HasilKonversi, String> {
    if let Some(soffice) = cari_soffice() {
        let keluar = Command::new(&soffice)
            .args(["--headless", "--norestore", "--convert-to", "pdf", "--outdir"])
            .arg(dir)
            .arg(masuk)
            .output()
            .map_err(|e| e.to_string())?;
        let pdf = dir.join("sumber.pdf");
        if pdf.exists() {
            let isi = fs::read(&pdf).map_err(|e| e.to_string())?;
            return Ok(HasilKonversi { kind: "pdf".into(), pdf: Some(isi), html: None });
        }
        // LibreOffice ada tapi gagal. Untuk berkas Word masih ada jalan lain di
        // bawah; untuk sisanya, sampaikan alasannya apa adanya.
        if !WORD.contains(&ext) {
            let pesan = String::from_utf8_lossy(&keluar.stderr).trim().to_string();
            return Err(if pesan.is_empty() {
                "LibreOffice could not convert that file.".into()
            } else {
                pesan
            });
        }
    }

    if !WORD.contains(&ext) {
        return Err(
            "Slides need LibreOffice installed, or export the deck to PDF and drop that instead."
                .into(),
        );
    }

    let html = dir.join("sumber.html");
    let keluar = Command::new("/usr/bin/textutil")
        .args(["-convert", "html", "-output"])
        .arg(&html)
        .arg(masuk)
        .output()
        .map_err(|e| e.to_string())?;
    if !html.exists() {
        let pesan = String::from_utf8_lossy(&keluar.stderr).trim().to_string();
        return Err(if pesan.is_empty() {
            "That document could not be read.".into()
        } else {
            pesan
        });
    }
    let isi = fs::read_to_string(&html).map_err(|e| e.to_string())?;
    Ok(HasilKonversi { kind: "html".into(), pdf: None, html: Some(bersihkan(&isi)) })
}

#[tauri::command]
pub fn office_convert(name: String, bytes: Vec<u8>) -> Result<HasilKonversi, String> {
    let ext = name.rsplit('.').next().unwrap_or_default().to_lowercase();
    if !didukung(&ext) {
        return Err("That file type is not supported.".into());
    }

    // Berkasnya ditulis ke direktori sementara sendiri, bukan ke vault: ia hanya
    // perlu hidup selama konversi, dan namanya dipaksa seragam supaya nama asli
    // dari luar tidak pernah ikut jadi jalur.
    let stempel = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_nanos();
    let dir = std::env::temp_dir().join(format!("exact-konversi-{stempel}"));
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let masuk = dir.join(format!("sumber.{ext}"));

    let hasil = fs::write(&masuk, &bytes)
        .map_err(|e| e.to_string())
        .and_then(|_| konversi(&dir, &masuk, &ext));
    let _ = fs::remove_dir_all(&dir);
    hasil
}

/// Buka PDF yang sudah tersimpan di penampil bawaan.
///
/// `window.print()` tidak berbuat apa-apa di WKWebView — halaman yang dicetak
/// harus melewati sisi asli. Berkasnya dibuka dengan penampil bawaan, tempat
/// dialog cetak macOS yang sesungguhnya berada beserta pilihan printer, rentang
/// halaman, dan pratinjaunya.
#[tauri::command]
pub fn print_pdf(path: String) -> Result<(), String> {
    let berkas = PathBuf::from(&path);
    if !berkas.exists() {
        return Err("That PDF is not there any more.".into());
    }

    let keluar = Command::new("/usr/bin/open")
        .arg("-a")
        .arg("Preview")
        .arg(&berkas)
        .output()
        .map_err(|e| e.to_string())?;
    if keluar.status.success() {
        return Ok(());
    }
    // Preview bisa saja tidak ada atau diganti; penampil bawaan apa pun cukup.
    Command::new("/usr/bin/open")
        .arg(&berkas)
        .status()
        .map_err(|e| e.to_string())
        .and_then(|s| if s.success() { Ok(()) } else { Err("Could not open the PDF.".into()) })
}

/// Baca berkas yang dijatuhkan ke jendela.
///
/// Jalurnya datang dari peristiwa drop asli Tauri, bukan dari teks yang diketik
/// siapa pun — tapi perintah ini tetap dibatasi pada jenis berkas yang memang
/// bisa digambar di kanvas, dan pada ukuran yang masuk akal untuk itu. Sebuah
/// perintah yang mau membaca berkas apa pun di disk adalah pintu yang tidak
/// perlu dibuka hanya untuk menempel gambar.
#[tauri::command]
pub fn dropped_bytes(path: String) -> Result<Vec<u8>, String> {
    const BATAS: u64 = 96 * 1024 * 1024;
    const GAMBAR: [&str; 8] = ["png", "jpg", "jpeg", "gif", "webp", "heic", "tiff", "bmp"];

    let berkas = PathBuf::from(&path);
    let ext = berkas
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or_default()
        .to_lowercase();
    if !(ext == "pdf" || GAMBAR.contains(&ext.as_str()) || didukung(&ext)) {
        return Err(format!("The canvas cannot take a .{ext} file."));
    }

    let meta = fs::metadata(&berkas).map_err(|e| e.to_string())?;
    if !meta.is_file() {
        return Err("That is a folder, not a file.".into());
    }
    if meta.len() > BATAS {
        return Err(format!("That file is {} MB — too big to drop in.", meta.len() / 1024 / 1024));
    }
    fs::read(&berkas).map_err(|e| e.to_string())
}
