import { addFeature, addProduct, deleteFeature, loadState, saveState, selectProduct } from './store.ts'
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

      const featureForm = el('form')
      featureForm.className = 'field'
      const featureLabel = el('label', 'Feature-Titel')
      featureLabel.htmlFor = 'feature-title'
      const featureInput = el('input')
      featureInput.id = 'feature-title'
      featureInput.type = 'text'
      featureInput.autocomplete = 'off'
      const featureButton = el('button', 'Feature hinzufügen')
      featureButton.type = 'submit'
      featureForm.append(featureLabel, featureInput, featureButton)
      featureForm.addEventListener('submit', (event) => {
        event.preventDefault()
        update(addFeature(state, selected.id, featureInput.value))
        if (featureInput.isConnected) featureInput.value = ''
      })
      main.append(featureForm)

      if (selected.features.length > 0) {
        const list = el('ol')
        list.className = 'features'
        selected.features.forEach((feature, index) => {
          const item = el('li')
          const remove = el('button', 'Löschen')
          remove.type = 'button'
          remove.setAttribute('aria-label', `Löschen: ${feature.title}`)
          remove.addEventListener('click', () =>
            update(deleteFeature(state, selected.id, feature.id)),
          )
          item.append(
            el('span', `Priorität ${index + 1}`),
            el('span', feature.title),
            el('span', feature.status),
            remove,
          )
          list.append(item)
        })
        main.append(list)
      }
    }

    root.replaceChildren(main)
  }

  render()
}
