import type { PostHog } from 'posthog-js'
import type { FeedbackSender } from './feedback.ts'

const API_HOST = 'https://eu.i.posthog.com'
const INSTANCE_NAME = 'feedback'

export function createFeedbackSender(key: string): FeedbackSender {
  let instance: Promise<PostHog> | null = null

  function load(): Promise<PostHog> {
    const loading = import('posthog-js').then((mod) => {
      const created = mod.default.init(
        key,
        {
          api_host: API_HOST,
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
        INSTANCE_NAME,
      )
      return created
    })
    loading.catch(() => {
      if (instance === loading) instance = null
    })
    return loading
  }

  return async (text) => {
    instance ??= load()
    const ph = await instance
    ph.capture('feedback', { text })
  }
}
