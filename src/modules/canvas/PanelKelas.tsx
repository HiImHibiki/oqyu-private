import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { IconButton } from '@/components/ui/Button'
import { useData } from '@/lib/useData'
import { useSinkron } from '@/lib/sinkron'
import { urlDenganPin } from '@/lib/api'
import { toast, toastGalat } from '@/lib/toast'
import { daftarKanvas } from './data'
import {
  RUANGAN,
  anggotaGrup,
  bisukanMurid,
  izinkanCoret,
  buatGrup,
  kosongkanAntrean,
  daftarAkun,
  daftarGrup,
  daftarMurid,
  daftarMuridSemua,
  daftarTanya,
  hapusGrup,
  lamaMenunggu,
  resetSandiAkun,
  setujuiAkun,
  tetapkanGrup,
  ubahGrup,
  ubahTanya,
  useKelas,
  type Grup,
  type Murid,
  type Tanya,
} from '@/lib/kelas'

type Tab = 'antrian' | 'murid' | 'grup'

/**
 * Panel kelas di rel kanvas: ruangan editor ini, antrian pertanyaan murid,
 * daftar murid dengan lampu fokus, dan grup dengan tampilan yang bisa dipilih.
 */
export function PanelKelas({
  onBahas,
}: {
  /** Guru membuka pertanyaan: URL foto (kalau ada) untuk ditempel ke kanvas. */
  onBahas: (t: Tanya, urlFoto: string | null) => void
}) {
  const [tab, setTab] = useState<Tab>('antrian')
  const { data: daftarSketsa } = useData('canvas', daftarKanvas, [])
  const ruang = useKelas((s) => s.ruang)
  const setRuang = useKelas((s) => s.setRuang)
  const klien = useSinkron((s) => s.klien)
  const { data: antrian } = useData('kelas', daftarTanya, [])
  const { data: murid } = useData('kelas', daftarMurid, [])
  const { data: grup } = useData('kelas', daftarGrup, [])
  const { data: anggota } = useData('kelas', anggotaGrup, [])
  const { data: akun } = useData('kelas', daftarAkun, [])
  const { data: semuaMurid } = useData('kelas', daftarMuridSemua, [])
  const menungguSetuju = akun.filter((a) => !a.disetujui)

  const petaGrupMurid = useMemo(() => new Map(anggota.map((a) => [a.student_id, a.group_id])), [anggota])
  const hadir = useMemo(() => new Map(klien.filter((k) => k.murid).map((k) => [k.murid, k])), [klien])
  const editorLain = klien.filter((k) => k.peran === 'editor')
  const menunggu = antrian.filter((t) => t.status === 'menunggu').length

  return (
    <>
      <div className="flex items-center gap-1">
        <span className="ex-label" style={{ color: 'var(--ink-soft)' }}>
          I am in room
        </span>
        {RUANGAN.map((r) => (
          <button
            key={r}
            className="ex-btn"
            data-variant={ruang === r ? 'accent' : 'ghost'}
            style={{ padding: '3px 9px' }}
            onClick={() => setRuang(r)}
          >
            {r}
          </button>
        ))}
      </div>

      <div className="flex gap-1">
        {(
          [
            ['antrian', `Queue${menunggu ? ` · ${menunggu}` : ''}`],
            ['murid', `Students · ${murid.length}`],
            ['grup', `Groups · ${grup.length}`],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            className="ex-btn flex-1 justify-center"
            data-variant={tab === id ? 'accent' : 'ghost'}
            style={{ padding: '4px 0', fontSize: 'var(--fs-label)' }}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'antrian' && (
        <div className="flex flex-col gap-1">
          {antrian.length > 1 && (
            <button
              className="ex-btn self-end"
              data-variant="ghost"
              style={{ padding: '3px 8px', fontSize: 11 }}
              title="Close every open question"
              onClick={() => void kosongkanAntrean().then(() => toast('Queue cleared.'))}
            >
              <Icon nama="silang" ukuran={12} /> Clear queue
            </button>
          )}
          {antrian.length === 0 && (
            <p className="ex-label" style={{ color: 'var(--ink-faint)' }}>
              No one is waiting. Students raise a hand or send a question from their phone.
            </p>
          )}
          {antrian.map((t) => (
            <BarisTanya
              key={t.id}
              t={t}
              grup={grup.find((g) => g.id === petaGrupMurid.get(t.student_id)) ?? null}
              onBahas={() => onBahas(t, t.photo ? urlDenganPin(`/api/kelas/foto/${encodeURIComponent(t.photo)}`) : null)}
              onSelesai={() => void ubahTanya(t.id, 'selesai').catch(() => toastGalat('Could not close it.'))}
            />
          ))}
        </div>
      )}

      {tab === 'murid' && (
        <div className="flex flex-col gap-1">
          {menungguSetuju.length > 0 && (
            <div className="ex-card flex flex-col gap-1 p-2" style={{ borderColor: 'var(--accent)' }}>
              <span className="ex-label" style={{ color: 'var(--accent)' }}>
                Waiting for your approval · {menungguSetuju.length}
              </span>
              {menungguSetuju.map((a) => (
                <div key={a.id} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate" style={{ fontSize: 'var(--fs-label)' }}>
                    {a.nama}
                    <span className="ex-num" style={{ marginLeft: 6, fontSize: 11, color: 'var(--ink-faint)' }}>
                      {a.hp}
                    </span>
                  </span>
                  <IconButton
                    nama="centang"
                    label={`Accept ${a.nama}`}
                    ukuran={13}
                    onClick={() => setujuiAkun(a.id, true).then(() => toast(`${a.nama} accepted.`)).catch(toastGalat)}
                  />
                  <IconButton
                    nama="silang"
                    label={`Reject ${a.nama} (removes the account)`}
                    ukuran={13}
                    onClick={() => setujuiAkun(a.id, false).then(() => toast(`${a.nama} rejected.`)).catch(toastGalat)}
                  />
                </div>
              ))}
            </div>
          )}
          {murid.length === 0 && (
            <p className="ex-label" style={{ color: 'var(--ink-faint)' }}>
              No students yet today. They join from the TV link on their phone.
            </p>
          )}
          {murid.map((m) => {
            const k = hadir.get(m.id)
            const warna = !k ? 'var(--ink-faint)' : k.tunggu ? 'var(--accent-2)' : k.fokus ? 'var(--up)' : 'var(--down)'
            const judul = !k
              ? 'Offline'
              : k.tunggu
                ? 'Waiting — screen dimmed or phone locked on purpose'
                : k.fokus
                  ? `On the board${k.keluar ? ` · left ${k.keluar}×` : ''}`
                  : `Left the page · ${k.keluar}×`
            return (
              <div key={m.id} className="flex items-center gap-2" title={`${judul}${m.phone ? ` · ${m.phone}` : ''}`}>
                <span
                  aria-hidden
                  style={{ width: 9, height: 9, borderRadius: 999, background: warna, flexShrink: 0, boxShadow: k?.fokus ? `0 0 6px ${warna}` : undefined }}
                />
                <span className="min-w-0 flex-1 truncate" style={{ fontSize: 'var(--fs-label)', opacity: k ? 1 : 0.55 }}>
                  {m.name}
                </span>
                <span className="ex-num" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
                  R{k?.ruang ?? m.room}
                  {k && k.keluar > 0 && ` · ${k.keluar}×`}
                </span>
                {m.phone && (
                  <IconButton
                    nama="gembok"
                    label="Reset this student's password"
                    ukuran={12}
                    onClick={() => {
                      const sandi = window.prompt(`New password for ${m.name} (at least 4 characters):`)
                      if (!sandi || sandi.length < 4) return
                      resetSandiAkun(m.id, sandi).then(() => toast(`Password for ${m.name} changed.`)).catch(toastGalat)
                    }}
                  />
                )}
                <IconButton
                  nama="pena"
                  label={m.can_draw ? 'Allowed to draw on their own canvas — tap to revoke' : 'Allow drawing on their own canvas from the phone'}
                  aktif={!!m.can_draw}
                  ukuran={12}
                  onClick={() =>
                    izinkanCoret(m.id, !m.can_draw)
                      .then(() => toast(m.can_draw ? `${m.name} can no longer draw` : `${m.name} can now draw on their canvas`))
                      .catch(toastGalat)
                  }
                />
                <IconButton
                  nama={m.muted_until && m.muted_until > Date.now() ? 'silang' : 'lonceng'}
                  label={m.muted_until && m.muted_until > Date.now() ? 'Muted — tap to allow questions again' : 'Mute questions from this student for 10 min'}
                  aktif={!!m.muted_until && m.muted_until > Date.now()}
                  ukuran={12}
                  onClick={() => void bisukanMurid(m.id, m.muted_until && m.muted_until > Date.now() ? 0 : 10)}
                />
                <select
                  className="ex-input"
                  style={{ width: 96, padding: '2px 4px', fontSize: 11 }}
                  value={petaGrupMurid.get(m.id) ?? ''}
                  onChange={(e) => void tetapkanGrup(m.id, e.target.value || null)}
                  aria-label={`Group of ${m.name}`}
                >
                  <option value="">no group</option>
                  {grup.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            )
          })}
          <p className="ex-label" style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
            Green: watching the board. Blue: waiting with the screen dimmed (allowed). Red: left the
            page (count shows how often). Grey: offline.
          </p>
        </div>
      )}

      {tab === 'grup' && (
        <div className="flex flex-col gap-2">
          {grup.map((g) => (
            <BarisGrup
              key={g.id}
              g={g}
              anggota={anggota.filter((a) => a.group_id === g.id).map((a) => semuaMurid.find((m) => m.id === a.student_id) ?? { id: a.student_id, name: a.student_id })}
              bebas={semuaMurid.filter((m) => !anggota.some((a) => a.student_id === m.id))}
              editorLain={editorLain.map((e) => ({ id: e.id, nama: e.nama, ruang: e.ruang }))}
              daftarSketsa={daftarSketsa}
            />
          ))}
          <TambahGrup />
          <p className="ex-label" style={{ color: 'var(--ink-faint)', fontSize: 11 }}>
            Groups are permanent: members stay in their group across days (their account is
            their identity), and each group gets a fresh canvas per day. A group's view overrides
            its members' room.
          </p>
        </div>
      )}
    </>
  )
}

function BarisTanya({
  t,
  grup,
  onBahas,
  onSelesai,
}: {
  t: Tanya
  grup: Grup | null
  onBahas: () => void
  onSelesai: () => void
}) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setTick((n) => n + 1), 30_000)
    return () => window.clearInterval(id)
  }, [])
  const dibahas = t.status === 'dibahas'
  return (
    <div
      className="ex-card flex flex-col gap-1 p-2"
      style={{ borderColor: dibahas ? 'var(--accent)' : undefined, background: dibahas ? 'var(--surface-2)' : undefined }}
    >
      <div className="flex items-center gap-2">
        <span className="ex-num" style={{ fontSize: 11, color: 'var(--ink-faint)' }}>
          R{t.room}
        </span>
        <span className="min-w-0 flex-1 truncate" style={{ fontWeight: 600, fontSize: 'var(--fs-label)' }}>
          {t.name}
        </span>
        {grup && (
          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 999, background: grup.color ?? 'var(--accent)', color: '#fff' }}>
            {grup.name}
          </span>
        )}
        <span style={{ fontSize: 11, color: dibahas ? 'var(--accent)' : 'var(--ink-faint)' }}>
          {dibahas ? 'discussing' : lamaMenunggu(t.created_at)}
        </span>
      </div>
      {t.text && (
        <p style={{ fontSize: 'var(--fs-label)', color: 'var(--ink-soft)', whiteSpace: 'pre-wrap' }}>{t.text}</p>
      )}
      {t.photo && t.photo.endsWith('.pdf') ? (
        <span className="ex-label flex items-center gap-1" style={{ color: 'var(--ink-soft)' }}>
          <Icon nama="pdf" ukuran={14} /> PDF attached
        </span>
      ) : t.photo ? (
        <img
          src={urlDenganPin(`/api/kelas/foto/${encodeURIComponent(t.photo)}`)}
          alt=""
          style={{ maxHeight: 110, width: 'auto', maxWidth: '100%', borderRadius: 6, border: '1px solid var(--line)', alignSelf: 'flex-start' }}
        />
      ) : null}
      <div className="flex gap-1">
        <button className="ex-btn flex-1" data-variant={dibahas ? 'ghost' : 'accent'} style={{ padding: '4px 0' }} onClick={onBahas}>
          <Icon nama="pena" ukuran={13} /> {t.photo ? (t.photo.endsWith('.pdf') ? 'Open PDF on canvas' : 'Open on canvas') : 'Discuss'}
        </button>
        <button className="ex-btn" data-variant="ghost" style={{ padding: '4px 8px' }} onClick={onSelesai} title="Done">
          <Icon nama="centang" ukuran={13} />
        </button>
      </div>
    </div>
  )
}

