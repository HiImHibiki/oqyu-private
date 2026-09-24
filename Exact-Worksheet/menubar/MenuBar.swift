// Exact Worksheet — pengendali di menu bar.
//
// Menyalakan server, menyalin perintah AI untuk naskah manual, dan membuka
// aplikasi. Satu berkas Swift, dikompilasi dengan swiftc — tidak
// perlu Xcode maupun SwiftPM.

import AppKit
import Foundation
import UserNotifications

/// Mata pelajaran yang punya paket diagram sendiri di prompt-builder.js.
/// Slug-nya harus sama persis dengan kunci SUBJECT_PRESETS di sana.
let MAPEL: [(slug: String, nama: String)] = [
    ("matematika", "Matematika"), ("fisika", "Fisika"), ("kimia", "Kimia"),
    ("biologi", "Biologi"), ("bahasa-indonesia", "Bahasa Indonesia"),
    ("bahasa-inggris", "Bahasa Inggris"),
]

let PORT = 7790
let AKAR = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().path

func url(_ jalur: String) -> URL { URL(string: "http://localhost:\(PORT)\(jalur)")! }

func minta(_ jalur: String, timeout: TimeInterval = 10,
           selesai: @escaping ([String: Any]?) -> Void) {
    var r = URLRequest(url: url(jalur))
    r.timeoutInterval = timeout
    URLSession.shared.dataTask(with: r) { d, _, _ in
        let j = d.flatMap { try? JSONSerialization.jsonObject(with: $0) }
        DispatchQueue.main.async { selesai(j as? [String: Any]) }
    }.resume()
}

final class Delegate: NSObject, NSApplicationDelegate {
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    let menu = NSMenu()
    var mServer = NSMenuItem()
    var mPrompt = NSMenuItem()
    var server: Process?

