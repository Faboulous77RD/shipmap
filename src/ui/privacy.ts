import { PRIVACY_ITEMS, PRIVACY_TITLE } from '../privacy-text.ts'

export function mountPrivacy(root: HTMLElement): void {
  let open = false

  function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag)
    if (text !== undefined) node.textContent = text
    return node
  }

  function button(label: string, onClick: () => void): HTMLButtonElement {
    const node = el('button', label)
    node.type = 'button'
    node.addEventListener('click', onClick)
    return node
  }

  function render(): void {
    const box = el('div')
    const toggle = button(PRIVACY_TITLE, () => {
      open = !open
      render()
    })
    toggle.setAttribute('aria-expanded', String(open))
    box.append(toggle)
    if (open) {
      const region = el('section')
      region.className = 'privacy-notice'
      region.setAttribute('role', 'region')
      region.setAttribute('aria-label', PRIVACY_TITLE)
      const list = el('dl')
      for (const item of PRIVACY_ITEMS) {
        list.append(el('dt', item.label), el('dd', item.text))
      }
      region.append(
        list,
        button('Schließen', () => {
          open = false
          render()
        }),
      )
      box.append(region)
    }
    root.replaceChildren(box)
  }

  render()
}
