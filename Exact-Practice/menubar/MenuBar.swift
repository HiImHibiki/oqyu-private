// Exact Practice — pengendali di menu bar.
//
// Menunjukkan apakah layanan (LaunchAgent com.exactcourse.practice, port 8770)
// hidup, membuka halaman-halaman guru, dan bisa menyalakan/mematikan
// layanannya. Satu berkas Swift, dikompilasi dengan swiftc — tanpa Xcode.

import AppKit
import Foundation

let PORT = 8770
let LABEL = "com.exactcourse.practice"
let PUBLIK = "https://practice2.exactprintsolution.com"
let PLIST = NSHomeDirectory() + "/Library/LaunchAgents/\(LABEL).plist"
let LOG = NSHomeDirectory() + "/Library/Logs/exact-practice.log"

func lokal(_ jalur: String) -> URL { URL(string: "http://127.0.0.1:\(PORT)\(jalur)")! }

final class Delegate: NSObject, NSApplicationDelegate {
    let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    let menu = NSMenu()
    var mStatus = NSMenuItem()
    var mAlih = NSMenuItem()
    var hidup = false

    func applicationDidFinishLaunching(_: Notification) {
        item.button?.title = "EP"
        item.button?.toolTip = "Exact Practice"

        mStatus.title = "Memeriksa layanan…"
        mStatus.isEnabled = false
        menu.addItem(mStatus)
        menu.addItem(.separator())
        tambah("Buka Exact Practice (practice2)", #selector(bukaPublik), "o")
        tambah("Buka di Mac ini (localhost)", #selector(bukaLokal))
        menu.addItem(.separator())
        tambah("Buat latihan", #selector(bukaBuat))
        tambah("Pantau kelas", #selector(bukaKelas))
        tambah("Pesanan", #selector(bukaPesanan))
        tambah("Peserta (persetujuan)", #selector(bukaPeserta))
        menu.addItem(.separator())
        mAlih.title = "Nyalakan layanan"
        mAlih.action = #selector(alih); mAlih.target = self
        menu.addItem(mAlih)
        tambah("Mulai ulang layanan", #selector(mulaiUlang))
        tambah("Buka log", #selector(bukaLog))
        menu.addItem(.separator())
        tambah("Keluar dari menu bar", #selector(keluar))

        item.menu = menu
        Timer.scheduledTimer(withTimeInterval: 5, repeats: true) { _ in self.perbarui() }
        perbarui()
    }

    func tambah(_ judul: String, _ aksi: Selector, _ tombol: String = "") {
        let m = NSMenuItem(title: judul, action: aksi, keyEquivalent: tombol)
        m.target = self
        menu.addItem(m)
    }

    func perbarui() {
        var r = URLRequest(url: lokal("/masuk")); r.timeoutInterval = 3
        URLSession.shared.dataTask(with: r) { _, resp, _ in
            let ok = (resp as? HTTPURLResponse).map { (200..<400).contains($0.statusCode) } ?? false
            DispatchQueue.main.async {
                self.hidup = ok
                self.mStatus.title = ok ? "Layanan: nyala (port \(PORT))" : "Layanan: mati"
                self.mAlih.title = ok ? "Matikan layanan" : "Nyalakan layanan"
                self.item.button?.title = ok ? "EP" : "EP·"
            }
        }.resume()
    }

    @discardableResult
    func jalankan(_ alat: String, _ arg: [String]) -> Int32 {
        let p = Process()
        p.executableURL = URL(fileURLWithPath: alat)
        p.arguments = arg
        try? p.run(); p.waitUntilExit()
        return p.terminationStatus
    }

    var domain: String { "gui/\(getuid())" }

    @objc func alih() {
        if hidup {
            jalankan("/bin/launchctl", ["bootout", "\(domain)/\(LABEL)"])
        } else {
            if jalankan("/bin/launchctl", ["bootstrap", domain, PLIST]) != 0 {
                jalankan("/bin/launchctl", ["kickstart", "-k", "\(domain)/\(LABEL)"])
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { self.perbarui() }
    }

    @objc func mulaiUlang() {
        jalankan("/bin/launchctl", ["bootout", "\(domain)/\(LABEL)"])
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            self.jalankan("/bin/launchctl", ["bootstrap", self.domain, PLIST])
            DispatchQueue.main.asyncAfter(deadline: .now() + 4) { self.perbarui() }
        }
    }

    @objc func bukaPublik() { NSWorkspace.shared.open(URL(string: PUBLIK + "/latihan")!) }
    @objc func bukaLokal() { NSWorkspace.shared.open(lokal("/latihan")) }
    @objc func bukaBuat() { NSWorkspace.shared.open(URL(string: PUBLIK + "/admin/latihan")!) }
    @objc func bukaKelas() { NSWorkspace.shared.open(URL(string: PUBLIK + "/admin/kelas")!) }
    @objc func bukaPesanan() { NSWorkspace.shared.open(URL(string: PUBLIK + "/admin/pesanan")!) }
    @objc func bukaPeserta() { NSWorkspace.shared.open(URL(string: PUBLIK + "/admin/peserta")!) }
    @objc func bukaLog() { NSWorkspace.shared.open(URL(fileURLWithPath: LOG)) }
    @objc func keluar() { NSApp.terminate(nil) }
}

let app = NSApplication.shared
let delegate = Delegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)     // hanya di menu bar, tanpa ikon Dock
app.run()
