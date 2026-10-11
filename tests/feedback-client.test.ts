import { beforeEach, describe, expect, it, vi } from 'vitest'

const calls = vi.hoisted(() => ({
  log: [] as unknown[][],
  fail: false,
}))

vi.mock('posthog-js', () => {
  const instance = {
    capture: (...args: unknown[]) => calls.log.push(['capture', ...args]),
    opt_in_capturing: () => calls.log.push(['opt_in_capturing']),
    opt_out_capturing: () => calls.log.push(['opt_out_capturing']),
  }
  const fake = {
    init: (...args: unknown[]) => {
      calls.log.push(['init', ...args])
      return instance
    },
    capture: () => calls.log.push(['default-capture']),
    opt_in_capturing: () => calls.log.push(['default-opt_in']),
    opt_out_capturing: () => calls.log.push(['default-opt_out']),
  }
  return {
    get default() {
      if (calls.fail) throw new Error('load failed')
      return fake
    },
  }
})

import { createFeedbackSender } from '../src/feedback-client.ts'

const names = () => calls.log.map((c) => c[0])

beforeEach(() => {
  calls.log.length = 0
  calls.fail = false
})

describe('createFeedbackSender', () => {
  it('lädt und initialisiert beim Erzeugen nichts', () => {
    createFeedbackSender('phc_abc123')
    expect(calls.log).toEqual([])
  })

  it('initialisiert beim ersten Aufruf genau einmal mit Instanznamen und Optionen', async () => {
    const send = createFeedbackSender('phc_abc123')
    await send('Hallo')
    await send('Noch eins')
    const inits = calls.log.filter((c) => c[0] === 'init')
    expect(inits).toHaveLength(1)
    expect(inits[0]).toEqual([
      'init',
      'phc_abc123',
      {
        api_host: 'https://eu.i.posthog.com',
        persistence: 'memory',
        opt_out_capturing_by_default: false,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_flags: true,
        person_profiles: 'identified_only',
        request_batching: false,
        disable_compression: true,
      },
      'feedback',
    ])
  })

  it('sendet jeden Text einmal als capture("feedback", { text }) auf der Instanz', async () => {
    const send = createFeedbackSender('phc_abc123')
    await send('Hallo')
    await send('Noch eins')
    expect(calls.log.filter((c) => c[0] === 'capture')).toEqual([
      ['capture', 'feedback', { text: 'Hallo' }],
      ['capture', 'feedback', { text: 'Noch eins' }],
    ])
  })

  it('erfüllt das Versprechen erst nach dem capture', async () => {
    const send = createFeedbackSender('phc_abc123')
    await send('Hallo')
    expect(names()).toEqual(['init', 'capture'])
  })

  it('nutzt weder Opt-in/-out noch die Standardinstanz noch Storage', async () => {
    const storage = vi.fn()
    vi.stubGlobal('localStorage', new Proxy({}, { get: storage, set: storage }))
    vi.stubGlobal('sessionStorage', new Proxy({}, { get: storage, set: storage }))
    const send = createFeedbackSender('phc_abc123')
    await send('Hallo')
    vi.unstubAllGlobals()
    expect(names()).toEqual(['init', 'capture'])
    expect(storage).not.toHaveBeenCalled()
  })

  it('lehnt ab, wenn das Laden fehlschlägt, und versucht es später erneut', async () => {
    const send = createFeedbackSender('phc_abc123')
    calls.fail = true
    await expect(send('Hallo')).rejects.toThrow()
    expect(calls.log).toEqual([])
    calls.fail = false
    await send('Nochmal')
    expect(calls.log.map((c) => c[0])).toEqual(['init', 'capture'])
  })
})
