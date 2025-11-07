import { test, expect } from '@playwright/test'

test('vertical slice loads UI', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('#root')).toBeVisible()
  await expect(page.getByPlaceholder('Search satellites...')).toBeVisible()
})



