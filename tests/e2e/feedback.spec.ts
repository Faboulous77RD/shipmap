import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const hasKey = Boolean(process.env.VITE_POSTHOG_KEY)
const CONSENT_KEY = 'shipmap:consent:v1'
const DANKE = 'Danke für dein Feedback.'
const FEHLER = 'Senden fehlgeschlagen. Bitte versuche es später erneut.'

interface Captured {
  hosts: string[]
  bodies: string[]
}

async function capture(page: Page): Promise<Captured> {
  const seen: Captured = { hosts: [], bodies: [] }
  page.on('request', (request) => seen.hosts.push(new URL(request.url()).host))
  await page.route('https://eu.i.posthog.com/**', async (route) => {
    seen.bodies.push(route.request().postData() ?? '')
    await route.fulfill({ status: 200, body: '{}' })
  })
  return seen
}

function posthogHosts(seen: Captured): string[] {
  return seen.hosts.filter((h) => h.includes('posthog'))
}

async function overflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
}

async function open(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Feedback', exact: true }).click()
}

// posthog-js verwirft Ereignisse von Bots (navigator.webdriver, Marke HeadlessChrome in userAgentData).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    Object.defineProperty(navigator, 'userAgentData', { get: () => undefined })
  })
})

test.beforeEach(async ({ page }) => {
  await page.goto('/shipmap/')
  await page.evaluate(() => window.localStorage.clear())
})

