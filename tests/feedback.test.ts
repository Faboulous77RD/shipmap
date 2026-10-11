import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { feedbackEnabled, submitFeedback, type FeedbackSender } from '../src/feedback.ts'

function fakeSender() {
  const calls: string[] = []
  const send: FeedbackSender = async (text) => {
    calls.push(text)
  }
  return { send, calls }
}

describe('feedbackEnabled', () => {
  it('ist false für undefined, leer und nur Leerzeichen', () => {
    expect(feedbackEnabled(undefined)).toBe(false)
    expect(feedbackEnabled('')).toBe(false)
    expect(feedbackEnabled('  ')).toBe(false)
  })

  it('ist true für einen Schlüssel', () => {
    expect(feedbackEnabled('phc_abc123')).toBe(true)
  })
})

describe('submitFeedback mit Text', () => {
  it('ruft send einmal mit dem Text auf und liefert sent', async () => {
    const { send, calls } = fakeSender()
    expect(await submitFeedback('Gefällt mir', send)).toBe('sent')
    expect(calls).toEqual(['Gefällt mir'])
  })

  it('reicht den Text unverändert und ungekürzt weiter', async () => {
    const { send, calls } = fakeSender()
    const text = `  ${'x'.repeat(5000)}\n`
    expect(await submitFeedback(text, send)).toBe('sent')
    expect(calls).toEqual([text])
  })

  it('liefert sent erst nach Erfüllung von send', async () => {
    let done = false
    const send: FeedbackSender = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      done = true
    }
    await submitFeedback('Text', send)
    expect(done).toBe(true)
  })
})

describe('submitFeedback ohne Inhalt', () => {
  it('liefert empty und ruft send nicht auf', async () => {
    for (const text of ['', ' ', '  \n\t ', '\n', '\t']) {
      const { send, calls } = fakeSender()
      expect(await submitFeedback(text, send)).toBe('empty')
      expect(calls).toHaveLength(0)
    }
  })
})

describe('submitFeedback bei Fehler', () => {
  it('lehnt mit demselben Fehler ab', async () => {
    const error = new Error('Netz weg')
    const send: FeedbackSender = async () => {
      throw error
    }
    await expect(submitFeedback('Text', send)).rejects.toBe(error)
  })
})

describe('Abgrenzung', () => {
  const source = readFileSync(new URL('../src/feedback.ts', import.meta.url), 'utf8')

  it('nutzt keinen Speicher', () => {
    expect(source).not.toMatch(/localStorage|sessionStorage|cookie/i)
  })

  it('importiert nur consentEnabled aus consent', () => {
    const imports = source.match(/^import .*$/gm) ?? []
    expect(imports).toEqual(["import { consentEnabled } from './consent.ts'"])
  })
})
