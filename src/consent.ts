import type { StorageLike } from './store.ts'

export type Choice = 'granted' | 'denied'

export const CONSENT_KEY = 'shipmap:consent:v1'

export function readChoice(storage: StorageLike): Choice | null {
  try {
    const raw = storage.getItem(CONSENT_KEY)
    return raw === 'granted' || raw === 'denied' ? raw : null
  } catch {
    return null
  }
}

export function writeChoice(storage: StorageLike, choice: Choice): void {
  try {
    storage.setItem(CONSENT_KEY, choice)
  } catch {
    // Speicher nicht verfügbar: die Wahl gilt dann nur für diesen Besuch.
  }
}

export function consentEnabled(key: string | undefined): boolean {
  return key !== undefined && key.trim() !== ''
}
