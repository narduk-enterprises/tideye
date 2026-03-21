import { test, expect } from '@playwright/test'

const BASE_URL = process.env.BASE_URL || 'http://localhost:3333'

// Helper: wait for Nuxt hydration
async function waitForHydration(page: import('@playwright/test').Page) {
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(
    () => {
      return !document.querySelector('#__nuxt')?.classList.contains('nuxt--loading')
    },
    { timeout: 10_000 },
  )
  // Small wait for Vue reactivity
  await page.waitForTimeout(500)
}

test.describe('TideEye — Home Page', () => {
  test('returns 200', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/`)
    expect(response?.status()).toBe(200)
  })

  test('renders hero with TideEye branding', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)
    await waitForHydration(page)
    await expect(page).toHaveTitle(/Tideye/)
    await expect(page.getByText('TideEye').first()).toBeVisible()
    await expect(page.getByText('Open Dashboard').first()).toBeVisible()
  })

  test('renders all 6 feature cards', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)
    await waitForHydration(page)
    const features = [
      'Live Dashboard',
      'SignalK Integration',
      'Passage Planning',
      'Marine Charts',
      'Electrical Monitoring',
      'Mobile First',
    ]
    for (const feature of features) {
      await expect(page.getByText(feature).first()).toBeVisible()
    }
  })

  test('has SEO meta description', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)
    await waitForHydration(page)
    const description = await page.getAttribute('meta[name="description"]', 'content')
    expect(description).toContain('vessel monitoring')
  })
})

test.describe('TideEye — Navigation', () => {
  test('shows nav links', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)
    await waitForHydration(page)
    await expect(page.getByRole('link', { name: 'Dashboard' }).first()).toBeVisible()
  })

  test('Dashboard link navigates to /dashboard', async ({ page }) => {
    await page.goto(`${BASE_URL}/`)
    await waitForHydration(page)
    await page.getByRole('link', { name: 'Dashboard' }).first().click()
    await page.waitForURL(/dashboard/)
    await expect(page).toHaveTitle(/Dashboard/)
  })
})

test.describe('TideEye — Dashboard', () => {
  test('returns 200', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/dashboard`)
    expect(response?.status()).toBe(200)
  })

  test('has correct page title', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)
    await waitForHydration(page)
    await expect(page).toHaveTitle(/Dashboard.*TideEye/)
  })

  test('dashboard page contains expected HTML structure', async ({ page }) => {
    await page.goto(`${BASE_URL}/dashboard`)
    await waitForHydration(page)
    // Verify the SSR output contains dashboard elements
    const html = await page.content()
    expect(html).toContain('dashboard')
  })
})

test.describe('TideEye — API', () => {
  test('health endpoint returns 200', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/api/health`)
    expect(response?.status()).toBe(200)
  })
})
