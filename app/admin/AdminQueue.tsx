'use client'

import { useRef, useState } from 'react'
import { titleFromFilename } from '@/lib/slug'

/**
 * Admin publishing queue. Posts one design at a time to POST /api/admin/designs
 * (multipart), because that route composites mockups with Sharp and needs the
 * file bytes. Sequential rather than parallel: ten concurrent Sharp jobs on a
 * Vercel function is how you hit the memory ceiling.
 */

const BG = '#f7f5f0'
const CARD = '#fffdf8'
const INK = '#16150f'
const LINE = '#ddd7c9'
const MUTED = '#6d6653'
const FAINT = '#8b8574'

const CONTRAST = [
  { key: 'light_safe', label: 'Lys', title: 'Lys-trygg — hvit, sand', colors: ['hvit', 'sand'] },
  { key: 'dark_safe', label: 'Mørk', title: 'Mørk-trygg — oliven, garnet, marine, sort', colors: ['oliven', 'garnet', 'marine', 'sort'] },
  { key: 'neutral', label: 'Alle', title: 'Nøytral — alle seks farger', colors: null },
] as const

type Contrast = (typeof CONTRAST)[number]['key']

type Row = {
  file: File
  title: string
  themeKey: string
  collectionKey: string
  priceKr: number
  contrast: Contrast
  status: 'Klar' | 'Avvist' | 'Laster …' | 'Publisert' | 'Planlagt' | 'Feilet'
  note?: string
}

type Props = {
  themes: { key: string; name_no: string }[]
  collections: { key: string; name_no: string }[]
  colors: { key: string; name_no: string; hex: string }[]
  publishedCount: number
}

const GRID = '56px 1.35fr 0.9fr 0.9fr 152px 78px 118px 34px'
const REQUIRED_W = 4500
const REQUIRED_H = 5400

