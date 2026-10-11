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

test.beforeEach(async ({ page }) => {
  await page.goto('/shipmap/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('Elemente je Eintrag', async ({ page }) => {
  await setup(page, ['Login'])
  const item = page.locator('ol > li').first()
  await expect(item).toHaveText(/^Priorität 1LoginIdee/)
  await expect(item.getByRole('button', { name: 'Umbenennen: Login' })).toBeVisible()
  await expect(item.getByRole('button', { name: 'Löschen: Login' })).toBeVisible()
  const select = item.getByRole('combobox', { name: 'Status: Login' })
  await expect(select).toHaveValue('Idee')
  await expect(select.locator('option')).toHaveText(['Idee', 'geplant', 'in Arbeit', 'ausgeliefert'])
})

test('Statuswechsel', async ({ page }) => {
  await setup(page, ['Login', 'Export'])
  await page.getByRole('combobox', { name: 'Status: Export' }).selectOption('in Arbeit')
  const items = page.locator('ol > li')
  await expect(items.nth(1)).toHaveText(/^Priorität 2Exportin Arbeit/)
  await expect(page.getByRole('combobox', { name: 'Status: Export' })).toHaveValue('in Arbeit')
  await expect(items.nth(0)).toHaveText(/^Priorität 1LoginIdee/)
  const stored = await page.evaluate(() => localStorage.getItem('shipmap:v1'))
  expect(stored).toContain('"status":"in Arbeit"')
})

test('Bearbeitungsmodus', async ({ page }) => {
  await setup(page, ['Login', 'Export'])
  await page.getByRole('button', { name: 'Umbenennen: Login' }).click()
  const field = page.getByRole('textbox', { name: 'Neuer Titel: Login' })
  await expect(field).toHaveValue('Login')
  await expect(page.getByRole('button', { name: 'Speichern' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Abbrechen' })).toBeVisible()
  await expect(page.locator('ol > li').nth(1)).toHaveText(/^Priorität 2ExportIdee/)
})

test('Speichern und Abbrechen', async ({ page }) => {
  await setup(page, ['Login', 'Export'])
  await page.getByRole('button', { name: 'Umbenennen: Login' }).click()
  await page.getByRole('textbox', { name: 'Neuer Titel: Login' }).fill('  Anmeldung ')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(page.locator('ol > li').nth(0)).toHaveText(/^Priorität 1AnmeldungIdee/)
  await expect(page.getByRole('textbox', { name: /Neuer Titel/ })).toHaveCount(0)

  await page.getByRole('button', { name: 'Umbenennen: Export' }).click()
  await page.getByRole('textbox', { name: 'Neuer Titel: Export' }).fill('Ausfuhr')
  await page.getByRole('textbox', { name: 'Neuer Titel: Export' }).press('Enter')
  await expect(page.locator('ol > li').nth(1)).toHaveText(/^Priorität 2AusfuhrIdee/)

  await page.getByRole('button', { name: 'Umbenennen: Ausfuhr' }).click()
  await page.getByRole('textbox', { name: 'Neuer Titel: Ausfuhr' }).fill('Nope')
  await page.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(page.locator('ol > li').nth(1)).toHaveText(/^Priorität 2AusfuhrIdee/)

  await page.getByRole('button', { name: 'Umbenennen: Ausfuhr' }).click()
  await page.getByRole('textbox', { name: 'Neuer Titel: Ausfuhr' }).fill('Nope')
  await page.getByRole('textbox', { name: 'Neuer Titel: Ausfuhr' }).press('Escape')
  await expect(page.locator('ol > li').nth(1)).toHaveText(/^Priorität 2AusfuhrIdee/)
})

test('Leerer Titel wird abgelehnt', async ({ page }) => {
  await setup(page, ['Login', 'Suche'])
  await page.getByRole('button', { name: 'Umbenennen: Suche' }).click()
  const field = page.getByRole('textbox', { name: 'Neuer Titel: Suche' })
  await field.fill('   ')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await expect(field).toBeVisible()
  await expect(page.getByText('Titel darf nicht leer sein.')).toBeVisible()
  const stored = await page.evaluate(() => localStorage.getItem('shipmap:v1'))
  expect(stored).toContain('"title":"Suche"')
  await page.getByRole('button', { name: 'Abbrechen' }).click()
  await expect(page.locator('ol > li').nth(1)).toHaveText(/^Priorität 2SucheIdee/)
  await expect(page.getByText('Titel darf nicht leer sein.')).toHaveCount(0)
})

test('Position und andere Daten bleiben unverändert', async ({ page }) => {
  await setup(page, ['Login', 'Export', 'Suche'])
  await createProduct(page, 'Anderes')
  await addFeature(page, 'Fremd')
  await page.getByLabel('Produkt', { exact: true }).selectOption({ label: 'Shipmap' })
  await page.getByRole('combobox', { name: 'Status: Export' }).selectOption('in Arbeit')
  await page.getByRole('button', { name: 'Umbenennen: Login' }).click()
  await page.getByRole('textbox', { name: 'Neuer Titel: Login' }).fill('Anmeldung')
  await page.getByRole('button', { name: 'Speichern' }).click()
  const items = page.locator('ol > li')
  await expect(items.nth(0)).toHaveText(/^Priorität 1AnmeldungIdee/)
  await expect(items.nth(1)).toHaveText(/^Priorität 2Exportin Arbeit/)
  await expect(items.nth(2)).toHaveText(/^Priorität 3SucheIdee/)
  await page.getByLabel('Produkt', { exact: true }).selectOption({ label: 'Anderes' })
  await expect(items).toHaveCount(1)
  await expect(items.nth(0)).toHaveText(/^Priorität 1FremdIdee/)
})

test('Neuladen erhält Titel und Status', async ({ page }) => {
  await setup(page, ['Login'])
  await page.getByRole('combobox', { name: 'Status: Login' }).selectOption('geplant')
  await page.getByRole('button', { name: 'Umbenennen: Login' }).click()
  await page.getByRole('textbox', { name: 'Neuer Titel: Login' }).fill('Anmeldung')
  await page.getByRole('button', { name: 'Speichern' }).click()
  await page.reload()
  await expect(page.locator('ol > li').first()).toHaveText(/^Priorität 1Anmeldunggeplant/)
  const stored = await page.evaluate(() => localStorage.getItem('shipmap:v1'))
  expect(stored).toContain('"title":"Anmeldung","status":"geplant"')
})

test('Kein horizontaler Überlauf bei 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 })
  const long = 'x'.repeat(80)
  await setup(page, [long])
  const overflow = () =>
    page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  expect(await overflow()).toBe(true)
  await page.getByRole('button', { name: `Umbenennen: ${long}` }).click()
  await expect(page.getByRole('textbox', { name: `Neuer Titel: ${long}` })).toBeVisible()
  expect(await overflow()).toBe(true)
})
