import { describe, expect, it } from 'vitest'
import {
  addProduct,
  emptyState,
  loadState,
  saveState,
  selectProduct,
  type StorageLike,
} from '../src/store.ts'

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value)
    },
  }
}

describe('emptyState', () => {
  it('hat die Form von Version 1 ohne Produkte', () => {
    expect(emptyState()).toEqual({ version: 1, products: [], selectedId: null })
  })
})

describe('addProduct', () => {
  it('schneidet den Namen zu, hängt an, wählt aus und startet ohne Features', () => {
    const s = addProduct(emptyState(), '  Shipmap ')
    expect(s.products).toHaveLength(1)
    expect(s.products[0].name).toBe('Shipmap')
    expect(s.products[0].features).toEqual([])
    expect(s.selectedId).toBe(s.products[0].id)
  })

  it('lässt den Zustand bei leerem Namen unverändert', () => {
    const s = addProduct(emptyState(), 'Shipmap')
    expect(addProduct(s, '   ')).toBe(s)
    expect(addProduct(s, '')).toBe(s)
  })

  it('vergibt eindeutige ids, hängt am Ende an und wählt das neue Produkt', () => {
    const s = addProduct(addProduct(emptyState(), 'Shipmap'), 'Notizbuch')
    expect(s.products.map((p) => p.name)).toEqual(['Shipmap', 'Notizbuch'])
    expect(s.products[0].id).not.toBe(s.products[1].id)
    expect(s.selectedId).toBe(s.products[1].id)
  })
})

describe('selectProduct', () => {
  it('setzt selectedId bei bekannter id', () => {
    const s = addProduct(addProduct(emptyState(), 'A'), 'B')
    const first = s.products[0].id
    expect(selectProduct(s, first).selectedId).toBe(first)
  })

  it('lässt den Zustand bei unbekannter id unverändert', () => {
    const s = addProduct(emptyState(), 'A')
    expect(selectProduct(s, 'gibt-es-nicht')).toBe(s)
  })
})

describe('loadState', () => {
  it('liefert emptyState bei fehlendem Eintrag', () => {
    expect(loadState(memoryStorage())).toEqual(emptyState())
  })

  it('liefert emptyState bei ungültigem JSON, falscher Version oder Form', () => {
    const bad = [
      '{kaputt',
      '[]',
      'null',
      '{"version":2,"products":[],"selectedId":null}',
      '{"version":1,"products":"x","selectedId":null}',
      '{"version":1,"products":[{"id":1,"name":"A","features":[]}],"selectedId":null}',
      '{"version":1,"products":[{"id":"p1","name":"A"}],"selectedId":null}',
      '{"version":1,"products":[],"selectedId":5}',
    ]
    for (const raw of bad) {
      expect(loadState(memoryStorage({ 'shipmap:v1': raw }))).toEqual(emptyState())
    }
  })

  it('wirft nicht, wenn der Speicher wirft', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error('gesperrt')
      },
      setItem: () => {},
    }
    expect(loadState(broken)).toEqual(emptyState())
  })

  it('liest das Beispielformat unter dem Schlüssel shipmap:v1', () => {
    const raw =
      '{"version":1,"products":[{"id":"p1","name":"Shipmap","features":[]},{"id":"p2","name":"Notizbuch","features":[]}],"selectedId":"p2"}'
    const s = loadState(memoryStorage({ 'shipmap:v1': raw }))
    expect(s.selectedId).toBe('p2')
    expect(s.products.map((p) => p.name)).toEqual(['Shipmap', 'Notizbuch'])
  })

  it('setzt selectedId auf null, wenn kein Produkt diese id hat', () => {
    const raw = '{"version":1,"products":[{"id":"p1","name":"A","features":[]}],"selectedId":"p9"}'
    expect(loadState(memoryStorage({ 'shipmap:v1': raw })).selectedId).toBeNull()
  })

  it('gibt einen mit saveState geschriebenen Zustand unverändert zurück', () => {
    const storage = memoryStorage()
    const s = addProduct(addProduct(emptyState(), 'Shipmap'), 'Notizbuch')
    saveState(storage, s)
    expect(loadState(storage)).toEqual(s)
  })
})
