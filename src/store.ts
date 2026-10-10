export type Status = 'Idee' | 'geplant' | 'in Arbeit' | 'ausgeliefert'

export type Feature = {
  id: string
  title: string
  status: Status
  note?: string
}

export type Product = {
  id: string
  name: string
  features: Feature[]
}

export type State = {
  version: 1
  products: Product[]
  selectedId: string | null
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>

export const STORAGE_KEY = 'shipmap:v1'

const STATUSES: readonly string[] = ['Idee', 'geplant', 'in Arbeit', 'ausgeliefert']

export function emptyState(): State {
  return { version: 1, products: [], selectedId: null }
}

function nextId(products: Product[]): string {
  const used = new Set(products.map((p) => p.id))
  let n = products.length + 1
  while (used.has(`p${n}`)) n++
  return `p${n}`
}

export function addProduct(state: State, name: string): State {
  const trimmed = name.trim()
  if (trimmed === '') return state
  const product: Product = { id: nextId(state.products), name: trimmed, features: [] }
  return { ...state, products: [...state.products, product], selectedId: product.id }
}

export function selectProduct(state: State, id: string): State {
  if (!state.products.some((p) => p.id === id)) return state
  return { ...state, selectedId: id }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFeature(value: unknown): value is Feature {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.status === 'string' &&
    STATUSES.includes(value.status) &&
    (value.note === undefined || typeof value.note === 'string')
  )
}

function isProduct(value: unknown): value is Product {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.features) &&
    value.features.every(isFeature)
  )
}

export function loadState(storage: StorageLike): State {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return emptyState()
    const data: unknown = JSON.parse(raw)
    if (!isRecord(data) || data.version !== 1) return emptyState()
    if (!Array.isArray(data.products) || !data.products.every(isProduct)) return emptyState()
    const products: Product[] = data.products
    const selectedId =
      typeof data.selectedId === 'string' && products.some((p) => p.id === data.selectedId)
        ? data.selectedId
        : null
    if (data.selectedId !== null && typeof data.selectedId !== 'string') return emptyState()
    return { version: 1, products, selectedId }
  } catch {
    return emptyState()
  }
}

export function saveState(storage: StorageLike, state: State): void {
  storage.setItem(STORAGE_KEY, JSON.stringify(state))
}
