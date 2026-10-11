import { gunzipSync } from 'node:zlib'
import { expect, test } from '@playwright/test'
import type { Page, Request } from '@playwright/test'

const hasKey = Boolean(process.env.VITE_POSTHOG_KEY)
const NOTICE = 'Shipmap darf anonyme Nutzungsereignisse senden. Du kannst das jederzeit ändern.'
const EVENT_PATH = /^\/(e\/|i\/v0\/e\/)/
const PRODUCT = 'Geheimprodukt-ZX'
const TITLE = 'Geheimtitel-QY'

function isPostHog(request: Request): boolean {
  return new URL(request.url()).host.includes('posthog')
}

async function watch(page: Page): Promise<Request[]> {
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

function readBody(request: Request): string {
  const buffer = request.postDataBuffer()
  if (!buffer) return ''
  try {
    return gunzipSync(buffer).toString('utf8')
  } catch {
    const text = buffer.toString('utf8')
    const variants = [text]
    try {
      variants.push(decodeURIComponent(text))
    } catch {
      // kein URL-kodierter Text
    }
    const payload = /(?:^|&)data=([^&]*)/.exec(text)?.[1]
    if (payload) {
      try {
        const decoded = decodeURIComponent(payload)
        variants.push(decoded, Buffer.from(decoded, 'base64').toString('utf8'))
      } catch {
        // kein kodierter Inhalt
      }
    }
    return variants.join('\n')
  }
}

function named(seen: Request[], name: string): Request[] {
  return events(seen).filter((r) => readBody(r).includes(`"${name}"`))
}

async function settle(page: Page): Promise<void> {
  await page.waitForTimeout(1500)
}

async function addProduct(page: Page, name: string): Promise<void> {
  await page.getByLabel('Produktname').fill(name)
  await page.getByRole('button', { name: 'Produkt anlegen' }).click()
}

async function addFeature(page: Page, title: string): Promise<void> {
  await page.getByLabel('Feature-Titel').fill(title)
  await page.getByRole('button', { name: 'Feature hinzufügen' }).click()
}

async function createBoth(page: Page): Promise<void> {
  await addProduct(page, 'Shipmap')
  await addFeature(page, 'Erstes Feature')
}

// posthog-js verwirft Ereignisse von Bots (navigator.webdriver, Marke HeadlessChrome in userAgentData).
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false })
    Object.defineProperty(navigator, 'userAgentData', { get: () => undefined })
  })
  await page.goto('/shipmap/')
  await page.evaluate(() => window.localStorage.clear())
})

