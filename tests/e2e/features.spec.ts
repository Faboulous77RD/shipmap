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

test.beforeEach(async ({ page }) => {
  await page.goto('/shipmap/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
})

test('Anlegen und leerer Titel', async ({ page }) => {
  await expect(page.getByLabel('Feature-Titel')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Feature hinzufügen' })).toHaveCount(0)
  await expect(page.getByRole('list')).toHaveCount(0)

  await createProduct(page, 'Shipmap')
  await expect(page.getByText('Noch keine Features.')).toBeVisible()
  await expect(page.getByRole('list')).toHaveCount(0)

  await addFeature(page, '   ')
  await addFeature(page, '')
  await expect(page.getByText('Noch keine Features.')).toBeVisible()
  await expect(page.getByRole('listitem')).toHaveCount(0)

  await addFeature(page, '  Login  ')
  await expect(page.getByText('Noch keine Features.')).toHaveCount(0)
  await expect(page.locator('ol > li')).toHaveCount(1)
  await expect(page.locator('ol > li')).toHaveText(/^Priorität 1LoginIdee/)
  await expect(page.getByLabel('Feature-Titel')).toHaveValue('')

  await addFeature(page, '   ')
  await expect(page.locator('ol > li')).toHaveCount(1)
})

test('Reihenfolge und Priorität bei drei Features', async ({ page }) => {
  await createProduct(page, 'Shipmap')
  for (const title of ['Login', 'Export', 'Suche']) await addFeature(page, title)
  const items = page.locator('ol > li')
  await expect(items).toHaveCount(3)
  await expect(items.nth(0)).toHaveText(/^Priorität 1LoginIdee/)
  await expect(items.nth(1)).toHaveText(/^Priorität 2ExportIdee/)
  await expect(items.nth(2)).toHaveText(/^Priorität 3SucheIdee/)
})

test('Löschen des mittleren Features', async ({ page }) => {
  await createProduct(page, 'Shipmap')
  for (const title of ['Login', 'Export', 'Suche']) await addFeature(page, title)
  await page.getByRole('button', { name: 'Löschen: Export' }).click()
  const items = page.locator('ol > li')
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toHaveText(/^Priorität 1LoginIdee/)
  await expect(items.nth(1)).toHaveText(/^Priorität 2SucheIdee/)
  await expect(page.getByRole('button', { name: 'Löschen: Export' })).toHaveCount(0)
})

test('Features zweier Produkte sind getrennt', async ({ page }) => {
  await createProduct(page, 'Shipmap')
  await addFeature(page, 'Login')
  await createProduct(page, 'Notizbuch')
  await expect(page.getByText('Noch keine Features.')).toBeVisible()
  await addFeature(page, 'Tags')

  const select = page.getByLabel('Produkt', { exact: true })
  await expect(page.locator('ol > li')).toHaveCount(1)
  await expect(page.locator('ol > li')).toContainText(['Tags'])

  await select.selectOption({ label: 'Shipmap' })
  await expect(page.locator('ol > li')).toHaveCount(1)
  await expect(page.locator('ol > li')).toContainText(['Login'])
  await expect(page.getByText('Tags')).toHaveCount(0)
})

test('Neuladen behält Features, Reihenfolge und Löschungen', async ({ page }) => {
  await createProduct(page, 'Shipmap')
  for (const title of ['Login', 'Export', 'Suche']) await addFeature(page, title)
  await page.getByRole('button', { name: 'Löschen: Export' }).click()
  await page.reload()

  const items = page.locator('ol > li')
  await expect(items).toHaveCount(2)
  await expect(items.nth(0)).toHaveText(/^Priorität 1LoginIdee/)
  await expect(items.nth(1)).toHaveText(/^Priorität 2SucheIdee/)

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('shipmap:v1')!))
  expect(stored.products[0].features.map((f: { title: string }) => f.title)).toEqual([
    'Login',
    'Suche',
  ])
})

test('kein horizontales Überlaufen bei 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 })
  await createProduct(page, 'Shipmap')
  await addFeature(page, 'Kurz')
  await addFeature(page, 'x'.repeat(80))
  await expect(page.locator('ol > li')).toHaveCount(2)
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
})
