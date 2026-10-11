import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function createProduct(page: Page, name: string) {
  await page.getByLabel('Produktname').fill(name)
  await page.getByRole('button', { name: 'Produkt anlegen' }).click()
}

async function addFeature(page: Page, title: string) {
  await page.getByLabel('Feature-Titel').fill(title)
  await page.getByRole('button', { name: 'Feature hinzufügen' }).click()
}

async function setup(page: Page, titles: string[]) {
  await createProduct(page, 'Shipmap')
  for (const title of titles) await addFeature(page, title)
}

async function order(page: Page): Promise<string[]> {
  return page.locator('ol > li').evaluateAll((items) =>
    items.map((li) => li.querySelector('span:nth-child(2)')?.textContent ?? ''),
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto('/shipmap/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('Knöpfe je Eintrag in der vorgesehenen Reihenfolge', async ({ page }) => {
  await setup(page, ['Login', 'Export'])
  const items = page.locator('ol > li')
  await expect(items.nth(0)).toHaveText(/^Priorität 1LoginIdee/)
  for (const title of ['Login', 'Export']) {
    const item = items.filter({ hasText: title })
    const names = await item
      .getByRole('button')
      .evaluateAll((b) => b.map((x) => x.getAttribute('aria-label')))
    expect(names).toEqual([
      `Nach oben: ${title}`,
      `Nach unten: ${title}`,
      `Umbenennen: ${title}`,
      `Löschen: ${title}`,
    ])
    await expect(item.getByRole('combobox', { name: `Status: ${title}` })).toBeVisible()
  }
})

test('Verschieben bei drei Features', async ({ page }) => {
  await setup(page, ['Login', 'Export', 'Suche'])
  await page.getByRole('combobox', { name: 'Status: Suche' }).selectOption('geplant')
  await page.getByRole('button', { name: 'Nach oben: Suche' }).click()
  const items = page.locator('ol > li')
  await expect(items.nth(0)).toHaveText(/^Priorität 1LoginIdee/)
  await expect(items.nth(1)).toHaveText(/^Priorität 2Suchegeplant/)
  await expect(items.nth(2)).toHaveText(/^Priorität 3ExportIdee/)
  await page.getByRole('button', { name: 'Nach unten: Login' }).click()
  await expect(items.nth(0)).toHaveText(/^Priorität 1Suchegeplant/)
  await expect(items.nth(1)).toHaveText(/^Priorität 2LoginIdee/)
  await expect(items.nth(2)).toHaveText(/^Priorität 3ExportIdee/)
})

test('Grenzen: oberster, unterster und einzelner Eintrag', async ({ page }) => {
  await setup(page, ['Login'])
  await expect(page.getByRole('button', { name: 'Nach oben: Login' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Nach unten: Login' })).toBeDisabled()
  await addFeature(page, 'Export')
  await addFeature(page, 'Suche')
  await expect(page.getByRole('button', { name: 'Nach oben: Login' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Nach unten: Login' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Nach oben: Export' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Nach unten: Export' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Nach oben: Suche' })).toBeEnabled()
  await expect(page.getByRole('button', { name: 'Nach unten: Suche' })).toBeDisabled()
  await page.getByRole('button', { name: 'Nach oben: Login' }).click({ force: true })
  await page.getByRole('button', { name: 'Nach unten: Suche' }).click({ force: true })
  expect(await order(page)).toEqual(['Login', 'Export', 'Suche'])
})

test('Tastatur und Fokus nach dem Verschieben', async ({ page }) => {
  await setup(page, ['Login', 'Export', 'Suche'])
  await page.getByRole('button', { name: 'Nach oben: Suche' }).focus()
  await page.keyboard.press('Enter')
  expect(await order(page)).toEqual(['Login', 'Suche', 'Export'])
  await expect(page.getByRole('button', { name: 'Nach oben: Suche' })).toBeFocused()
  await page.keyboard.press('Space')
  expect(await order(page)).toEqual(['Suche', 'Login', 'Export'])
  await expect(page.getByRole('button', { name: 'Nach unten: Suche' })).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button', { name: 'Nach oben: Suche' })).toBeDisabled()
  await page.getByRole('button', { name: 'Nach oben: Login' }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Nach unten: Login' })).toBeFocused()
})

test('Tastatur: Tab erreicht die Knöpfe', async ({ page }) => {
  await setup(page, ['Login', 'Export'])
  await page.getByRole('button', { name: 'Feature hinzufügen' }).focus()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Nach unten: Login' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Umbenennen: Login' })).toBeFocused()
})

test('Fokus wechselt zum anderen Knopf, wenn der gleiche deaktiviert ist', async ({ page }) => {
  await setup(page, ['Login', 'Export'])
  await page.getByRole('button', { name: 'Nach oben: Export' }).click()
  expect(await order(page)).toEqual(['Export', 'Login'])
  await expect(page.getByRole('button', { name: 'Nach unten: Export' })).toBeFocused()
})

test('Trennung zweier Produkte', async ({ page }) => {
  await setup(page, ['Login', 'Export'])
  await createProduct(page, 'Zweit')
  await addFeature(page, 'A')
  await addFeature(page, 'B')
  await page.getByRole('combobox', { name: 'Produkt' }).selectOption({ label: 'Shipmap' })
  await page.getByRole('button', { name: 'Nach oben: Export' }).click()
  expect(await order(page)).toEqual(['Export', 'Login'])
  await page.getByRole('combobox', { name: 'Produkt' }).selectOption({ label: 'Zweit' })
  expect(await order(page)).toEqual(['A', 'B'])
})

test('Neuladen behält Reihenfolge und Prioritäten', async ({ page }) => {
  await setup(page, ['Login', 'Export', 'Suche'])
  await page.getByRole('button', { name: 'Nach oben: Suche' }).click()
  await page.reload()
  const items = page.locator('ol > li')
  await expect(items.nth(0)).toHaveText(/^Priorität 1LoginIdee/)
  await expect(items.nth(1)).toHaveText(/^Priorität 2SucheIdee/)
  await expect(items.nth(2)).toHaveText(/^Priorität 3ExportIdee/)
  const titles = await page.evaluate(() => {
    const data = JSON.parse(localStorage.getItem('shipmap:v1') ?? '{}')
    return data.products[0].features.map((f: { title: string }) => f.title)
  })
  expect(titles).toEqual(['Login', 'Suche', 'Export'])
})

test('Kein horizontaler Überlauf bei 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 })
  await setup(page, ['a'.repeat(80), 'b'.repeat(80), 'Kurz'])
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  expect(overflow).toBe(false)
})
