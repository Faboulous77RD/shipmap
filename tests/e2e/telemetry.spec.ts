import { expect, test } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

const hasKey = Boolean(process.env.VITE_POSTHOG_KEY)
const NOTICE = 'Shipmap darf anonyme Nutzungsereignisse senden. Du kannst das jederzeit ändern.'
const EVENT_PATH = /^\/(e\/|i\/v0\/e\/)/

function isPostHog(request: Request): boolean {
  return new URL(request.url()).host.includes('posthog')
}

async function track(page: Page): Promise<Request[]> {
  const seen: Request[] = []
  await page.route('https://eu.i.posthog.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":1}' }),
  )
  page.on('request', (request) => {
    if (isPostHog(request)) seen.push(request)
  })
  return seen
}

function events(seen: Request[]): Request[] {
  return seen.filter((r) => {
    const url = new URL(r.url())
    return url.host === 'eu.i.posthog.com' && EVENT_PATH.test(url.pathname) && r.method() !== 'GET'
  })
}

async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(1500)
}

async function clickProduct(page: Page): Promise<void> {
  for (const name of ['Shipmap', 'Notizbuch']) {
    await page.getByLabel('Produktname').fill(name)
    await page.getByRole('button', { name: 'Produkt anlegen' }).click()
  }
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

  test('keine Anfrage beim ersten Besuch und nach Ablehnen', async ({ page }) => {
    const seen = await track(page)
    await page.reload()
    await expect(page.getByText(NOTICE)).toBeVisible()
    await settle(page)
    expect(seen).toEqual([])
    await page.getByRole('button', { name: 'Ablehnen', exact: true }).click()
    await page.reload()
    await expect(page.getByRole('button', { name: 'Einwilligung ändern' })).toBeVisible()
    await clickProduct(page)
    await settle(page)
    expect(seen).toEqual([])
  })

  test('Zustimmen sendet genau ein Ereignis, ohne Cookies und ohne Speichereintrag', async ({
    page,
    context,
  }) => {
    const seen = await track(page)
    await page.reload()
    await page.getByRole('button', { name: 'Zustimmen', exact: true }).click()
    await expect.poll(() => events(seen).length, { timeout: 10000 }).toBe(1)
    expect(events(seen)[0].url()).toContain('eu.i.posthog.com')
    await clickProduct(page)
    await page.locator('body').click()
    await settle(page)
    expect(events(seen)).toHaveLength(1)
    expect(await context.cookies()).toEqual([])
    const names = await page.evaluate(() =>
      Object.keys(window.localStorage).filter((k) => k.toLowerCase().includes('posthog')),
    )
    expect(names).toEqual([])
  })

  test('nach Widerruf keine weiteren Anfragen', async ({ page }) => {
    const seen = await track(page)
    await page.reload()
    await page.getByRole('button', { name: 'Zustimmen', exact: true }).click()
    await expect.poll(() => events(seen).length, { timeout: 10000 }).toBe(1)
    await page.reload()
    await settle(page)
    await page.getByRole('button', { name: 'Einwilligung ändern' }).click()
    await page.getByRole('button', { name: 'Zustimmung widerrufen' }).click()
    await expect(page.getByText('Abgelehnt', { exact: true })).toBeVisible()
    await settle(page)
    const before = seen.length
    await clickProduct(page)
    await page.locator('body').click()
    await settle(page)
    expect(seen.length).toBe(before)

    await page.reload()
    await expect(page.getByRole('button', { name: 'Einwilligung ändern' })).toBeVisible()
    const afterReload = seen.length
    await clickProduct(page)
    await settle(page)
    expect(seen.length).toBe(afterReload)
  })
})

test.describe('ohne Schlüssel', () => {
  test.skip(hasKey, 'VITE_POSTHOG_KEY gesetzt')

  test('keine Anfrage an PostHog und posthog-js wird nicht angefordert', async ({ page }) => {
    const urls: string[] = []
    page.on('request', (request) => urls.push(request.url()))
    await page.reload()
    await clickProduct(page)
    await settle(page)
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.filter((u) => u.includes('posthog'))).toEqual([])
  })
})
