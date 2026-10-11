import { feedbackEnabled, submitFeedback } from '../feedback.ts'
import type { FeedbackSender } from '../feedback.ts'

export function mountFeedback(
  root: HTMLElement,
  key: string | undefined,
  send: FeedbackSender,
): void {
  root.replaceChildren()
  if (!feedbackEnabled(key)) return

  let open = false
  let sending = false

  function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag)
    if (text !== undefined) node.textContent = text
    return node
  }

  const toggle = el('button', 'Feedback')
  toggle.type = 'button'
  toggle.className = 'feedback-toggle'
  toggle.setAttribute('aria-expanded', 'false')

  const region = el('section')
  region.className = 'feedback-panel'
  region.setAttribute('role', 'region')
  region.setAttribute('aria-label', 'Feedback')

  const label = el('label', 'Dein Feedback')
  const input = el('textarea')
  input.rows = 4
  label.append(input)

  const submit = el('button', 'Senden')
  submit.type = 'button'

  const status = el('p')
  status.setAttribute('role', 'status')
  const alert = el('p')
  alert.setAttribute('role', 'alert')

  region.append(
    label,
    el('p', 'Beim Absenden wird dein Text an PostHog (EU) gesendet.'),
    submit,
    status,
    alert,
  )

  toggle.addEventListener('click', () => {
    open = !open
    toggle.setAttribute('aria-expanded', String(open))
    if (open) root.append(region)
    else region.remove()
  })

  submit.addEventListener('click', async () => {
    if (sending) return
    status.textContent = ''
    alert.textContent = ''
    if (input.value.trim() === '') return
    sending = true
    submit.disabled = true
    const text = input.value
    try {
      await submitFeedback(text, send)
      input.value = ''
      status.textContent = 'Danke für dein Feedback.'
    } catch {
      alert.textContent = 'Senden fehlgeschlagen. Bitte versuche es später erneut.'
    } finally {
      sending = false
      submit.disabled = false
    }
  })

  root.append(toggle)
}
