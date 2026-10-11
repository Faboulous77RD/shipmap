import { describe, expect, it } from 'vitest'
import { CONSENT_KEY } from '../src/consent.ts'
import { createTelemetry, setTelemetry, track } from '../src/telemetry.ts'
import type { TelemetryClient } from '../src/telemetry.ts'

const KEY = 'phc_abc123'

type Fullstorage = {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

function memory(initial?: string): Fullstorage {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set(CONSENT_KEY, initial)
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  }
}

function fakeClient(): { client: TelemetryClient; calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    client: {
      optIn: () => void calls.push('optIn'),
      optOut: () => void calls.push('optOut'),
      capture: (e) => void calls.push(`capture:${e}`),
    },
  }
}

function setup(initial: string | undefined, ...keyArg: [string | undefined] | []) {
  const key = keyArg.length > 0 ? keyArg[0] : KEY
  const { client, calls } = fakeClient()
  const raw = memory(initial)
  const t = createTelemetry({ client, key, storage: raw })
  return { t, calls, raw, storage: t.storage as Fullstorage }
}

describe('ohne Schlüssel', () => {
  for (const key of [undefined, '', '  ']) {
    it(`ruft den Client nie auf (Schlüssel ${JSON.stringify(key)})`, () => {
      const { t, calls, storage } = setup('granted', key)
      storage.setItem(CONSENT_KEY, 'denied')
      storage.setItem(CONSENT_KEY, 'granted')
      storage.removeItem(CONSENT_KEY)
      t.track('seite_geoeffnet')
      expect(calls).toEqual([])
    })
  }
})

describe('Erzeugen', () => {
  it('sendet bei granted optIn und einmal seite_geoeffnet', () => {
    expect(setup('granted').calls).toEqual(['optIn', 'capture:seite_geoeffnet'])
  })
  it('ruft bei denied nichts auf', () => {
    expect(setup('denied').calls).toEqual([])
  })
  it('ruft ohne Wahl nichts auf', () => {
    expect(setup(undefined).calls).toEqual([])
  })
})

describe('storage', () => {
  it('reicht getItem, setItem und removeItem durch', () => {
    const { storage, raw } = setup(undefined)
    storage.setItem('a', '1')
    expect(raw.getItem('a')).toBe('1')
    expect(storage.getItem('a')).toBe('1')
    storage.removeItem('a')
    expect(raw.getItem('a')).toBeNull()
  })
  it('Wechsel auf granted: optIn und seite_geoeffnet', () => {
    const { storage, calls } = setup(undefined)
    storage.setItem(CONSENT_KEY, 'granted')
    expect(calls).toEqual(['optIn', 'capture:seite_geoeffnet'])
  })
  it('Wechsel von granted auf denied: optOut', () => {
    const { storage, calls } = setup('granted')
    calls.length = 0
    storage.setItem(CONSENT_KEY, 'denied')
    expect(calls).toEqual(['optOut'])
  })
  it('Entfernen der Wahl nach granted: optOut', () => {
    const { storage, calls } = setup('granted')
    calls.length = 0
    storage.removeItem(CONSENT_KEY)
    expect(calls).toEqual(['optOut'])
  })
  it('unveränderter Wert löst nichts aus', () => {
    const { storage, calls } = setup('granted')
    calls.length = 0
    storage.setItem(CONSENT_KEY, 'granted')
    storage.setItem('anderes', 'x')
    expect(calls).toEqual([])
  })
  it('denied nach denied löst nichts aus', () => {
    const { storage, calls } = setup('denied')
    storage.setItem(CONSENT_KEY, 'denied')
    expect(calls).toEqual([])
  })
  it('seite_geoeffnet höchstens einmal je Erzeugung, auch nach Widerruf', () => {
    const { storage, calls } = setup(undefined)
    storage.setItem(CONSENT_KEY, 'granted')
    storage.setItem(CONSENT_KEY, 'denied')
    storage.setItem(CONSENT_KEY, 'granted')
    expect(calls).toEqual(['optIn', 'capture:seite_geoeffnet', 'optOut', 'optIn'])
  })
  it('kein zweites seite_geoeffnet, wenn schon beim Erzeugen gesendet', () => {
    const { storage, calls } = setup('granted')
    storage.setItem(CONSENT_KEY, 'denied')
    storage.setItem(CONSENT_KEY, 'granted')
    expect(calls).toEqual(['optIn', 'capture:seite_geoeffnet', 'optOut', 'optIn'])
  })
})

describe('track', () => {
  it('sendet nur bei gespeichertem granted', () => {
    const { t, calls, storage } = setup(undefined)
    t.track('seite_geoeffnet')
    expect(calls).toEqual([])
    storage.setItem(CONSENT_KEY, 'granted')
    calls.length = 0
    t.track('seite_geoeffnet')
    expect(calls).toEqual(['capture:seite_geoeffnet'])
    storage.setItem(CONSENT_KEY, 'denied')
    calls.length = 0
    t.track('seite_geoeffnet')
    expect(calls).toEqual([])
  })
  it('modulweites track tut ohne gesetztes Telemetry nichts', () => {
    setTelemetry(null)
    expect(() => track('seite_geoeffnet')).not.toThrow()
  })
  it('modulweites track leitet an das gesetzte Telemetry weiter', () => {
    const { t, calls } = setup('granted')
    calls.length = 0
    setTelemetry(t)
    track('seite_geoeffnet')
    expect(calls).toEqual(['capture:seite_geoeffnet'])
    setTelemetry(null)
    track('seite_geoeffnet')
    expect(calls).toEqual(['capture:seite_geoeffnet'])
  })
})