function BarisGrup({
  g,
  anggota,
  bebas,
  editorLain,
  daftarSketsa,
}: {
  g: Grup
  anggota: Pick<Murid, 'id' | 'name'>[]
  bebas: Pick<Murid, 'id' | 'name'>[]
  editorLain: { id: string; nama: string; ruang: number }[]
  daftarSketsa: { id: string; title: string }[]
}) {
  const [nama, setNama] = useState(g.name)
  const [jadwal, setJadwal] = useState(g.schedule ?? '')
  useEffect(() => setNama(g.name), [g.name])
  useEffect(() => setJadwal(g.schedule ?? ''), [g.schedule])
  return (
    <div className="ex-card flex flex-col gap-1 p-2">
      <div className="flex items-center gap-2">
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: 999, background: g.color ?? 'var(--accent)' }} />
        <input
          className="ex-input"
          style={{ padding: '3px 6px', fontSize: 'var(--fs-label)', flex: 1 }}
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          onBlur={() => nama.trim() && nama !== g.name && void ubahGrup(g.id, { name: nama.trim() })}
          aria-label="Group name"
        />
        <input
          className="ex-input"
          style={{ padding: '3px 6px', fontSize: 11, width: 88 }}
          value={jadwal}
          placeholder="Mon 16:00"
          onChange={(e) => setJadwal(e.target.value)}
          onBlur={() => jadwal.trim() !== (g.schedule ?? '') && void ubahGrup(g.id, { schedule: jadwal.trim() || null })}
          aria-label="Schedule"
          title="Fixed schedule (free text)"
        />
        <IconButton nama="hapus" label="Delete group" ukuran={13} onClick={() => void hapusGrup(g.id)} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {anggota.map((m) => (
          <span
            key={m.id}
            className="flex items-center gap-1"
            style={{ fontSize: 11, padding: '1px 4px 1px 7px', borderRadius: 999, background: 'var(--surface-2)', border: '1px solid var(--line)' }}
          >
            {m.name}
            <IconButton nama="silang" label={`Remove ${m.name} from ${g.name}`} ukuran={10} onClick={() => void tetapkanGrup(m.id, null)} />
          </span>
        ))}
        <select
          className="ex-input"
          style={{ padding: '2px 4px', fontSize: 11, width: 110 }}
          value=""
          onChange={(e) => e.target.value && void tetapkanGrup(e.target.value, g.id)}
          aria-label={`Add a member to ${g.name}`}
        >
          <option value="">+ add member…</option>
          {bebas.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>
      <select
        className="ex-input"
        style={{ padding: '3px 6px', fontSize: 11 }}
        value={g.target ?? ''}
        onChange={(e) => void ubahGrup(g.id, { target: e.target.value || null })}
        aria-label="What this group sees"
      >
        <option value="">Follow their own room</option>
        {RUANGAN.map((r) => (
          <option key={r} value={`ruang:${r}`}>
            Follow room {r}
          </option>
        ))}
        {editorLain.map((e) => (
          <option key={e.id} value={`editor:${e.id}`}>
            Follow {e.nama} (room {e.ruang})
          </option>
        ))}
        {daftarSketsa.map((s) => (
          <option key={s.id} value={`sketsa:${s.id}`}>
            Show sketch: {s.title}
          </option>
        ))}
      </select>
    </div>
  )
}

function TambahGrup() {
  const [nama, setNama] = useState('')
  return (
    <form
      className="flex gap-1"
      onSubmit={(e) => {
        e.preventDefault()
        if (!nama.trim()) return
        void buatGrup(nama).then(() => {
          setNama('')
          toast('Group created.')
        })
      }}
    >
      <input
        className="ex-input"
        style={{ padding: '4px 8px', fontSize: 'var(--fs-label)' }}
        placeholder="New group, e.g. Matematika 9"
        value={nama}
        onChange={(e) => setNama(e.target.value)}
      />
      <button className="ex-btn" data-variant="ghost" type="submit" disabled={!nama.trim()}>
        <Icon nama="tambah" ukuran={14} />
      </button>
    </form>
  )
}
