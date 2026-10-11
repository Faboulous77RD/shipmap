import { describe, expect, it } from 'vitest'
import { PRIVACY_ITEMS, PRIVACY_TITLE } from '../src/privacy-text.ts'

const EXPECTED: ReadonlyArray<[string, string]> = [
  ['Verantwortlicher', 'Don Joe (vorläufig; Anschrift und E-Mail folgen)'],
  [
    'Lokale Daten',
    'Produkte und Listen liegen nur im Browser dieses Geräts (localStorage). Sie werden nicht übertragen und nicht gesichert; wer die Browserdaten löscht oder den Browser wechselt, verliert sie.',
  ],
  [
    'Empfänger',
    'Nutzungsereignisse gehen nur nach deiner Einwilligung an PostHog (Serverstandort EU, eu.i.posthog.com).',
  ],
  [
    'Zweck',
    'Zu prüfen, ob und wie Shipmap genutzt wird. Gesendet werden nur die Ereignisse Seite geöffnet, Produkt angelegt, Feature angelegt und Status geändert, ohne Namen, Titel oder Notizen.',
  ],
  [
    'Speicherdauer',
    'Ereignisse werden bei PostHog 12 Monate gespeichert und danach gelöscht.',
  ],
  [
    'Widerruf',
    'Ohne Einwilligung wird nichts gesendet. Eine erteilte Einwilligung widerrufst du jederzeit unter „Einwilligung ändern“.',
  ],
]

describe('privacy-text', () => {
  it('hat den Titel', () => {
    expect(PRIVACY_TITLE).toBe('Datenschutzhinweis')
  })

  it('hat sechs Einträge in fester Reihenfolge der Labels', () => {
    expect(PRIVACY_ITEMS).toHaveLength(6)
    expect(PRIVACY_ITEMS.map((item) => item.label)).toEqual(EXPECTED.map(([label]) => label))
  })

  it.each(EXPECTED)('Text zu %s ist wörtlich', (label, text) => {
    expect(PRIVACY_ITEMS.find((item) => item.label === label)?.text).toBe(text)
  })

  it('enthält in keinem Text „Feedback“', () => {
    for (const item of PRIVACY_ITEMS) {
      expect(item.text).not.toContain('Feedback')
    }
  })
})
