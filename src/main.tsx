import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import 'katex/dist/katex.min.css'
import './styles/index.css'

// Sebagian WKWebView (dipakai aplikasi Mac ini) belum punya Promise.withResolvers
// walau Safari/macOS-nya sendiri sudah cukup baru — WKWebView tidak selalu sejajar
// fiturnya dengan Safari.app. pdfjs-dist memakai fungsi ini sejak versi 4.5; tanpa
// pengisi ini, impor PDF gagal diam-diam dengan "Cannot access uninitialized
// variable" alih-alih pesan yang jelas.
const promiseMungkinBelumPunya = Promise as unknown as {
  withResolvers?: <T>() => { promise: Promise<T>; resolve: (value: T | PromiseLike<T>) => void; reject: (reason?: unknown) => void }
}
if (typeof promiseMungkinBelumPunya.withResolvers !== 'function') {
  promiseMungkinBelumPunya.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => {
      resolve = res
      reject = rej
    })
    return { promise, resolve, reject }
  }
}

// Sama alasannya: sebagian WKWebView belum punya global `Iterator` (usulan
// "Iterator Helpers" ES2025) sama sekali. pdf.js sudah membawa pengisi
// metode-metodenya sendiri (map/filter/drop/dst.) di dalam kodenya sendiri —
// tapi pengisi itu cuma menambah metode ke `Iterator.prototype` yang SUDAH
// ADA; kalau globalnya sendiri tidak ada, ia gagal duluan dengan "Can't find
// variable: Iterator". Kerangka kosong di sini cukup: sisanya pdf.js sendiri
// yang mengisi.
const globalMungkinBelumPunyaIterator = globalThis as unknown as { Iterator?: new () => object }
if (typeof globalMungkinBelumPunyaIterator.Iterator === 'undefined') {
  globalMungkinBelumPunyaIterator.Iterator = class {}
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
