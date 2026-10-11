import { consentEnabled, readChoice, writeChoice } from '../consent.ts'
import type { Choice } from '../consent.ts'
import type { StorageLike } from '../store.ts'

export function mountConsent(
  root: HTMLElement,
  storage: StorageLike,
  key: string | undefined,
): void {
  root.replaceChildren()
  if (!consentEnabled(key)) return

  let choice: Choice | null = readChoice(storage)
  let open = false

  function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag)
    if (text !== undefined) node.textContent = text
    return node
  }

  function choose(next: Choice): void {
    writeChoice(storage, next)
    choice = next
    render()
  }

  function button(label: string, onClick: () => void): HTMLButtonElement {
    const node = el('button', label)
    node.type = 'button'
    node.addEventListener('click', onClick)
    return node
  }

  function render(): void {
    const box = el('div')
    if (choice === null) {
      const region = el('section')
      region.className = 'consent-notice'
      region.setAttribute('role', 'region')
      region.setAttribute('aria-label', 'Einwilligung')
      region.append(
        el('p', 'Shipmap darf anonyme Nutzungsereignisse senden. Du kannst das jederzeit ändern.'),
        button('Zustimmen', () => choose('granted')),
        button('Ablehnen', () => choose('denied')),
      )
      box.append(region)
    } else {
      const toggle = button('Einwilligung ändern', () => {
        open = !open
        render()
      })
      toggle.setAttribute('aria-expanded', String(open))
      box.append(toggle)
      if (open) {
        const panel = el('div')
        panel.className = 'consent-settings'
        const granted = choice === 'granted'
        panel.append(
          el('p', granted ? 'Zustimmung erteilt' : 'Abgelehnt'),
          button(granted ? 'Zustimmung widerrufen' : 'Zustimmen', () =>
            choose(granted ? 'denied' : 'granted'),
          ),
        )
        box.append(panel)
      }
    }
    root.replaceChildren(box)
  }

  render()
}