export default function AdminQueue({ themes, collections, colors, publishedCount }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [published, setPublished] = useState(publishedCount)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  function edit(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }

  /**
   * Client-side gate so a bad file never reaches the server. The alpha check is
   * the one that matters: a white box behind the art prints as a white rectangle
   * on a black shirt, and it only surfaces on a shirt already shipped.
   */
  async function validate(file: File): Promise<string | null> {
    if (file.type !== 'image/png') return 'Må være PNG'
    if (file.size > 40 * 1024 * 1024) return 'Over 40 MB'

    const bitmap = await createImageBitmap(file)
    const { width, height } = bitmap

    if (width !== REQUIRED_W || height !== REQUIRED_H) {
      bitmap.close()
      return `${width}×${height} — må være ${REQUIRED_W}×${REQUIRED_H}`
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return null
    }
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()

    // Corners and edge midpoints. Art is centred, so the frame should be clear.
    const w = width - 1
    const h = height - 1
    const probes: [number, number][] = [
      [2, 2], [w - 2, 2], [2, h - 2], [w - 2, h - 2],
      [w >> 1, 2], [w >> 1, h - 2], [2, h >> 1], [w - 2, h >> 1],
    ]
    const opaque = probes.filter(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3] > 8).length
    if (opaque >= 5) return 'Bakgrunnen er ikke gjennomsiktig'

    return null
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setNotice(null)
    const next: Row[] = []

    for (const file of Array.from(files)) {
      const problem = await validate(file)
      next.push({
        file,
        title: titleFromFilename(file.name),
        themeKey: rows.at(-1)?.themeKey ?? themes[0]?.key ?? '',
        collectionKey: rows.at(-1)?.collectionKey ?? collections[0]?.key ?? '',
        priceKr: 349,
        contrast: 'neutral',
        status: problem ? 'Avvist' : 'Klar',
        note: problem ?? undefined,
      })
    }

    setRows((rs) => [...rs, ...next])
    if (fileInput.current) fileInput.current.value = ''
  }

  async function publish(schedule: boolean) {
    setBusy(true)
    setNotice(null)

    let ok = 0
    let bad = 0

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      if (row.status !== 'Klar') continue

      edit(i, { status: 'Laster …', note: undefined })

      const body = new FormData()
      body.set('file', row.file)
      body.set('title', row.title)
      body.set('themeKey', row.themeKey)
      body.set('collectionKey', row.collectionKey)
      body.set('priceOverrideKr', String(row.priceKr))
      body.set('contrast', row.contrast)
      body.set('status', schedule ? 'scheduled' : 'published')
      if (schedule) body.set('publishAt', tomorrowMorningOslo())
      body.set('generator', 'Recraft V3')

      try {
        const res = await fetch('/api/admin/designs', { method: 'POST', body })
        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
          edit(i, { status: 'Feilet', note: json.error ?? `HTTP ${res.status}` })
          bad++
          continue
        }

        // The server returns warnings for things it accepted but is unsure about.
        const warnings: string[] = json.warnings ?? []
        edit(i, {
          status: schedule ? 'Planlagt' : 'Publisert',
          note: warnings.length ? warnings.join(' · ') : undefined,
        })
        ok++
      } catch (e) {
        edit(i, { status: 'Feilet', note: e instanceof Error ? e.message : 'Nettverksfeil' })
        bad++
      }
    }

    setPublished((n) => n + ok)
    setNotice(
      bad
        ? `${ok} publisert, ${bad} feilet. Årsak står på radene.`
        : `${ok} design ${schedule ? 'planlagt' : 'publisert'}.`
    )
    setBusy(false)
  }

  const queued = rows.filter((r) => r.status === 'Klar').length

  return (
    <main style={{ fontFamily: 'Archivo, Helvetica, sans-serif', background: BG, color: INK, minHeight: '100vh' }}>
      <div style={{ maxWidth: 1360, margin: '0 auto', padding: '56px 32px 88px' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: `1px solid ${LINE}`, paddingBottom: 22, marginBottom: 34 }}>
          <div>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7a7461' }}>
                Admin · Publisering
              </span>
              <a href="/api/auth/logg-ut" style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: FAINT, textDecoration: 'none' }}>
                Logg ut
              </a>
            </div>
            <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 46, margin: 0, letterSpacing: '-0.02em' }}>
              Dagens slipp
            </h1>
          </div>
          <div style={{ display: 'flex', gap: 32, textAlign: 'right', fontSize: 12, color: MUTED }}>
            <Stat n={queued} label="I kø" />
            <Stat n={published} label="Publisert totalt" />
          </div>
        </div>

        <input ref={fileInput} type="file" accept="image/png" multiple hidden onChange={(e) => addFiles(e.target.files)} />

        <div
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
          style={{ border: '1.5px dashed #c9c2b0', background: CARD, borderRadius: 3, padding: '44px 32px', textAlign: 'center', cursor: 'pointer', marginBottom: 14 }}
        >
          <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 26, marginBottom: 8 }}>
            Slipp trykkfilene her
          </div>
          <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
            PNG med transparent bakgrunn · 4500 × 5400 px · 300 dpi<br />
            Flere filer om gangen. Filnavnet blir foreslått tittel.
          </div>
        </div>

        {rows.length > 0 && (
          <div style={{ display: 'flex', gap: 10, marginBottom: 36, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 10, color: FAINT }}>
              Sett kolleksjon på hele køen
            </span>
            {collections.slice(0, 5).map((c) => (
              <button
                key={c.key}
                onClick={() => setRows((rs) => rs.map((r) => ({ ...r, collectionKey: c.key })))}
                style={{ fontFamily: 'inherit', fontSize: 12, background: 'transparent', border: `1px solid ${LINE}`, borderRadius: 2, padding: '6px 12px', cursor: 'pointer', color: INK }}
              >
                {c.name_no}
              </button>
            ))}
          </div>
        )}

        {notice && (
          <div style={{ border: `1px solid ${LINE}`, background: CARD, borderRadius: 3, padding: '14px 18px', fontSize: 13, marginBottom: 20 }}>
            {notice}
          </div>
        )}

        {rows.length === 0 ? (
          <div style={{ border: `1px solid ${LINE}`, borderRadius: 3, padding: 64, textAlign: 'center', color: FAINT, fontSize: 13 }}>
            Køen er tom. Slipp inn filene fra Recraft-økten.
          </div>
        ) : (
          <>
            <div style={{ border: `1px solid ${LINE}`, borderRadius: 3, background: CARD, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 14, padding: '13px 18px', borderBottom: `1px solid ${LINE}`, fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: FAINT, background: BG }}>
                <span>Fil</span><span>Tittel</span><span>Tema</span><span>Kolleksjon</span>
                <span>Farger</span><span>Pris</span><span>Status</span><span />
              </div>

              {rows.map((row, i) => {
                const allowed = CONTRAST.find((c) => c.key === row.contrast)!.colors
                const locked = row.status !== 'Klar' && row.status !== 'Avvist'
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 14, padding: '13px 18px', borderBottom: '1px solid #eae4d6', alignItems: 'center', opacity: locked ? 0.6 : 1 }}>
                    <div style={{ width: 44, height: 52, border: `1px solid ${LINE}`, borderRadius: 2, background: '#e9e3d4' }} />

                    <input value={row.title} disabled={locked} onChange={(e) => edit(i, { title: e.target.value })} style={inputStyle} />

                    <select value={row.themeKey} disabled={locked} onChange={(e) => edit(i, { themeKey: e.target.value })} style={inputStyle}>
                      {themes.map((t) => <option key={t.key} value={t.key}>{t.name_no}</option>)}
                    </select>

                    <select value={row.collectionKey} disabled={locked} onChange={(e) => edit(i, { collectionKey: e.target.value })} style={inputStyle}>
                      {collections.map((c) => <option key={c.key} value={c.key}>{c.name_no}</option>)}
                    </select>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {CONTRAST.map((c) => (
                          <button
                            key={c.key}
                            title={c.title}
                            disabled={locked}
                            onClick={() => edit(i, { contrast: c.key })}
                            style={{
                              fontFamily: 'inherit', fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase',
                              background: row.contrast === c.key ? INK : 'transparent',
                              color: row.contrast === c.key ? BG : INK,
                              border: `1px solid ${LINE}`, borderRadius: 2, padding: '5px 7px',
                              cursor: locked ? 'default' : 'pointer',
                            }}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 3 }}>
                        {colors.map((c) => (
                          <div
                            key={c.key}
                            title={c.name_no}
                            style={{
                              width: 15, height: 15, borderRadius: '50%', background: c.hex,
                              border: '1px solid #c9c2b0',
                              opacity: !allowed || (allowed as readonly string[]).includes(c.key) ? 1 : 0.18,
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <input
                      value={row.priceKr}
                      inputMode="numeric"
                      disabled={locked}
                      onChange={(e) => edit(i, { priceKr: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                      style={inputStyle}
                    />

                    <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: statusColor(row.status), lineHeight: 1.4 }}>
                      {row.status}
                      {row.note && (
                        <div style={{ textTransform: 'none', letterSpacing: 0, fontSize: 10, color: '#a75c3c', marginTop: 3 }}>
                          {row.note}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                      style={{ fontFamily: 'inherit', fontSize: 15, background: 'none', border: 'none', cursor: 'pointer', color: FAINT, padding: 4 }}
                    >
                      ×
                    </button>
                  </div>
                )
              })}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, gap: 24 }}>
              <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.7, maxWidth: 560 }}>
                Ved publisering: slug fra tittel, mockups komponeres fra trykkfilen, og
                <code style={{ fontSize: 11 }}> generate_variants()</code> lager varianter for de tillatte
                fargene. Nedtonede prikker selges ikke.
              </div>
              <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
                <button onClick={() => publish(true)} disabled={busy || !queued} style={button(busy || !queued, false)}>
                  Planlegg til i morgen
                </button>
                <button onClick={() => publish(false)} disabled={busy || !queued} style={button(busy || !queued, true)}>
                  {busy ? 'Publiserer …' : `Publiser ${queued} design nå`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 30, color: INK, lineHeight: 1 }}>{n}</div>
      <div style={{ letterSpacing: '0.1em', textTransform: 'uppercase', fontSize: 10, marginTop: 4 }}>{label}</div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  border: `1px solid ${LINE}`, borderRadius: 2, background: BG, fontFamily: 'inherit',
  fontSize: 13, padding: '8px 10px', width: '100%', color: INK, outline: 'none',
}

function button(disabled: boolean, primary: boolean): React.CSSProperties {
  return {
    fontFamily: 'inherit', fontSize: 13,
    background: primary ? INK : 'transparent',
    color: primary ? BG : INK,
    border: primary ? 'none' : `1px solid ${INK}`,
    borderRadius: 2, padding: primary ? '13px 26px' : '13px 20px',
    cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
  }
}

function statusColor(status: Row['status']) {
  if (status === 'Publisert' || status === 'Planlagt') return '#4a6b47'
  if (status === 'Klar') return '#7a5c2e'
  if (status === 'Laster …') return MUTED
  return '#a75c3c'
}

/** Tomorrow 08:00 Europe/Oslo, as an ISO string. */
function tomorrowMorningOslo(): string {
  const now = new Date()
  const oslo = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Oslo' }))
  const drift = now.getTime() - oslo.getTime()
  oslo.setDate(oslo.getDate() + 1)
  oslo.setHours(8, 0, 0, 0)
  return new Date(oslo.getTime() + drift).toISOString()
}
