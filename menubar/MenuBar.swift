// Exact Worksheet — pengendali di menu bar.
//
// Menyalakan server, membuat lembar langsung dari papan klip, dan memberi tahu
// begitu PDF selesai. Satu berkas Swift, dikompilasi dengan swiftc — tidak
// perlu Xcode maupun SwiftPM.

import AppKit
import Foundation
import UserNotifications

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
    var mKerja = NSMenuItem()
    var jidBerjalan: String?
    var server: Process?

    func applicationDidFinishLaunching(_: Notification) {
        UNUserNotificationCenter.current()
            .requestAuthorization(options: [.alert, .sound]) { _, _ in }

        item.button?.title = "EW"
        item.button?.toolTip = "Exact Worksheet"

        mKerja.title = "Buat dari papan klip"
        mKerja.action = #selector(dariKlip)
        mKerja.keyEquivalent = "n"
        mKerja.target = self
        menu.addItem(mKerja)

        tambah("Buka aplikasi", #selector(bukaHalaman))
        tambah("Buka folder hasil", #selector(bukaHasil))
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
                self.mKerja.isEnabled = hidup
            }
            guard hidup, let jid = self.jidBerjalan, let d = d else { return }
            _ = d
            self.pantau(jid)
        }.resume()
    }

    func pantau(_ jid: String) {
        minta("/status?jid=\(jid)", timeout: 5) { j in
            guard let j = j else { return }
            let maju = (j["maju"] as? Int) ?? 0
            let selesai = (j["selesai"] as? Bool) ?? false
            let langkah = (j["langkah"] as? [String])?.last ?? ""
            self.mKerja.title = selesai ? "Buat dari papan klip" : "Membuat… \(maju)%"
            if selesai {
                self.jidBerjalan = nil
                if let g = j["galat"] as? String {
                    self.kabar("Gagal membuat lembar", String(g.prefix(120)))
                } else {
                    self.kabar("Lembar kerja siap", langkah)
                }
            }
        }
    }

    // MARK: aksi

    @objc func dariKlip() {
        mKerja.title = "Membuat… 0%"
        minta("/cepat", timeout: 20) { j in
            if let jid = j?["jid"] as? String {
                self.jidBerjalan = jid
            } else {
                self.mKerja.title = "Buat dari papan klip"
                self.kabar("Tidak bisa mulai",
                           (j?["galat"] as? String) ?? "Papan klip tidak berisi gambar")
            }
        }
    }

    @objc func bukaHalaman() { NSWorkspace.shared.open(url("/")) }

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

    @objc func keluar() { NSApp.terminate(nil) }
}

let app = NSApplication.shared
let delegate = Delegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)     // hanya di menu bar, tanpa ikon Dock
app.run()
