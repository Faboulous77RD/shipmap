import './style.css'
import { mount } from './app.ts'
import { mountConsent } from './ui/consent.ts'

mount(document.querySelector<HTMLDivElement>('#app')!, window.localStorage)

const consent = document.createElement('div')
consent.id = 'consent'
document.body.append(consent)
mountConsent(consent, window.localStorage, import.meta.env.VITE_POSTHOG_KEY)
