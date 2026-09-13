// OCR halaman PDF memakai framework Vision bawaan macOS (Neural Engine).
// Tanpa GPU diskret, tanpa unduhan model, tanpa biaya.
//
// Pakai:  visionocr <berkas.pdf> [halaman_awal] [halaman_akhir] [dpi]
// Keluar: JSON Lines, satu baris per halaman: {"hal":1,"teks":"...","yakin":0.93,"detik":0.41}

import Foundation
import Vision
import PDFKit
import CoreGraphics
import ImageIO

func gambarHalaman(_ hal: PDFPage, dpi: CGFloat) -> CGImage? {
    let kotak = hal.bounds(for: .mediaBox)
    let skala = dpi / 72.0
    let w = Int(kotak.width * skala), h = Int(kotak.height * skala)
    guard w > 0, h > 0, w < 20000, h < 20000,
          let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8,
                              bytesPerRow: 0, space: CGColorSpaceCreateDeviceGray(),
                              bitmapInfo: CGImageAlphaInfo.none.rawValue) else { return nil }
    ctx.setFillColor(CGColor(gray: 1, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: w, height: h))
    ctx.scaleBy(x: skala, y: skala)
    ctx.translateBy(x: -kotak.origin.x, y: -kotak.origin.y)
    hal.draw(with: .mediaBox, to: ctx)
    return ctx.makeImage()
}

func bacaTeks(_ img: CGImage) -> (String, Double) {
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = .accurate
    // Naskah berbahasa Indonesia: koreksi bahasa Inggris justru merusak kata,
    // jadi dimatikan. Vision tetap mengenali aksara Latin dengan baik.
    req.usesLanguageCorrection = false
    req.recognitionLanguages = ["en-US"]
    let handler = VNImageRequestHandler(cgImage: img, options: [:])
    do { try handler.perform([req]) } catch { return ("", 0) }
    guard let hasil = req.results else { return ("", 0) }
    var baris: [String] = []; var jumlah = 0.0; var n = 0
    for amatan in hasil {
        guard let top = amatan.topCandidates(1).first else { continue }
        baris.append(top.string); jumlah += Double(top.confidence); n += 1
    }
    return (baris.joined(separator: "\n"), n > 0 ? jumlah / Double(n) : 0)
}

let arg = CommandLine.arguments
guard arg.count >= 2 else { exit(1) }
let jalur = URL(fileURLWithPath: arg[1])

// Foto/tangkapan layar ditangani langsung; hanya PDF yang perlu dirender per halaman.
let ekstensiGambar: Set<String> = ["png","jpg","jpeg","heic","tif","tiff","gif","bmp","webp"]
if ekstensiGambar.contains(jalur.pathExtension.lowercased()) {
    guard let src = CGImageSourceCreateWithURL(jalur as CFURL, nil),
          let img = CGImageSourceCreateImageAtIndex(src, 0, nil) else {
        FileHandle.standardError.write("tidak bisa membuka gambar\n".data(using: .utf8)!)
        exit(1)
    }
    let t0 = Date()
    let (teks, yakin) = bacaTeks(img)
    let rekam: [String: Any] = ["hal": 1, "teks": teks,
                                "yakin": (yakin * 1000).rounded() / 1000,
                                "detik": (Date().timeIntervalSince(t0) * 1000).rounded() / 1000]
    if let d = try? JSONSerialization.data(withJSONObject: rekam),
       let s = String(data: d, encoding: .utf8) { print(s) }
    exit(0)
}

guard let doc = PDFDocument(url: jalur) else {
    FileHandle.standardError.write("tidak bisa membuka PDF\n".data(using: .utf8)!)
    exit(1)
}
let awal  = arg.count > 2 ? max(1, Int(arg[2]) ?? 1) : 1
let akhir = arg.count > 3 ? min(doc.pageCount, Int(arg[3]) ?? doc.pageCount) : doc.pageCount
let dpi   = arg.count > 4 ? CGFloat(Double(arg[4]) ?? 200) : 200

for i in awal...max(awal, akhir) {
    guard i <= doc.pageCount, let hal = doc.page(at: i - 1) else { continue }
    let t0 = Date()
    var teks = ""; var yakin = 0.0
    if let img = gambarHalaman(hal, dpi: dpi) { (teks, yakin) = bacaTeks(img) }
    let rekam: [String: Any] = ["hal": i, "teks": teks,
                                "yakin": (yakin * 1000).rounded() / 1000,
                                "detik": (Date().timeIntervalSince(t0) * 1000).rounded() / 1000]
    if let d = try? JSONSerialization.data(withJSONObject: rekam),
       let s = String(data: d, encoding: .utf8) { print(s) }
}
