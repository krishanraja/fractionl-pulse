import { expect, test, type Page } from '@playwright/test';

const ACCEPTANCE_WIDTHS = [320, 375, 390, 768, 1024, 1280, 1440, 1920];

const scores = [
  ['2026-08-11', 55, 68, 43, 54, 0.83],
  ['2026-08-04', 53, 65, 42, 52, 0.82],
  ['2026-07-28', 52, 64, 41, 51, 0.80],
  ['2026-07-21', 50, 62, 40, 49, 0.79],
  ['2026-07-14', 48, 60, 39, 47, 0.78],
  ['2026-07-07', 45, 57, 38, 44, 0.76],
  ['2026-06-30', 44, 55, 37, 43, 0.74],
].map(([date, overall, demand, supply, momentum, confidence]) => ({
  date,
  overall_score: overall,
  demand_score: demand,
  supply_score: supply,
  momentum_score: momentum,
  confidence,
  weights: { demand: 0.5, supply: 0.2, culture: 0.3 },
  metadata: {},
}));

const roles = [
  ['cfo', 91],
  ['cmo', 76],
  ['cto', 70],
  ['coo', 64],
  ['cro', 61],
  ['ceo', 56],
].map(([category, normalized]) => ({ category, raw_value: normalized, normalized_value: normalized }));

async function installFixtures(page: Page) {
  await page.route('**/rest/v1/**', async (route) => {
    const url = decodeURIComponent(route.request().url());
    if (url.includes('/fwi_scores?')) {
      await route.fulfill({ json: scores });
      return;
    }
    if (url.includes('/movers?')) {
      await route.fulfill({ json: [] });
      return;
    }
    if (url.includes('/signals?') && url.includes('select=date')) {
      await route.fulfill({ json: [{ date: '2026-08-11' }, { date: '2026-08-04' }] });
      return;
    }
    if (url.includes('/signals?') && url.includes('date=eq.2026-08-11')) {
      await route.fulfill({ json: roles });
      return;
    }
    if (url.includes('/signals?') && url.includes('date=eq.2026-08-04')) {
      await route.fulfill({
        json: roles.map((role) => ({ category: role.category, normalized_value: Number(role.normalized_value) - 1 })),
      });
      return;
    }
    await route.fulfill({ json: [] });
  });

  await page.route('**/functions/v1/fwi-verdict', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: 'data: "Your role is running above the overall hiring market."\n\ndata: " Use your own pipeline before changing rates."\n\ndata: [DONE]\n\n',
    });
  });
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectTouchTargets(page: Page, selector: string) {
  const heights = await page.locator(selector).evaluateAll((elements) => elements
    .filter((element) => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    })
    .map((element) => element.getBoundingClientRect().height));
  expect(heights.length).toBeGreaterThan(0);
  for (const height of heights) expect(height).toBeGreaterThanOrEqual(44);
}

for (const width of ACCEPTANCE_WIDTHS) {
  test(`Pulse remains contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width < 1024 ? 844 : 900 });
    await installFixtures(page);
    await page.goto('/');
    const indexSurface = page.locator(width < 1024 ? '.pulse-mobile-index' : '.pulse-desktop-index');
    await expect(width < 1024 ? indexSurface.locator('.pulse-mobile-score') : indexSurface.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(indexSurface.locator(width < 1024 ? '.pulse-mobile-score > strong' : '.pulse-score-number')).toHaveText('55');
    await expectNoHorizontalOverflow(page);
    await expect(page).toHaveScreenshot(`pulse-index-${width}.png`, { fullPage: true });
  });
}

test.describe('mobile Pulse overlays', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installFixtures(page);
    await page.goto('/');
    await expect(page.locator('.pulse-mobile-bottom-nav')).toBeVisible();
  });

  test('Sources and methods is branded, scrollable, and never covered by navigation', async ({ page }) => {
    const trigger = page.getByRole('button', { name: 'Sources and methods' }).first();
    await trigger.click();

    const surface = page.locator('.pulse-method-drawer');
    await expect(surface).toBeVisible();
    await expect(page.locator('.pulse-mobile-bottom-nav')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Sources and methods' })).toBeVisible();
    await expectTouchTargets(page, '.pulse-method-drawer button, .pulse-method-drawer a, .pulse-method-drawer summary');

    const fonts = await surface.evaluate((element) => ({
      title: getComputedStyle(element.querySelector('h2')!).fontFamily,
      control: getComputedStyle(element.querySelector('summary')!).fontFamily,
    }));
    expect(fonts.title.toLowerCase()).toContain('georgia');
    expect(fonts.control.toLowerCase()).toContain('arial');

    await page.locator('.pulse-method-scroll').evaluate((element) => element.scrollTo(0, element.scrollHeight));
    const footer = page.locator('.pulse-method-footer');
    await expect(footer.getByRole('link', { name: 'View the current raw data' })).toBeVisible();
    const footerBox = await footer.boundingBox();
    const visibleHeight = await page.evaluate(() => window.visualViewport?.height ?? window.innerHeight);
    expect(footerBox).not.toBeNull();
    expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(visibleHeight + 1);
    await expect(page).toHaveScreenshot('pulse-method-mobile.png');

    await page.getByRole('button', { name: 'Close sources and methods' }).click();
    await expect(page.locator('.pulse-mobile-bottom-nav')).toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('Ask the Index follows the visible viewport and exposes the streamed answer', async ({ page }) => {
    await page.locator('.pulse-mobile-bottom-nav').getByRole('button', { name: 'Ask' }).click();
    const surface = page.locator('.pulse-ask-surface');
    const input = page.getByLabel('What are you deciding?');

    await expect(surface).toBeVisible();
    await expect(page.locator('.pulse-mobile-bottom-nav')).toHaveCount(0);
    await expect(input).toBeFocused();
    await expectTouchTargets(page, '.pulse-ask-surface button, .pulse-ask-surface input');
    await page.keyboard.press('Shift+Tab');
    expect(await surface.evaluate((element) => element.contains(document.activeElement))).toBe(true);
    await input.focus();
    await page.setViewportSize({ width: 390, height: 480 });
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--pulse-visual-height'))).toBe('480px');
    await expect.poll(() => surface.evaluate((element) => element.getBoundingClientRect().height)).toBeLessThanOrEqual(481);

    const composerBox = await page.locator('.pulse-ask-composer').boundingBox();
    const visibleHeight = await page.evaluate(() => window.visualViewport?.height ?? window.innerHeight);
    expect(composerBox).not.toBeNull();
    expect(composerBox!.y + composerBox!.height).toBeLessThanOrEqual(visibleHeight + 1);

    await input.fill('Should I raise my rates?');
    await input.press('Enter');
    await expect(input).not.toBeFocused();
    await expect(page.getByText('Your role is running above the overall hiring market.')).toBeVisible();
    await expect(page.getByText('Use your own pipeline before changing rates.')).toBeVisible();
    await expect(page).toHaveScreenshot('pulse-ask-keyboard-mobile.png');

    await page.keyboard.press('Escape');
    await expect(page.locator('.pulse-mobile-bottom-nav')).toBeVisible();
    await expect(page.locator('.pulse-mobile-bottom-nav').getByRole('button', { name: 'Ask' })).toBeFocused();
  });
});
