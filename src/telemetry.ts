import { consentEnabled, readChoice } from './consent.ts'
import type { Choice } from './consent.ts'
import type { StorageLike } from './store.ts'

export type EventName = 'seite_geoeffnet'

export interface TelemetryClient {
  optIn(): void
  optOut(): void
  capture(event: EventName): void
}

export interface Telemetry {
  track(event: EventName): void
  storage: StorageLike
}

type RemovableStorage = StorageLike & Partial<Pick<Storage, 'removeItem'>>

export function createTelemetry(opts: {
  client: TelemetryClient
  key: string | undefined
  storage: StorageLike
}): Telemetry {
  const { client, key } = opts
  const inner: RemovableStorage = opts.storage
  const enabled = consentEnabled(key)
  let current: Choice | null = readChoice(inner)
  let opened = false

  function sendOpened(): void {
    if (opened) return
    opened = true
    client.capture('seite_geoeffnet')
  }

  function evaluate(): void {
    if (!enabled) return
    const next = readChoice(inner)
    const previous = current
    current = next
    if (next === previous) return
    if (next === 'granted') {
      client.optIn()
      sendOpened()
    } else if (previous === 'granted') {
      client.optOut()
    }
  }

  if (enabled && current === 'granted') {
    client.optIn()
    sendOpened()
  }

  const storage: RemovableStorage = {
    getItem: (name) => inner.getItem(name),
    setItem: (name, value) => {
      inner.setItem(name, value)
      evaluate()
    },
    removeItem: (name) => {
      inner.removeItem?.(name)
      evaluate()
    },
  }

  return {
    storage,
    track(event) {
      if (!enabled || readChoice(inner) !== 'granted') return
      client.capture(event)
    },
  }
}

let active: Telemetry | null = null

export function setTelemetry(t: Telemetry | null): void {
  active = t
}

export function track(event: EventName): void {
  active?.track(event)
}
