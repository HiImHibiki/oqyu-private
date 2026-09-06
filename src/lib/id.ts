/** ID pendek, urut secara waktu, aman dipakai sebagai kunci primer teks. */
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'

function random(n: number): string {
  const bytes = new Uint8Array(n)
  crypto.getRandomValues(bytes)
  let out = ''
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${random(5)}`
}
