'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const BG = '#f7f5f0'
const INK = '#16150f'
const LINE = '#ddd7c9'
const MUTED = '#6d6653'

export default function LoggInn() {
  const [email, setEmail] = useState('')
  const [stage, setStage] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  async function send() {
    setError(null)
    setStage('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback?neste=/admin`,
        shouldCreateUser: false, // signups are closed; only the pre-added user gets in
      },
    })
    if (error) {
      setError('Kunne ikke sende lenken. Er adressen registrert?')
      setStage('idle')
    } else {
      setStage('sent')
    }
  }

  return (
    <main
      style={{
        fontFamily: 'Archivo, Helvetica, sans-serif',
        background: BG,
        color: INK,
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        padding: '96px 32px 120px',
      }}
    >
      <div style={{ width: 400 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: '#7a7461', marginBottom: 12 }}>
          Admin
        </div>
        <h1 style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 42, margin: '0 0 14px', letterSpacing: '-0.02em' }}>
          Logg inn
        </h1>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: MUTED, margin: '0 0 28px' }}>
          Vi sender en engangslenke til e-posten din. Ingen passord å glemme.
        </p>

        {stage === 'sent' ? (
          <div style={{ border: `1px solid ${LINE}`, background: '#fffdf8', borderRadius: 3, padding: 26 }}>
            <div style={{ fontFamily: "'Instrument Serif', Georgia, serif", fontSize: 24, marginBottom: 10 }}>
              Sjekk innboksen
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: MUTED, margin: 0 }}>
              Lenken er sendt til {email} og varer i 15 minutter.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && email && send()}
              placeholder="hei@fjordcotton.no"
              type="email"
              autoComplete="email"
              style={{
                border: `1px solid ${LINE}`, borderRadius: 2, background: '#fffdf8',
                fontFamily: 'inherit', fontSize: 14, padding: 14, width: '100%', color: INK, outline: 'none',
              }}
            />
            <button
              onClick={send}
              disabled={!email || stage === 'sending'}
              style={{
                fontFamily: 'inherit', fontSize: 13, background: INK, color: BG, border: 'none',
                borderRadius: 2, padding: '14px 20px', width: '100%',
                cursor: stage === 'sending' ? 'default' : 'pointer',
                opacity: !email || stage === 'sending' ? 0.5 : 1,
              }}
            >
              {stage === 'sending' ? 'Sender …' : 'Send innloggingslenke'}
            </button>
            {error && <div style={{ fontSize: 12, color: '#a75c3c' }}>{error}</div>}
            <div style={{ fontSize: 11, color: '#8b8574', lineHeight: 1.7, marginTop: 4 }}>
              Kun forhåndsgodkjente adresser får tilgang. Registrering er avslått.
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
