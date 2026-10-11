import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls: unknown[][] = []
let release: (() => void) | null = null
let gate: Promise<void> | null = null
let imports = 0

function mockPostHog() {
  vi.doMock('posthog-js', async () => {
    imports++
    if (gate) await gate
    const log =
      (name: string) =>
      (...args: unknown[]) => {
        calls.push([name, ...args])
      }
    return {
      default: {
        init: log('init'),
        opt_in_capturing: log('opt_in_capturing'),
        opt_out_capturing: log('opt_out_capturing'),
        capture: log('capture'),
      },
    }
  })
}

async function freshClient(hold = false) {
  vi.resetModules()
  mockPostHog()
  calls.length = 0
  imports = 0
  gate = hold ? new Promise<void>((r) => (release = r)) : null
  const mod = await import('../src/posthog-client.ts')
  return mod.createPostHogClient('phc_abc123')
}

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  release = null
})

describe('laden', () => {
  it('lädt und initialisiert beim Erzeugen nichts', async () => {
    await freshClient()
    await flush()
    expect(imports).toBe(0)
    expect(calls).toEqual([])
  })

  it('wird nur dynamisch importiert', async () => {
    const { readFileSync } = await import('node:fs')
    const src = readFileSync('src/posthog-client.ts', 'utf8')
    expect(src).toMatch(/import\('posthog-js'\)/)
    expect(src).not.toMatch(/^import (?!type).*posthog-js/m)
  })
})

describe('optIn', () => {
  it('initialisiert genau einmal mit den Optionen', async () => {
    const client = await freshClient()
    client.optIn()
    client.optIn()
    await flush()
    const inits = calls.filter((c) => c[0] === 'init')
    expect(inits).toHaveLength(1)
    expect(inits[0]).toEqual([
      'init',
      'phc_abc123',
      {
        api_host: 'https://eu.i.posthog.com',
        persistence: 'memory',
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_flags: true,
        opt_out_capturing_by_default: true,
        person_profiles: 'identified_only',
      },
    ])
  })

  it('ruft nach init opt_in_capturing ohne Eventnamen', async () => {
    const client = await freshClient()
    client.optIn()
    await flush()
    expect(calls.map((c) => c[0])).toEqual(['init', 'opt_in_capturing'])
    expect(calls[1]).toEqual(['opt_in_capturing', { captureEventName: false }])
  })
})

describe('capture und optOut', () => {
  it('sendet den Namen unverändert ohne Eigenschaften', async () => {
    const client = await freshClient()
    client.optIn()
    client.capture('seite_geoeffnet')
    await flush()
    expect(calls[2]).toEqual(['capture', 'seite_geoeffnet'])
  })

  it('optOut ruft opt_out_capturing', async () => {
    const client = await freshClient()
    client.optIn()
    client.optOut()
    await flush()
    expect(calls.map((c) => c[0])).toEqual(['init', 'opt_in_capturing', 'opt_out_capturing'])
  })

  it('optOut vor dem ersten optIn tut nichts und lädt nichts', async () => {
    const client = await freshClient()
    client.optOut()
    await flush()
    expect(imports).toBe(0)
    expect(calls).toEqual([])
  })
})

describe('Reihenfolge', () => {
  it('führt Aufrufe in Eintreffreihenfolge aus, auch während des Ladens', async () => {
    const client = await freshClient(true)
    client.optIn()
    client.capture('seite_geoeffnet')
    await flush()
    expect(calls).toEqual([])
    release?.()
    await flush()
    expect(calls.map((c) => c[0])).toEqual(['init', 'opt_in_capturing', 'capture'])
  })

  it('verwirft ein capture, auf das vor der Ausführung optOut folgt', async () => {
    const client = await freshClient(true)
    client.optIn()
    client.capture('seite_geoeffnet')
    client.optOut()
    release?.()
    await flush()
    expect(calls.map((c) => c[0])).toEqual(['init', 'opt_in_capturing', 'opt_out_capturing'])
  })

  it('sendet ein capture nach erneutem optIn wieder', async () => {
    const client = await freshClient(true)
    client.optIn()
    client.capture('seite_geoeffnet')
    client.optOut()
    client.optIn()
    client.capture('seite_geoeffnet')
    release?.()
    await flush()
    expect(calls.map((c) => c[0])).toEqual([
      'init',
      'opt_in_capturing',
      'opt_out_capturing',
      'opt_in_capturing',
      'capture',
    ])
  })
})
