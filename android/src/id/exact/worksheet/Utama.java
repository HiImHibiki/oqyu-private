package id.exact.worksheet;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
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
        Toast.makeText(this, "Mengirim " + daftar.size() + " berkas ke Mac…",
                Toast.LENGTH_SHORT).show();
        final ArrayList<Uri> kirim = daftar;
        new Thread(() -> {
            int ok = 0; String galat = null;
            for (Uri u : kirim) {
                try { unggah(u); ok++; }
                catch (Exception e) { galat = e.getMessage(); }
            }
            final int n = ok; final String g = galat;
            new Handler(Looper.getMainLooper()).post(() -> {
                Toast.makeText(this, n > 0
                        ? n + " berkas dikirim. Lembar sedang dibuat di Mac."
                        : "Gagal mengirim: " + g, Toast.LENGTH_LONG).show();
                finish();
            });
        }).start();
    }

    private void unggah(Uri u) throws IOException {
        String nama = namaBerkas(u);
        String mode = p.getString("mode", "buat");
        String batas = "----exact" + System.currentTimeMillis();
        HttpURLConnection c = (HttpURLConnection) new URL(dasar() + "/terima").openConnection();
        c.setDoOutput(true);
        c.setRequestMethod("POST");
        c.setConnectTimeout(10000);
        c.setReadTimeout(120000);
        c.setChunkedStreamingMode(64 * 1024);
        c.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + batas);

        OutputStream o = new BufferedOutputStream(c.getOutputStream());
        tulis(o, "--" + batas + "\r\n");
        tulis(o, "Content-Disposition: form-data; name=\"mode\"\r\n\r\n" + mode + "\r\n");
        tulis(o, "--" + batas + "\r\n");
        tulis(o, "Content-Disposition: form-data; name=\"berkas\"; filename=\"" + nama + "\"\r\n");
        tulis(o, "Content-Type: application/octet-stream\r\n\r\n");
        try (InputStream in = getContentResolver().openInputStream(u)) {
            byte[] buf = new byte[64 * 1024]; int n;
            while (in != null && (n = in.read(buf)) > 0) o.write(buf, 0, n);
        }
        tulis(o, "\r\n--" + batas + "--\r\n");
        o.flush();
        int kode = c.getResponseCode();
        if (kode != 200) throw new IOException("server menjawab " + kode);
        c.getInputStream().close();
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