    func applicationDidFinishLaunching(_: Notification) {
        UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound]) { _, _ in }

        item.button?.title = "EW"
        item.button?.toolTip = "Exact Worksheet"

        tambah("Buka aplikasi", #selector(bukaHalaman))

        /* Untuk naskah yang disusun manual: salin perintahnya, tempel ke AI
         * mana pun, lalu balasannya ditempel di tab "Naskah Manual" aplikasi.
         * Bersubmenu per mapel karena daftar tag diagram yang boleh dipakai
         * memang berbeda tiap mapel. */
        mPrompt.title = "Salin prompt AI (naskah manual)"
        let sub = NSMenu()
        for m in MAPEL {
            let it = NSMenuItem(title: m.nama, action: #selector(salinPrompt(_:)), keyEquivalent: "")
            it.target = self
            it.representedObject = m.slug
            sub.addItem(it)
        }
        mPrompt.submenu = sub
        menu.addItem(mPrompt)

        tambah("Buka folder hasil", #selector(bukaHasil))
        tambah("Restart Chrome kendali", #selector(ulangChrome))
        tambah("Restart aplikasi (kosongkan antrean)", #selector(ulangAplikasi))
        menu.addItem(.separator())

        mServer.title = "Server: memeriksa…"
        mServer.action = #selector(alihServer)
        mServer.target = self
        menu.addItem(mServer)
        menu.addItem(.separator())
        tambah("Keluar", #selector(keluar))

        item.menu = menu
        Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { _ in self.perbarui() }
        perbarui()
    }

    func tambah(_ judul: String, _ aksi: Selector) {
        let m = NSMenuItem(title: judul, action: aksi, keyEquivalent: "")
        m.target = self
        menu.addItem(m)
    }

    func kabar(_ judul: String, _ isi: String) {
        let c = UNMutableNotificationContent()
        c.title = judul; c.body = isi; c.sound = .default
        UNUserNotificationCenter.current().add(
            UNNotificationRequest(identifier: UUID().uuidString, content: c, trigger: nil))
    }

    // MARK: keadaan

    func perbarui() {
        minta("/status", timeout: 3) { _ in }      // sekadar menguji server hidup
        var r = URLRequest(url: url("/status")); r.timeoutInterval = 3
        URLSession.shared.dataTask(with: r) { d, resp, _ in
            let hidup = (resp as? HTTPURLResponse)?.statusCode == 200
            DispatchQueue.main.async {
                self.mServer.title = hidup ? "Server: nyala — matikan" : "Server: mati — nyalakan"
                self.mPrompt.isEnabled = hidup
            }
            _ = d
        }.resume()
    }

    // MARK: aksi

    /// Perintah AI untuk naskah manual, disalin ke papan klip. Diambil dari
    /// server (yang membangunnya lewat prompt-builder.js milik aplikasi),
    /// bukan ditulis ulang di sini, supaya tidak pernah kedaluwarsa terhadap
    /// format naskah yang sedang berlaku.
    @objc func salinPrompt(_ pengirim: NSMenuItem) {
        let slug = (pengirim.representedObject as? String) ?? "matematika"
        minta("/api/prompt?mapel=\(slug)", timeout: 30) { j in
            guard let teks = j?["prompt"] as? String, !teks.isEmpty else {
                self.kabar("Prompt gagal disalin",
                           (j?["galat"] as? String) ?? "Server tidak menjawab.")
                return
            }
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(teks, forType: .string)
            self.kabar("Prompt \(pengirim.title) disalin",
                       "Tempel ke AI, isi blok di bagian bawahnya, lalu tempel balasannya di tab «Naskah Manual».")
        }
    }

    @objc func bukaHalaman() { NSWorkspace.shared.open(url("/")) }

    /// Chrome kendali macet (menu tak terbuka, Gemini menolak terus): tutup dan
    /// nyalakan lagi lewat server, lalu kabari hasilnya.
    @objc func ulangChrome() {
        minta("/chrome/ulang", timeout: 60) { j in
            if let g = j?["galat"] as? String { self.kabar("Chrome gagal dinyalakan ulang", String(g.prefix(120))) }
            else { self.kabar("Chrome kendali", (j?["pesan"] as? String) ?? "Dinyalakan ulang.") }
        }
    }

    @objc func bukaHasil() {
        NSWorkspace.shared.open(URL(fileURLWithPath: NSHomeDirectory() + "/Desktop"))
    }

    @objc func alihServer() {
        if mServer.title.contains("nyala") {
            server?.terminate(); server = nil
            _ = jalankan("/usr/bin/pkill", ["-f", "cari.py"])
        } else {
            let p = Process()
            p.executableURL = URL(fileURLWithPath: "/usr/bin/env")
            p.arguments = ["python3", AKAR + "/cari.py"]
            p.currentDirectoryURL = URL(fileURLWithPath: AKAR)
            var env = ProcessInfo.processInfo.environment
            if env["EXACT_API"] == nil { env["EXACT_API"] = "http://100.91.114.104:11434/v1/chat/completions" }
            p.environment = env
            try? p.run()
            server = p
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self.perbarui() }
    }

    @discardableResult
    func jalankan(_ alat: String, _ arg: [String]) -> Int32 {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: alat)
        p.arguments = arg
        try? p.run(); p.waitUntilExit()
        return p.terminationStatus
    }

    /// Semua tugas dihapus, antrean dikosongkan, layanan dimulai ulang lewat launchd.
    @objc func ulangAplikasi() {
        let a = NSAlert(); a.messageText = "Mulai ulang Exact Worksheet?"
        a.informativeText = "Semua tugas yang sedang berjalan dan mengantre akan dihapus."
        a.addButton(withTitle: "Mulai ulang"); a.addButton(withTitle: "Batal")
        NSApp.activate(ignoringOtherApps: true)
        guard a.runModal() == .alertFirstButtonReturn else { return }
        var r = URLRequest(url: url("/aplikasi/ulang")); r.httpMethod = "POST"; r.timeoutInterval = 15
        URLSession.shared.dataTask(with: r) { d, _, _ in
            let j = d.flatMap { try? JSONSerialization.jsonObject(with: $0) } as? [String: Any]
            DispatchQueue.main.async { self.kabar("Exact Worksheet", (j?["pesan"] as? String) ?? "Dimulai ulang.") }
        }.resume()
    }

    @objc func keluar() { NSApp.terminate(nil) }
}

let app = NSApplication.shared
let delegate = Delegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)     // hanya di menu bar, tanpa ikon Dock
app.run()
