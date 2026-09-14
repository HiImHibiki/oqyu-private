package id.exact.worksheet;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.util.Log;
import android.widget.*;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;

/**
 * Satu layar untuk dua peran:
 *  - dibuka biasa  : layar setelan (Mac mana, kiriman diperlakukan sebagai apa)
 *  - dibuka lewat "Open with" / "Bagikan" : berkas langsung dikirim ke Mac
 */
public class Utama extends Activity {

    private static final String PREF = "exact";
    private SharedPreferences p;
    private EditText alamat;
    private TextView kabar;
    private RadioGroup pilihMac, pilihMode;

    @Override protected void onCreate(Bundle b) {
        super.onCreate(b);
        p = getSharedPreferences(PREF, MODE_PRIVATE);

        Intent it = getIntent();
        String aksi = it == null ? null : it.getAction();
        if (Intent.ACTION_VIEW.equals(aksi) || Intent.ACTION_SEND.equals(aksi)
                || Intent.ACTION_SEND_MULTIPLE.equals(aksi)) {
            kirimDariIntent(it);
            return;                      // tanpa tampilan: kirim lalu tutup
        }

        setContentView(R.layout.utama);
        alamat = findViewById(R.id.alamat);
        kabar = findViewById(R.id.kabar);
        pilihMac = findViewById(R.id.pilihMac);
        pilihMode = findViewById(R.id.pilihMode);

        String tersimpan = p.getString("alamat", "100.83.25.73");
        alamat.setText(tersimpan);
        if (tersimpan.equals("100.83.25.73")) pilihMac.check(R.id.macRico);
        else if (tersimpan.equals("100.70.73.4")) pilihMac.check(R.id.macVelisia);
        else pilihMac.check(R.id.macLain);
        pilihMode.check(p.getString("mode", "buat").equals("jawab")
                ? R.id.modeJawab : R.id.modeBuat);

        pilihMac.setOnCheckedChangeListener((g, id) -> {
            if (id == R.id.macRico) alamat.setText("100.83.25.73");
            else if (id == R.id.macVelisia) alamat.setText("100.70.73.4");
            simpan();
        });
        pilihMode.setOnCheckedChangeListener((g, id) -> simpan());
        alamat.setOnFocusChangeListener((v, f) -> { if (!f) simpan(); });

        findViewById(R.id.uji).setOnClickListener(v -> uji());
        findViewById(R.id.buka).setOnClickListener(v ->
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(dasar() + "/"))));
    }

    private void simpan() {
        p.edit().putString("alamat", alamat.getText().toString().trim())
                .putString("mode", pilihMode.getCheckedRadioButtonId() == R.id.modeJawab
                        ? "jawab" : "buat").apply();
    }

    private String dasar() {
        String a = p.getString("alamat", "100.83.25.73").trim();
        if (a.startsWith("http")) return a;
        return "http://" + a + ":7790";
    }

    private void uji() {
        kabar.setText("menguji…");
        new Thread(() -> {
            String hasil;
            try {
                HttpURLConnection c = (HttpURLConnection) new URL(dasar() + "/status").openConnection();
                c.setConnectTimeout(6000); c.setReadTimeout(6000);
                hasil = c.getResponseCode() == 200
                        ? "Tersambung. Mac siap menerima."
                        : "Server menjawab " + c.getResponseCode();
            } catch (Exception e) {
                hasil = "Tidak tersambung: " + e.getClass().getSimpleName()
                        + "\nPastikan Tailscale menyala di kedua perangkat.";
            }
            final String f = hasil;
            new Handler(Looper.getMainLooper()).post(() -> kabar.setText(f));
        }).start();
    }

    // ---------------------------------------------------------------- kirim

    private void kirimDariIntent(Intent it) {
        ArrayList<Uri> daftar = new ArrayList<>();
        if (Intent.ACTION_SEND_MULTIPLE.equals(it.getAction())) {
            ArrayList<Uri> m = it.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
            if (m != null) daftar.addAll(m);
        } else {
            Uri u = it.getData();
            if (u == null) u = it.getParcelableExtra(Intent.EXTRA_STREAM);
            if (u != null) daftar.add(u);
        }
        if (daftar.isEmpty()) {
            Toast.makeText(this, "Tidak ada berkas", Toast.LENGTH_LONG).show();
            finish(); return;
        }
        Log.i("ExactWS", "kirim " + daftar.size() + " berkas ke " + dasar());
        final ArrayList<Uri> kirim = daftar;
        // Ditanyakan tiap kali, bukan dari setelan: satu foto bisa jadi bahan
        // soal baru hari ini dan perlu kunci jawaban besok.
        final String[] pilihan = {"Soal baru", "Kunci & pembahasan", "Rangkuman"};
        final String[] modeDari = {"buat", "jawab", "rangkum"};
        new AlertDialog.Builder(this)
            .setTitle(kirim.size() + " berkas — mau dijadikan apa?")
            .setItems(pilihan, (d, w) -> mulai(kirim, modeDari[w]))
            .setNegativeButton("Batal", (d, w) -> finish())
            .setOnCancelListener(d -> finish())
            .show();
    }

    private void mulai(ArrayList<Uri> kirim, final String mode) {
        p.edit().putString("mode", mode).apply();
        Toast.makeText(this, "Mengirim " + kirim.size() + " berkas ke Mac…",
                Toast.LENGTH_SHORT).show();
        new Thread(() -> {
            String buka = null, galat = null; int ok = 0;
            try {
                // SEMUA berkas dikirim dalam SATU permintaan. Versi sebelumnya
                // mengirim satu per satu, sehingga tiap foto jadi titipan
                // terpisah dan hanya yang pertama terbuka di aplikasi.
                String jawab = unggahSemua(kirim, mode);
                ok = kirim.size();
                buka = ambilNilai(jawab, "buka");
            } catch (Exception e) {
                galat = e.getClass().getSimpleName() + ": " + e.getMessage();
                Log.e("ExactWS", "gagal unggah", e);
            }
            final int n = ok; final String g = galat; final String url = buka;
            new Handler(Looper.getMainLooper()).post(() -> {
                if (n > 0 && url != null) {
                    Toast.makeText(this, n + " berkas terkirim. Membuka aplikasi…",
                            Toast.LENGTH_SHORT).show();
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(dasar() + url)));
                    } catch (Exception e) {
                        Toast.makeText(this, "Terkirim, buka " + dasar() + url,
                                Toast.LENGTH_LONG).show();
                    }
                } else {
                    Toast.makeText(this, "Gagal mengirim: " + g, Toast.LENGTH_LONG).show();
                }
                finish();
            });
        }).start();
    }

    /** Ambil satu nilai dari JSON sederhana tanpa pustaka luar. */
    private String ambilNilai(String json, String kunci) {
        if (json == null) return null;
        int i = json.indexOf("\"" + kunci + "\"");
        if (i < 0) return null;
        int a = json.indexOf('"', json.indexOf(':', i) + 1);
        int b = json.indexOf('"', a + 1);
        return (a < 0 || b < 0) ? null : json.substring(a + 1, b);
    }

    private String unggahSemua(ArrayList<Uri> daftar, String sasaran) throws IOException {
        String batas = "----exact" + System.currentTimeMillis();

        // Badan disusun di memori dulu supaya Content-Length bisa dipastikan.
        // Mode chunked membuat server membaca nol byte dan menolak dengan 400.
        ByteArrayOutputStream badan = new ByteArrayOutputStream();
        tulis(badan, "--" + batas + "\r\n");
        tulis(badan, "Content-Disposition: form-data; name=\"mode\"\r\n\r\ntitip\r\n");
        tulis(badan, "--" + batas + "\r\n");
        tulis(badan, "Content-Disposition: form-data; name=\"sasaran\"\r\n\r\n" + sasaran + "\r\n");
        for (Uri u : daftar) {
            String nama = namaBerkas(u);
            tulis(badan, "--" + batas + "\r\n");
            tulis(badan, "Content-Disposition: form-data; name=\"berkas\"; filename=\"" + nama + "\"\r\n");
            tulis(badan, "Content-Type: application/octet-stream\r\n\r\n");
            try (InputStream in = getContentResolver().openInputStream(u)) {
                if (in == null) throw new IOException("berkas tidak bisa dibuka: " + nama);
                byte[] buf = new byte[64 * 1024]; int n;
                while ((n = in.read(buf)) > 0) badan.write(buf, 0, n);
            }
            tulis(badan, "\r\n");
        }
        tulis(badan, "--" + batas + "--\r\n");
        byte[] isi = badan.toByteArray();

        HttpURLConnection c = (HttpURLConnection) new URL(dasar() + "/terima").openConnection();
        c.setDoOutput(true);
        c.setRequestMethod("POST");
        c.setConnectTimeout(10000);
        c.setReadTimeout(180000);
        c.setFixedLengthStreamingMode(isi.length);
        c.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + batas);
        try (OutputStream o = new BufferedOutputStream(c.getOutputStream())) {
            o.write(isi);
        }
        int kode = c.getResponseCode();
        if (kode != 200) throw new IOException("server menjawab " + kode);
        ByteArrayOutputStream jawab = new ByteArrayOutputStream();
        try (InputStream in = c.getInputStream()) {
            byte[] buf = new byte[4096]; int n;
            while ((n = in.read(buf)) > 0) jawab.write(buf, 0, n);
        }
        return jawab.toString("UTF-8");
    }

    private void tulis(OutputStream o, String s) throws IOException {
        o.write(s.getBytes("UTF-8"));
    }

    private String namaBerkas(Uri u) {
        String n = null;
        try (android.database.Cursor k = getContentResolver().query(u, null, null, null, null)) {
            if (k != null && k.moveToFirst()) {
                int i = k.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME);
                if (i >= 0) n = k.getString(i);
            }
        } catch (Exception ignore) { }
        if (n == null) n = u.getLastPathSegment();
        if (n == null) n = "kiriman";
        return n.replace('"', '_');
    }
}
