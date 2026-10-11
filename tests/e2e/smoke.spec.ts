import { expect, test } from '@playwright/test'

test('Startseite zeigt die Überschrift', async ({ page }) => {
  await page.goto('/shipmap/')
  await expect(page.getByRole('heading', { name: 'Shipmap' })).toBeVisible()
})
