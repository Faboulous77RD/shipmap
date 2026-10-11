import './style.css'
import { mount } from './app.ts'
import { consentEnabled } from './consent.ts'
import { createTelemetry, setTelemetry } from './telemetry.ts'
import { mountConsent } from './ui/consent.ts'
import { createFeedbackSender } from './feedback-client.ts'
import { mountFeedback } from './ui/feedback.ts'

mount(document.querySelector<HTMLDivElement>('#app')!, window.localStorage)

const key: string | undefined = import.meta.env.VITE_POSTHOG_KEY
let consentStorage: Storage | ReturnType<typeof createTelemetry>['storage'] = window.localStorage

if (key !== undefined && consentEnabled(key)) {
  const { createPostHogClient } = await import('./posthog-client.ts')
  const telemetry = createTelemetry({
    client: createPostHogClient(key),
    key,
    storage: window.localStorage,
  })
  setTelemetry(telemetry)
  consentStorage = telemetry.storage
}

const consent = document.createElement('div')
consent.id = 'consent'
document.body.append(consent)
mountConsent(consent, consentStorage, key)

const feedback = document.createElement('div')
feedback.id = 'feedback'
document.body.append(feedback)
mountFeedback(feedback, import.meta.env.VITE_POSTHOG_KEY, createFeedbackSender(import.meta.env.VITE_POSTHOG_KEY ?? ''))
