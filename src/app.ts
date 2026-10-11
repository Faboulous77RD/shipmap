import { addProduct, loadState, saveState, selectProduct } from './store.ts'
import type { State, StorageLike } from './store.ts'

export function appName(): string {
  return 'Shipmap'
}

export function mount(root: HTMLElement, storage: StorageLike): void {
  let state: State = loadState(storage)

  function update(next: State): void {
    if (next === state) return
    state = next
    saveState(storage, state)
    render()
  }

  function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    text?: string,
  ): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag)
    if (text !== undefined) node.textContent = text
    return node
  }

  function render(): void {
    const main = el('main')
    main.append(el('h1', appName()))

    const selected = state.products.find((p) => p.id === state.selectedId)

    if (state.products.length === 0) {
      main.append(el('p', 'Noch kein Produkt. Lege dein erstes Produkt an.'))
    } else {
      const row = el('div')
      row.className = 'field'
      const label = el('label', 'Produkt')
      label.htmlFor = 'product-select'
      const select = el('select')
      select.id = 'product-select'
      for (const p of state.products) {
        const option = el('option', p.name)
        option.value = p.id
        option.selected = p.id === selected?.id
        select.append(option)
      }
      select.addEventListener('change', () => update(selectProduct(state, select.value)))
      row.append(label, select)
      main.append(row)
    }

    const form = el('form')
    form.className = 'field'
    const label = el('label', 'Produktname')
    label.htmlFor = 'product-name'
    const input = el('input')
    input.id = 'product-name'
    input.type = 'text'
    input.autocomplete = 'off'
    const button = el('button', 'Produkt anlegen')
    button.type = 'submit'
    form.append(label, input, button)
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      update(addProduct(state, input.value))
      if (input.isConnected) input.value = ''
    })
    main.append(form)

    if (selected) {
      main.append(el('h2', selected.name))
      if (selected.features.length === 0) {
        main.append(el('p', 'Noch keine Features.'))
      }
    }

    root.replaceChildren(main)
  }

  render()
}
