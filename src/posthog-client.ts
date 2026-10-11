import type { PostHog } from 'posthog-js'
import type { EventName, TelemetryClient } from './telemetry.ts'

const API_HOST = 'https://eu.i.posthog.com'

export function createPostHogClient(key: string): TelemetryClient {
  let loading: Promise<PostHog> | null = null
  let initialized = false
  let started = false
  let chain: Promise<void> = Promise.resolve()
  let pendingCaptures: { dropped: boolean }[] = []

  function load(): Promise<PostHog> {
    loading ??= import('posthog-js').then((mod) => mod.default)
    return loading
  }

  function enqueue(step: (ph: PostHog) => void): void {
    chain = chain
      .then(load)
      .then(step)
      .catch(() => {})
  }

  return {
    optIn() {
      started = true
      enqueue((ph) => {
        if (!initialized) {
          initialized = true
          ph.init(key, {
            api_host: API_HOST,
            persistence: 'memory',
            autocapture: false,
            capture_pageview: false,
            capture_pageleave: false,
            disable_session_recording: true,
            disable_surveys: true,
            advanced_disable_flags: true,
            opt_out_capturing_by_default: true,
            person_profiles: 'identified_only',
          })
        }
        ph.opt_in_capturing({ captureEventName: false })
      })
    },
    optOut() {
      if (!started) return
      for (const c of pendingCaptures) c.dropped = true
      pendingCaptures = []
      enqueue((ph) => {
        ph.opt_out_capturing()
      })
    },
    capture(event: EventName) {
      if (!started) return
      const entry = { dropped: false }
      pendingCaptures.push(entry)
      enqueue((ph) => {
        pendingCaptures = pendingCaptures.filter((c) => c !== entry)
        if (!entry.dropped) ph.capture(event)
      })
    },
  }
}
