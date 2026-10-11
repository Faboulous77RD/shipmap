import { describe, expect, it } from 'vitest'
import {
  CONSENT_KEY,
  consentEnabled,
  readChoice,
  writeChoice,
  type Choice,
} from '../src/consent.ts'
import { STORAGE_KEY, type StorageLike } from '../src/store.ts'

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  const reads: string[] = []
  const writes: string[] = []
  const storage: StorageLike = {
    getItem: (key) => {
      reads.push(key)
      return map.get(key) ?? null
    },
    setItem: (key, value) => {
      writes.push(key)
      map.set(key, value)
    },
  }
  return { storage, map, reads, writes }
}

const throwing: StorageLike = {
  getItem: () => {
    throw new Error('gesperrt')
  },
  setItem: () => {
    throw new Error('gesperrt')
  },
}

describe('Exporte', () => {
  it('nennt den Schlüssel und typisiert die Wahl', () => {
    expect(CONSENT_KEY).toBe('shipmap:consent:v1')
    const choices: Choice[] = ['granted', 'denied']
    expect(choices).toHaveLength(2)
  })
})

describe('readChoice', () => {
  it('liefert null, wenn nichts gespeichert ist', () => {
    expect(readChoice(memoryStorage().storage)).toBeNull()
  })

  it('liefert granted und denied', () => {
    expect(readChoice(memoryStorage({ [CONSENT_KEY]: 'granted' }).storage)).toBe('granted')
    expect(readChoice(memoryStorage({ [CONSENT_KEY]: 'denied' }).storage)).toBe('denied')
  })

  it('liefert null bei anderen Werten', () => {
    for (const value of ['yes', '', 'Granted', '"granted"']) {
      expect(readChoice(memoryStorage({ [CONSENT_KEY]: value }).storage)).toBeNull()
    }
  })

  it('liefert null, wenn getItem wirft', () => {
    expect(readChoice(throwing)).toBeNull()
  })
})

describe('writeChoice', () => {
  it('speichert den Wert unter dem Schlüssel', () => {
    const { storage, map } = memoryStorage()
    writeChoice(storage, 'granted')
    expect(map.get(CONSENT_KEY)).toBe('granted')
    expect(readChoice(storage)).toBe('granted')
  })

  it('überschreibt eine frühere Wahl', () => {
    const { storage, map } = memoryStorage()
    writeChoice(storage, 'denied')
    writeChoice(storage, 'granted')
    expect(map.get(CONSENT_KEY)).toBe('granted')
    writeChoice(storage, 'denied')
    expect(map.get(CONSENT_KEY)).toBe('denied')
  })

  it('wirft nicht, wenn setItem wirft', () => {
    expect(() => writeChoice(throwing, 'granted')).not.toThrow()
  })
})

describe('consentEnabled', () => {
  it('ist false für undefined, leer und nur Leerzeichen', () => {
    expect(consentEnabled(undefined)).toBe(false)
    expect(consentEnabled('')).toBe(false)
    expect(consentEnabled('  ')).toBe(false)
  })

  it('ist true für einen Schlüssel', () => {
    expect(consentEnabled('phc_abc123')).toBe(true)
  })
})

describe('Abgrenzung zum Produktspeicher', () => {
  it('liest und ändert shipmap:v1 nicht', () => {
    const { storage, map, reads, writes } = memoryStorage({ [STORAGE_KEY]: '{"x":1}' })
    readChoice(storage)
    writeChoice(storage, 'denied')
    expect(reads).not.toContain(STORAGE_KEY)
    expect(writes).not.toContain(STORAGE_KEY)
    expect(map.get(STORAGE_KEY)).toBe('{"x":1}')
  })
})
