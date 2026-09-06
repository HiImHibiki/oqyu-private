//! Migrasi SQLite. Dijalankan tauri-plugin-sql saat koneksi pertama dibuka.
//! Sumber kebenaran sketsa tetap berkas JSON di vault/canvas — tabel di sini
//! hanya indeks (judul & waktu ubah) plus setelan aplikasi.
//!
//! JANGAN mengubah SQL migrasi yang sudah pernah diterapkan: sqlx menyimpan
//! checksum-nya. Tambahkan migrasi baru dengan versi berikutnya.

use tauri_plugin_sql::{Migration, MigrationKind};

pub fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "skema awal",
        kind: MigrationKind::Up,
        sql: SKEMA_AWAL,
    }]
}

const SKEMA_AWAL: &str = r#"
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

-- Kanvas (metadata; stroke ada di vault/canvas/*.json)
CREATE TABLE IF NOT EXISTS canvases (
  id         TEXT PRIMARY KEY,
  title      TEXT,
  updated_at INTEGER
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('theme', 'kaca');
"#;