test.describe('mit Schlüssel', () => {
  test.skip(!hasKey, 'VITE_POSTHOG_KEY nicht gesetzt')

  test('Container liegt hinter #app', async ({ page }) => {
    await page.reload()
    const order = await page.evaluate(() => {
      const app = document.querySelector('#app')
      const box = document.querySelector('#feedback')
      return {
        parent: box?.parentElement === document.body,
        after: !!app && !!box && !!(app.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING),
      }
    })
    expect(order).toEqual({ parent: true, after: true })
  })

  test('Knopf fest unten rechts, auch nach Produktwechsel', async ({ page }) => {
    await page.reload()
    const toggle = page.getByRole('button', { name: 'Feedback', exact: true })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await expect(toggle).toBeInViewport()
    expect(await toggle.evaluate((n) => getComputedStyle(n).position)).toBe('fixed')
    for (const name of ['Shipmap', 'Notizbuch']) {
      await page.getByLabel('Produktname').fill(name)
      await page.getByRole('button', { name: 'Produkt anlegen' }).click()
      await expect(toggle).toBeInViewport()
    }
    await page.getByLabel('Produkt', { exact: true }).selectOption({ label: 'Shipmap' })
    await expect(toggle).toBeInViewport()
  })

  test('Klick öffnet und schließt das Formular', async ({ page }) => {
    await page.reload()
    const toggle = page.getByRole('button', { name: 'Feedback', exact: true })
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    const region = page.getByRole('region', { name: 'Feedback', exact: true })
    await expect(region).toBeVisible()
    await expect(region.getByLabel('Dein Feedback')).toBeVisible()
    expect(await region.locator('textarea').count()).toBe(1)
    await expect(region.getByText('Beim Absenden wird dein Text an PostHog (EU) gesendet.')).toBeVisible()
    await expect(region.getByRole('button', { name: 'Senden', exact: true })).toBeVisible()
    await toggle.click()
    await expect(region).toHaveCount(0)
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  })

  test('vor dem Absenden keine posthog-Anfrage', async ({ page }) => {
    const seen = await capture(page)
    await page.reload()
    await open(page)
    await page.getByLabel('Dein Feedback').fill('Gefällt mir')
    await page.waitForTimeout(300)
    expect(seen.hosts.length).toBeGreaterThan(0)
    expect(posthogHosts(seen)).toEqual([])
  })

  for (const [label, value] of [
    ['leerem localStorage', null],
    ['Zustimmung', 'granted'],
    ['Ablehnung', 'denied'],
  ] as const) {
    test(`Senden mit ${label}: genau ein Ereignis`, async ({ page }) => {
      if (value !== null) {
        await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [CONSENT_KEY, value])
      }
      const seen = await capture(page)
      await page.reload()
      await open(page)
      await page.getByLabel('Dein Feedback').fill('Gefällt mir')
      await page.getByRole('button', { name: 'Senden', exact: true }).click()
      await expect(page.getByRole('status')).toHaveText(DANKE)
      await expect(page.getByLabel('Dein Feedback')).toHaveValue('')
      await expect.poll(() => seen.bodies.length).toBe(1)
      await page.waitForTimeout(500)
      expect(seen.bodies).toHaveLength(1)
      expect(seen.bodies[0]).toContain('feedback')
      expect(seen.bodies[0]).toContain('Gefällt mir')
    })
  }

  test('leerer Text sendet nichts und bestätigt nichts', async ({ page }) => {
    const seen = await capture(page)
    await page.reload()
    await open(page)
    const send = page.getByRole('button', { name: 'Senden', exact: true })
    await send.click()
    await page.getByLabel('Dein Feedback').fill('   ')
    await send.click()
    await page.waitForTimeout(300)
    expect(posthogHosts(seen)).toEqual([])
    await expect(page.getByText(DANKE)).toHaveCount(0)
  })

  test('Doppelklick sendet ein Ereignis', async ({ page }) => {
    const seen = await capture(page)
    await page.reload()
    await open(page)
    await page.getByLabel('Dein Feedback').fill('Doppelt')
    await page.getByRole('button', { name: 'Senden', exact: true }).dblclick()
    await expect(page.getByRole('status')).toHaveText(DANKE)
    await page.waitForTimeout(500)
    expect(seen.bodies).toHaveLength(1)
  })

  test('Fehler beim Laden von posthog-js', async ({ page }) => {
    const seen = await capture(page)
    await page.route(/posthog-js/, (route) => route.abort())
    await page.reload()
    await open(page)
    await page.getByLabel('Dein Feedback').fill('Bleibt')
    await page.getByRole('button', { name: 'Senden', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveText(FEHLER)
    await expect(page.getByLabel('Dein Feedback')).toHaveValue('Bleibt')
    await expect(page.getByText(DANKE)).toHaveCount(0)
    expect(seen.bodies).toHaveLength(0)
  })

  test('Freitext wird nicht gespeichert', async ({ page }) => {
    await capture(page)
    await page.reload()
    const before = await page.evaluate(() => JSON.stringify({ ...window.localStorage }))
    await open(page)
    await page.getByLabel('Dein Feedback').fill('Geheim')
    await page.getByRole('button', { name: 'Senden', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText(DANKE)
    const after = await page.evaluate(() => ({
      local: JSON.stringify({ ...window.localStorage }),
      session: window.sessionStorage.length,
      cookie: document.cookie,
    }))
    expect(after.local).toBe(before)
    expect(after.session).toBe(0)
    expect(after.cookie).toBe('')
  })

  test('kein horizontales Überlaufen bei 375 px', async ({ page }) => {
    await capture(page)
    await page.setViewportSize({ width: 375, height: 700 })
    await page.reload()
    await open(page)
    await expect(page.getByRole('region', { name: 'Feedback', exact: true })).toBeVisible()
    expect(await overflow(page)).toBe(false)
    await page.getByLabel('Dein Feedback').fill('Gefällt mir')
    await page.getByRole('button', { name: 'Senden', exact: true }).click()
    await expect(page.getByRole('status')).toHaveText(DANKE)
    expect(await overflow(page)).toBe(false)
  })
})

test.describe('ohne Schlüssel', () => {
  test.skip(hasKey, 'VITE_POSTHOG_KEY gesetzt')

  test('Container leer, keine posthog-Anfrage', async ({ page }) => {
    const seen = await capture(page)
    await page.reload()
    const container = page.locator('#feedback')
    await expect(container).toBeAttached()
    await expect(container).toBeEmpty()
    await expect(page.getByRole('button', { name: 'Feedback' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Feedback' })).toHaveCount(0)
    expect(seen.hosts.length).toBeGreaterThan(0)
    expect(posthogHosts(seen)).toEqual([])
  })
})
