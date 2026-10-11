import { expect, test } from '@playwright/test'

test('Anwendung lädt unter dem Basispfad', async ({ page, baseURL }) => {
  const origin = new URL(baseURL!).origin
  const responses: { url: string; status: number }[] = []
  const errors: string[] = []
  page.on('response', (r) => {
    if (new URL(r.url()).origin === origin) responses.push({ url: r.url(), status: r.status() })
  })
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text())
  })
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto('/shipmap/')
  await expect(page.getByRole('heading', { name: 'Shipmap' })).toBeVisible()
  await page.waitForLoadState('networkidle')

  expect(responses.filter((r) => r.status >= 400)).toEqual([])
  expect(responses.filter((r) => new URL(r.url).pathname.startsWith('/shipmap/assets/')).length).toBeGreaterThan(0)
  expect(errors).toEqual([])
  await expect(page.locator('input[type="password"]')).toHaveCount(0)
  await expect(page.locator('form', { has: page.locator('input[type="password"]') })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /anmeld|login|einloggen/i })).toHaveCount(0)
})

test('Produkt und Feature bleiben nach Neuladen', async ({ page }) => {
  await page.goto('/shipmap/')
  await page.getByLabel('Produktname').fill('Shipmap')
  await page.getByRole('button', { name: 'Produkt anlegen' }).click()
  await page.getByLabel('Feature-Titel').fill('Login')
  await page.getByRole('button', { name: 'Feature hinzufügen' }).click()

  await page.reload()

  await expect(page.getByRole('combobox', { name: 'Produkt', exact: true })).toContainText('Shipmap')
  await expect(page.locator('ol > li').filter({ hasText: 'Priorität 1' }).filter({ hasText: 'Login' })).toHaveCount(1)
})
