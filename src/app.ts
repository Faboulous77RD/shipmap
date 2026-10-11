import {
  addFeature,
  addProduct,
  deleteFeature,
  loadState,
  moveFeature,
  renameFeature,
  saveState,
  selectProduct,
  setFeatureStatus,
} from './store.ts'
import type { State, StorageLike } from './store.ts'
import { track } from './telemetry.ts'

export function appName(): string {
  return 'Shipmap'
}

export function mount(root: HTMLElement, storage: StorageLike): void {
  let state: State = loadState(storage)
  let editing: { productId: string; featureId: string; error: boolean } | null = null
  let pendingFocus: { featureId: string; direction: 'up' | 'down' } | null = null
  const STATUS_OPTIONS = ['Idee', 'geplant', 'in Arbeit', 'ausgeliefert']

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
      const next = addProduct(state, input.value)
      if (next !== state) {
        update(next)
        track('produkt_angelegt')
      }
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
        const next = addFeature(state, selected.id, featureInput.value)
        if (next !== state) {
          update(next)
          track('feature_angelegt')
        }
        if (featureInput.isConnected) featureInput.value = ''
      })
      main.append(featureForm)

      if (selected.features.length > 0) {
        const list = el('ol')
        list.className = 'features'
        selected.features.forEach((feature, index) => {
          const item = el('li')
          const controls: HTMLElement[] = []
          const isEditing =
            editing !== null &&
            editing.productId === selected.id &&
            editing.featureId === feature.id
          let titleNode: HTMLElement
          if (isEditing) {
            const box = el('span')
            box.className = 'title-edit'
            const editInput = el('input')
            editInput.type = 'text'
            editInput.autocomplete = 'off'
            editInput.value = feature.title
            editInput.setAttribute('aria-label', `Neuer Titel: ${feature.title}`)
            box.append(editInput)
            if (editing?.error) box.append(el('span', 'Titel darf nicht leer sein.'))
            titleNode = box
            const input = editInput
            const save = (): void => {
              if (input.value.trim() === '') {
                editing = { productId: selected.id, featureId: feature.id, error: true }
                render()
                return
              }
              editing = null
              const next = renameFeature(state, selected.id, feature.id, input.value)
              if (next === state) render()
              else update(next)
            }
            const cancel = (): void => {
              editing = null
              render()
            }
            input.addEventListener('keydown', (event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                save()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                cancel()
              }
            })
            const saveButton = el('button', 'Speichern')
            saveButton.type = 'button'
            saveButton.addEventListener('click', save)
            const cancelButton = el('button', 'Abbrechen')
            cancelButton.type = 'button'
            cancelButton.addEventListener('click', cancel)
            controls.push(saveButton, cancelButton)
          } else {
            titleNode = el('span', feature.title)
          }
          const remove = el('button', 'Löschen')
          remove.type = 'button'
          remove.setAttribute('aria-label', `Löschen: ${feature.title}`)
          remove.addEventListener('click', () =>
            update(deleteFeature(state, selected.id, feature.id)),
          )
          const rename = el('button', 'Umbenennen')
          rename.type = 'button'
          rename.setAttribute('aria-label', `Umbenennen: ${feature.title}`)
          rename.addEventListener('click', () => {
            editing = { productId: selected.id, featureId: feature.id, error: false }
            render()
          })
          const moveButtons = (['up', 'down'] as const).map((direction) => {
            const label = direction === 'up' ? 'Nach oben' : 'Nach unten'
            const button = el('button', label)
            button.type = 'button'
            button.dataset.move = direction
            button.setAttribute('aria-label', `${label}: ${feature.title}`)
            button.disabled =
              direction === 'up' ? index === 0 : index === selected.features.length - 1
            button.addEventListener('click', () => {
              pendingFocus = { featureId: feature.id, direction }
              const next = moveFeature(state, selected.id, feature.id, direction)
              if (next === state) render()
              else update(next)
            })
            return button
          })
          const statusSelect = el('select')
          statusSelect.setAttribute('aria-label', `Status: ${feature.title}`)
          for (const status of STATUS_OPTIONS) {
            const option = el('option', status)
            option.value = status
            option.selected = status === feature.status
            statusSelect.append(option)
          }
          statusSelect.addEventListener('change', () =>
            update(setFeatureStatus(state, selected.id, feature.id, statusSelect.value)),
          )
          item.append(
            el('span', `Priorität ${index + 1}`),
            titleNode,
            el('span', feature.status),
            ...controls,
            ...moveButtons,
            rename,
            statusSelect,
            remove,
          )
          list.append(item)
        })
        main.append(list)
      }
    }

    root.replaceChildren(main)
    root.querySelector<HTMLInputElement>('.title-edit input')?.focus()
    if (pendingFocus) {
      const items = Array.from(root.querySelectorAll<HTMLLIElement>('.features li'))
      const index = selected?.features.findIndex((f) => f.id === pendingFocus?.featureId) ?? -1
      const item = index === -1 ? undefined : items[index]
      const preferred = item?.querySelector<HTMLButtonElement>(
        `button[data-move="${pendingFocus.direction}"]`,
      )
      const other = item?.querySelector<HTMLButtonElement>(
        `button[data-move="${pendingFocus.direction === 'up' ? 'down' : 'up'}"]`,
      )
      if (preferred && !preferred.disabled) preferred.focus()
      else other?.focus()
      pendingFocus = null
    }
  }

  render()
}
