import { describe, expect, it } from 'vitest'
import {
  addFeature,
  addProduct,
  deleteFeature,
  emptyState,
  loadState,
  renameFeature,
  saveState,
  selectProduct,
  setFeatureStatus,
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

describe('addFeature', () => {
  const base = () => addProduct(emptyState(), 'Shipmap')

  it('schneidet den Titel zu und hängt Features mit Status Idee am Ende an', () => {
    const s = addFeature(addFeature(base(), 'p1', '  Login '), 'p1', 'Export')
    expect(s.products[0].features).toEqual([
      { id: 'f1', title: 'Login', status: 'Idee' },
      { id: 'f2', title: 'Export', status: 'Idee' },
    ])
  })

  it('lässt den Zustand bei leerem Titel unverändert', () => {
    const s = base()
    expect(addFeature(s, 'p1', '   ')).toBe(s)
    expect(addFeature(s, 'p1', '')).toBe(s)
  })

  it('vergibt auch nach dem Löschen eine eindeutige id', () => {
    let s = addFeature(addFeature(base(), 'p1', 'A'), 'p1', 'B')
    s = deleteFeature(s, 'p1', 'f1')
    s = addFeature(s, 'p1', 'C')
    const ids = s.products[0].features.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(s.products[0].features.map((f) => f.title)).toEqual(['B', 'C'])
  })

  it('lässt den Zustand bei unbekannter productId unverändert', () => {
    const s = base()
    expect(addFeature(s, 'p9', 'A')).toBe(s)
  })

  it('verändert das übergebene Objekt nicht und nur das Produkt productId', () => {
    const s = addFeature(addProduct(base(), 'Notizbuch'), 'p1', 'A')
    const before = JSON.stringify(s)
    const t = addFeature(s, 'p2', 'B')
    expect(JSON.stringify(s)).toBe(before)
    expect(t.products[0]).toBe(s.products[0])
    expect(t.products[1].features).toHaveLength(1)
    expect(t.selectedId).toBe(s.selectedId)
  })
})

describe('deleteFeature', () => {
  const withThree = () => {
    let s = addProduct(addProduct(emptyState(), 'Shipmap'), 'Notizbuch')
    s = addFeature(s, 'p1', 'A')
    s = addFeature(s, 'p1', 'B')
    s = addFeature(s, 'p1', 'C')
    return addFeature(s, 'p2', 'X')
  }

  it('entfernt genau das Feature und behält die Reihenfolge der übrigen', () => {
    const s = withThree()
    const t = deleteFeature(s, 'p1', 'f2')
    expect(t.products[0].features.map((f) => f.title)).toEqual(['A', 'C'])
  })

  it('lässt den Zustand bei unbekannter productId oder featureId unverändert', () => {
    const s = withThree()
    expect(deleteFeature(s, 'p9', 'f1')).toBe(s)
    expect(deleteFeature(s, 'p1', 'f9')).toBe(s)
  })

  it('verändert das übergebene Objekt nicht und nur das Produkt productId', () => {
    const s = withThree()
    const before = JSON.stringify(s)
    const t = deleteFeature(s, 'p1', 'f1')
    expect(JSON.stringify(s)).toBe(before)
    expect(t.products[1]).toBe(s.products[1])
    expect(t.selectedId).toBe(s.selectedId)
  })
})

describe('Features und Speicher', () => {
  it('kommen nach saveState und loadState unverändert zurück', () => {
    const storage = memoryStorage()
    const s = addFeature(addFeature(addProduct(emptyState(), 'Shipmap'), 'p1', 'Login'), 'p1', 'Export')
    saveState(storage, s)
    expect(loadState(storage)).toEqual(s)
  })
})

describe('renameFeature und setFeatureStatus', () => {
  const base = () => {
    let s = addProduct(addProduct(emptyState(), 'Shipmap'), 'Notizbuch')
    s = addFeature(s, 'p1', 'Login')
    s = addFeature(s, 'p1', 'Export')
    s = addFeature(s, 'p1', 'Suche')
    s = addFeature(s, 'p2', 'X')
    return { ...s, selectedId: 'p1' }
  }

  it('renameFeature schneidet zu und setzt den Titel, Status bleibt', () => {
    const s = base()
    const t = renameFeature(s, 'p1', 'f1', '  Anmeldung ')
    expect(t.products[0].features[0]).toEqual({ id: 'f1', title: 'Anmeldung', status: 'Idee' })
  })

  it('renameFeature lässt den Zustand bei leerem Titel unverändert', () => {
    const s = base()
    expect(renameFeature(s, 'p1', 'f1', '   ')).toBe(s)
    expect(renameFeature(s, 'p1', 'f1', '')).toBe(s)
  })

  it('setFeatureStatus setzt jeden der vier Werte, Titel bleibt', () => {
    const s = base()
    for (const status of ['Idee', 'geplant', 'in Arbeit', 'ausgeliefert'] as const) {
      const f = setFeatureStatus(s, 'p1', 'f2', status).products[0].features[1]
      expect(f).toEqual({ id: 'f2', title: 'Export', status })
    }
  })

  it('setFeatureStatus lässt den Zustand bei ungültigem Wert unverändert', () => {
    const s = base()
    for (const bad of ['', 'idee', 'fertig', 'In Arbeit']) {
      expect(setFeatureStatus(s, 'p1', 'f1', bad)).toBe(s)
    }
  })

  it('beide lassen den Zustand bei unbekannter productId oder featureId unverändert', () => {
    const s = base()
    expect(renameFeature(s, 'p9', 'f1', 'Neu')).toBe(s)
    expect(renameFeature(s, 'p1', 'f9', 'Neu')).toBe(s)
    expect(setFeatureStatus(s, 'p9', 'f1', 'geplant')).toBe(s)
    expect(setFeatureStatus(s, 'p1', 'f9', 'geplant')).toBe(s)
  })

  it('ändern nur das eine Feature und verändern das übergebene Objekt nicht', () => {
    const s = base()
    s.products[0].features[1].note = 'Notiz'
    const before = JSON.stringify(s)
    const r = renameFeature(s, 'p1', 'f2', 'Ausgabe')
    const u = setFeatureStatus(s, 'p1', 'f2', 'geplant')
    expect(JSON.stringify(s)).toBe(before)
    for (const t of [r, u]) {
      expect(t.products[0].features.map((f) => f.id)).toEqual(['f1', 'f2', 'f3'])
      expect(t.products[0].features[1].note).toBe('Notiz')
      expect(t.products[0].features[0]).toBe(s.products[0].features[0])
      expect(t.products[0].features[2]).toBe(s.products[0].features[2])
      expect(t.products[1]).toBe(s.products[1])
      expect(t.selectedId).toBe('p1')
    }
    expect(r.products[0].features[1].status).toBe('Idee')
    expect(u.products[0].features[1].title).toBe('Export')
  })

  it('kommen nach saveState und loadState unverändert zurück', () => {
    const storage = memoryStorage()
    const s = setFeatureStatus(renameFeature(base(), 'p1', 'f1', 'Anmeldung'), 'p1', 'f2', 'in Arbeit')
    saveState(storage, s)
    expect(loadState(storage)).toEqual(s)
  })
})
