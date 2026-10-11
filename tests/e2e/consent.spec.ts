import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const hasKey = Boolean(process.env.VITE_POSTHOG_KEY)
const STORAGE_KEY = 'shipmap:consent:v1'
const NOTICE = 'Shipmap darf anonyme Nutzungsereignisse senden. Du kannst das jederzeit ändern.'

async function stored(page: Page): Promise<string | null> {
  return page.evaluate((k) => window.localStorage.getItem(k), STORAGE_KEY)
}

async function overflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
}

test.beforeEach(async ({ page }) => {
  await page.goto('/shipmap/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
})

test.describe('mit Schlüssel', () => {
  test.skip(!hasKey, 'VITE_POSTHOG_KEY nicht gesetzt')

  test('Container liegt hinter #app', async ({ page }) => {
    const order = await page.evaluate(() => {
      const app = document.querySelector('#app')
      const consent = document.querySelector('#consent')
      return {
        parent: consent?.parentElement === document.body,
        after: !!app && !!consent && !!(app.compareDocumentPosition(consent) & Node.DOCUMENT_POSITION_FOLLOWING),
      }
    })
    expect(order).toEqual({ parent: true, after: true })
  })

  test('Hinweis ohne gespeicherte Wahl', async ({ page }) => {
    const region = page.getByRole('region', { name: 'Einwilligung', exact: true })
    await expect(region).toBeVisible()
    await expect(region.getByText(NOTICE)).toBeVisible()
    await expect(region.getByRole('button')).toHaveText(['Zustimmen', 'Ablehnen'])
  })

  for (const [label, value] of [
    ['Zustimmen', 'granted'],
    ['Ablehnen', 'denied'],
  ] as const) {
    test(`${label} speichert ${value}`, async ({ page }) => {
      await page.getByRole('button', { name: label, exact: true }).click()
      await expect(page.getByRole('region', { name: 'Einwilligung', exact: true })).toHaveCount(0)
      expect(await stored(page)).toBe(value)
      await page.reload()
      await expect(page.getByRole('region', { name: 'Einwilligung', exact: true })).toHaveCount(0)
      await expect(page.getByText(NOTICE)).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Einwilligung ändern' })).toBeVisible()
    })
  }

  test('Einstellung: widerrufen und wieder zustimmen', async ({ page }) => {
    await page.getByRole('button', { name: 'Zustimmen', exact: true }).click()
    const toggle = page.getByRole('button', { name: 'Einwilligung ändern' })
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(page.getByText('Zustimmung erteilt')).toBeVisible()
    await page.getByRole('button', { name: 'Zustimmung widerrufen' }).click()
    await expect(page.getByText('Abgelehnt', { exact: true })).toBeVisible()
    expect(await stored(page)).toBe('denied')
    await page.reload()
    await page.getByRole('button', { name: 'Einwilligung ändern' }).click()
    await expect(page.getByText('Abgelehnt', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Zustimmen', exact: true }).click()
    await expect(page.getByText('Zustimmung erteilt')).toBeVisible()
    expect(await stored(page)).toBe('granted')
    await page.reload()
    await page.getByRole('button', { name: 'Einwilligung ändern' }).click()
    await expect(page.getByText('Zustimmung erteilt')).toBeVisible()
  })

  test('Einstellung bleibt in der Produktansicht erreichbar', async ({ page }) => {
    await page.evaluate((k) => window.localStorage.setItem(k, 'denied'), STORAGE_KEY)
    await page.reload()
    const toggle = page.getByRole('button', { name: 'Einwilligung ändern' })
    await expect(toggle).toBeVisible()
    for (const name of ['Shipmap', 'Notizbuch']) {
      await page.getByLabel('Produktname').fill(name)
      await page.getByRole('button', { name: 'Produkt anlegen' }).click()
      await expect(toggle).toBeVisible()
    }
    await page.getByLabel('Produkt', { exact: true }).selectOption({ label: 'Shipmap' })
    await expect(toggle).toBeVisible()
    await toggle.click()
    await expect(page.getByText('Abgelehnt', { exact: true })).toBeVisible()
  })

  test('kein horizontales Überlaufen bei 375 px', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 })
    await expect(page.getByText(NOTICE)).toBeVisible()
    expect(await overflow(page)).toBe(false)
    await page.getByRole('button', { name: 'Zustimmen', exact: true }).click()
    await page.getByRole('button', { name: 'Einwilligung ändern' }).click()
    await expect(page.getByText('Zustimmung erteilt')).toBeVisible()
    expect(await overflow(page)).toBe(false)
  })

  test('keine posthog-Anfrage vor einer Wahl und nach Ablehnen', async ({ page }) => {
    const hosts: string[] = []
    page.on('request', (request) => hosts.push(new URL(request.url()).host))
    await page.reload()
    await expect(page.getByText(NOTICE)).toBeVisible()
    await page.getByRole('button', { name: 'Ablehnen', exact: true }).click()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Einwilligung ändern' })).toBeVisible()
    expect(hosts.length).toBeGreaterThan(0)
    expect(hosts.filter((h) => h.includes('posthog'))).toEqual([])
  })
})

test.describe('ohne Schlüssel', () => {
  test.skip(hasKey, 'VITE_POSTHOG_KEY gesetzt')

  test('Container leer, weder Hinweis noch Einstellung', async ({ page }) => {
    const container = page.locator('#consent')
    await expect(container).toBeAttached()
    await expect(container).toBeEmpty()
    await expect(page.getByText(NOTICE)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Einwilligung ändern' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Einwilligung' })).toHaveCount(0)
  })
})