test.describe('mit Schlüssel', () => {
  test.skip(!hasKey, 'VITE_POSTHOG_KEY nicht gesetzt')

  async function consent(page: Page, seen: Request[]): Promise<void> {
    await page.reload()
    await page.getByRole('button', { name: 'Zustimmen', exact: true }).click()
    await expect.poll(() => named(seen, 'seite_geoeffnet').length, { timeout: 10000 }).toBe(1)
  }

  test('Produkt und Feature anlegen senden je genau ein Ereignis', async ({ page }) => {
    const seen = await watch(page)
    await consent(page, seen)

    await addProduct(page, PRODUCT)
    await expect.poll(() => named(seen, 'produkt_angelegt').length, { timeout: 10000 }).toBe(1)
    await addFeature(page, TITLE)
    await expect.poll(() => named(seen, 'feature_angelegt').length, { timeout: 10000 }).toBe(1)
    await settle(page)

    expect(named(seen, 'seite_geoeffnet')).toHaveLength(1)
    expect(named(seen, 'produkt_angelegt')).toHaveLength(1)
    expect(named(seen, 'feature_angelegt')).toHaveLength(1)
    expect(events(seen)).toHaveLength(3)
  })

  test('leere Eingaben senden nichts, Wechseln, Löschen und Neuladen auch nicht', async ({
    page,
  }) => {
    const seen = await watch(page)
    await consent(page, seen)
    await settle(page)
    const before = events(seen).length

    await addProduct(page, '')
    await addProduct(page, '   ')
    await addProduct(page, 'Shipmap')
    await expect.poll(() => events(seen).length, { timeout: 10000 }).toBe(before + 1)
    await addFeature(page, '')
    await addFeature(page, '   ')
    await settle(page)
    expect(events(seen)).toHaveLength(before + 1)

    await addFeature(page, 'Erstes Feature')
    await expect.poll(() => events(seen).length, { timeout: 10000 }).toBe(before + 2)
    await addProduct(page, 'Notizbuch')
    await expect.poll(() => events(seen).length, { timeout: 10000 }).toBe(before + 3)

    await page.getByLabel('Produkt', { exact: true }).selectOption({ label: 'Shipmap' })
    await page.getByRole('button', { name: 'Löschen: Erstes Feature' }).click()
    await expect(page.getByText('Erstes Feature')).toHaveCount(0)
    await settle(page)
    expect(events(seen)).toHaveLength(before + 3)

    const afterReload = events(seen).length
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Shipmap', level: 2 })).toBeVisible()
    await settle(page)
    expect(events(seen).length).toBe(afterReload)
  })

  test('Anfragen enthalten weder Produktname noch Feature-Titel', async ({ page }) => {
    const seen = await watch(page)
    await consent(page, seen)
    await addProduct(page, PRODUCT)
    await addFeature(page, TITLE)
    await expect.poll(() => named(seen, 'feature_angelegt').length, { timeout: 10000 }).toBe(1)
    await settle(page)

    const bodies = events(seen).map(readBody)
    expect(bodies.length).toBeGreaterThan(0)
    for (const name of ['seite_geoeffnet', 'produkt_angelegt', 'feature_angelegt']) {
      expect(bodies.some((b) => b.includes(name))).toBe(true)
    }
    for (const body of bodies) {
      expect(body).not.toContain(PRODUCT)
      expect(body).not.toContain(TITLE)
    }
  })

  test('ohne Wahl keine Anfragen beim Anlegen', async ({ page }) => {
    const seen = await watch(page)
    await page.reload()
    await expect(page.getByText(NOTICE)).toBeVisible()
    await createBoth(page)
    await settle(page)
    expect(seen).toEqual([])
  })

  test('nach Ablehnen, auch nach Neuladen, keine Anfragen beim Anlegen', async ({ page }) => {
    const seen = await watch(page)
    await page.reload()
    await page.getByRole('button', { name: 'Ablehnen', exact: true }).click()
    await createBoth(page)
    await page.reload()
    await expect(page.getByRole('button', { name: 'Einwilligung ändern' })).toBeVisible()
    await addProduct(page, 'Notizbuch')
    await addFeature(page, 'Zweites Feature')
    await settle(page)
    expect(seen).toEqual([])
  })

  test('nach Widerruf keine Anfragen beim Anlegen', async ({ page }) => {
    const seen = await watch(page)
    await consent(page, seen)
    await page.getByRole('button', { name: 'Einwilligung ändern' }).click()
    await page.getByRole('button', { name: 'Zustimmung widerrufen' }).click()
    await expect(page.getByText('Abgelehnt', { exact: true })).toBeVisible()
    await settle(page)
    const before = seen.length
    await createBoth(page)
    await settle(page)
    expect(seen.length).toBe(before)
  })
})

test.describe('ohne Schlüssel', () => {
  test.skip(hasKey, 'VITE_POSTHOG_KEY gesetzt')

  test('Anlegen sendet keine Anfrage an posthog', async ({ page }) => {
    const urls: string[] = []
    page.on('request', (request) => urls.push(request.url()))
    await page.reload()
    await createBoth(page)
    await settle(page)
    expect(urls.length).toBeGreaterThan(0)
    expect(urls.filter((u) => u.includes('posthog'))).toEqual([])
  })
})
