import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

async function create(page: Page, name: string) {
  await page.getByLabel('Produktname').fill(name)
  await page.getByRole('button', { name: 'Produkt anlegen' }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/shipmap/')
})

test('leerer Zustand', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Shipmap', level: 1 })).toBeVisible()
  await expect(page.getByText('Noch kein Produkt. Lege dein erstes Produkt an.')).toBeVisible()
  await expect(page.getByLabel('Produktname')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Produkt anlegen' })).toBeVisible()
  await expect(page.getByLabel('Produkt', { exact: true })).toHaveCount(0)
})

test('Anlegen und leerer Name', async ({ page }) => {
  await create(page, '   ')
  await expect(page.getByLabel('Produkt', { exact: true })).toHaveCount(0)
  await create(page, '')
  await expect(page.getByText('Noch kein Produkt.')).toBeVisible()

  await create(page, '  Shipmap  ')
  const select = page.getByLabel('Produkt', { exact: true })
  await expect(select.locator('option')).toHaveText(['Shipmap'])
  await expect(select).toHaveValue('p1')
  await expect(page.getByLabel('Produktname')).toHaveValue('')

  await create(page, '   ')
  await expect(select.locator('option')).toHaveCount(1)
})

test('Wechseln zwischen zwei Produkten', async ({ page }) => {
  await create(page, 'Shipmap')
  await create(page, 'Notizbuch')
  const select = page.getByLabel('Produkt', { exact: true })
  await expect(select.locator('option')).toHaveText(['Shipmap', 'Notizbuch'])
  await expect(select).toHaveValue('p2')
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Notizbuch')
  await expect(page.getByText('Noch keine Features.')).toBeVisible()

  await select.selectOption({ label: 'Shipmap' })
  await expect(select).toHaveValue('p1')
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Shipmap')
  await expect(page.getByText('Noch keine Features.')).toBeVisible()
})

test('Neuladen behält Produkte und Auswahl', async ({ page }) => {
  await create(page, 'Shipmap')
  await create(page, 'Notizbuch')
  await page.getByLabel('Produkt', { exact: true }).selectOption({ label: 'Shipmap' })
  await page.reload()
  const select = page.getByLabel('Produkt', { exact: true })
  await expect(select.locator('option')).toHaveText(['Shipmap', 'Notizbuch'])
  await expect(select).toHaveValue('p1')
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Shipmap')
  await expect(page.getByText('Noch keine Features.')).toBeVisible()
})

test('keine fremden Netzwerkanfragen', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const urls: string[] = []
  page.on('request', (request) => urls.push(request.url()))
  await page.reload()
  await create(page, 'Shipmap')
  await create(page, 'Notizbuch')
  expect(urls.length).toBeGreaterThan(0)
  for (const url of urls) {
    expect(new URL(url).origin).toBe(origin)
  }
})

test('kein horizontales Überlaufen bei 375 px', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 })
  await create(page, 'Ein sehr langer Produktname ohne Ende für die schmale Anzeige')
  await create(page, 'Notizbuch')
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(innerWidth)
})
