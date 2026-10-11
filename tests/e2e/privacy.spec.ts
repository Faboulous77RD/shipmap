import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { PRIVACY_ITEMS } from '../../src/privacy-text.ts'

const NAME = 'Datenschutzhinweis'

function region(page: Page) {
  return page.getByRole('region', { name: NAME, exact: true })
}

function toggle(page: Page) {
  return page.getByRole('button', { name: NAME, exact: true })
}

async function snapshot(page: Page): Promise<{ app: string; storage: string }> {
  return page.evaluate(() => ({
    app: document.querySelector('#app')!.innerHTML,
    storage: JSON.stringify(Object.entries(window.localStorage).sort()),
  }))
}

async function createProduct(page: Page, name: string) {
  await page.getByLabel('Produktname').fill(name)
  await page.getByRole('button', { name: 'Produkt anlegen' }).click()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/shipmap/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
})

test('Container liegt hinter #app', async ({ page }) => {
  const order = await page.evaluate(() => {
    const app = document.querySelector('#app')
    const box = document.querySelector('#privacy')
    return {
      parent: box?.parentElement === document.body,
      after: !!app && !!box && !!(app.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING),
    }
  })
  expect(order).toEqual({ parent: true, after: true })
})

test('Knopf bleibt in allen Ansichten sichtbar', async ({ page }) => {
  await expect(toggle(page)).toBeVisible()
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
  await createProduct(page, 'Shipmap')
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
  await createProduct(page, 'Notizbuch')
  await page.getByLabel('Produkt', { exact: true }).selectOption({ label: 'Shipmap' })
  await expect(toggle(page)).toBeVisible()
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
})

test('Öffnen zeigt alle Einträge in Reihenfolge', async ({ page }) => {
  await expect(region(page)).toHaveCount(0)
  await toggle(page).click()
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true')
  const box = region(page)
  await expect(box).toBeVisible()
  await expect(box.locator('dt')).toHaveText(PRIVACY_ITEMS.map((i) => i.label))
  await expect(box.locator('dd')).toHaveText(PRIVACY_ITEMS.map((i) => i.text))
  await expect(box.getByRole('button', { name: 'Schließen', exact: true })).toBeVisible()

  const verantwortlicher = PRIVACY_ITEMS.find((i) => i.label === 'Verantwortlicher')!
  await expect(box.getByText(verantwortlicher.text, { exact: true })).toBeVisible()
  await expect(box.getByText('Serverstandort EU')).toBeVisible()
  await expect(box.getByText('PostHog').first()).toBeVisible()
  await expect(box.getByText('12 Monate')).toBeVisible()
  await expect(box.getByText('Einwilligung ändern')).toBeVisible()
  await expect(box.getByText('nur im Browser dieses Geräts')).toBeVisible()
})

test('Schließen, erneut öffnen, #app unverändert', async ({ page }) => {
  await createProduct(page, 'Shipmap')
  await page.getByLabel('Feature-Titel').fill('Login')
  await page.getByRole('button', { name: 'Feature hinzufügen' }).click()
  const before = await snapshot(page)

  await toggle(page).click()
  await expect(region(page)).toBeVisible()
  expect((await snapshot(page)).app).toBe(before.app)

  await region(page).getByRole('button', { name: 'Schließen', exact: true }).click()
  await expect(region(page)).toHaveCount(0)
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
  expect((await snapshot(page)).app).toBe(before.app)
  await expect(page.locator('ol > li')).toHaveCount(1)
  await expect(page.locator('ol > li')).toHaveText(/Login/)

  await toggle(page).click()
  await expect(region(page)).toBeVisible()
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true')
})

test('Öffnen und Schließen speichern nichts', async ({ page }) => {
  await createProduct(page, 'Shipmap')
  const before = await snapshot(page)
  await toggle(page).click()
  await region(page).getByRole('button', { name: 'Schließen', exact: true }).click()
  await toggle(page).click()
  await expect(region(page)).toBeVisible()
  expect((await snapshot(page)).storage).toBe(before.storage)
  await page.reload()
  await expect(region(page)).toHaveCount(0)
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false')
  expect((await snapshot(page)).storage).toBe(before.storage)
})

test('375 px: kein horizontaler Überlauf, Texte brechen um', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 })
  await toggle(page).click()
  await expect(region(page)).toBeVisible()
  const result = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth,
    wrap: getComputedStyle(document.querySelector('#privacy dd')!).overflowWrap,
  }))
  expect(result).toEqual({ overflow: false, wrap: 'anywhere' })
})
