/**
 * ブラウザ E2E。実際の Chrome で画面を開き、操作と表示を確かめてスクリーンショットを残す。
 *
 *   pnpm dev            # 別ターミナルで起動（または E2E_BASE で URL 指定）
 *   pnpm e2e            # モック API で決定的に確認（デフォルト）
 *   pnpm e2e:live       # 実 API で確認
 *
 * Chrome が必要（playwright-core はブラウザを同梱しない）。
 */

import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.E2E_BASE ?? 'http://localhost:5194';
const mode = process.env.E2E_MODE === 'live' ? 'live' : 'mock';
const artifacts = join(root, 'e2e', 'artifacts');
mkdirSync(artifacts, { recursive: true });

const fixture = (name) =>
  JSON.parse(readFileSync(join(root, 'e2e', 'fixtures', `${name}.json`), 'utf8'));

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function installMocks(page) {
  const search = fixture('search');
  const analyze = fixture('analyze');
  const resolve = fixture('resolve');
  await page.route('**/api/search**', (route) => route.fulfill({ json: search }));
  await page.route('**/api/analyze**', (route) => route.fulfill({ json: analyze }));
  await page.route('**/api/resolve**', (route) => route.fulfill({ json: resolve }));
}

async function noHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 });
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    if (mode === 'mock') await installMocks(page);

    // idle
    await page.goto(`${base}/`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.screenshot({ path: join(artifacts, '01-idle.png'), fullPage: true });
    check('idle: 検索入力がある', await page.locator('input').first().isVisible());

    // 検索 → 結果
    await page.locator('input[type="search"], input[type="text"]').first().fill('夜に駆ける YOASOBI');
    await page.keyboard.press('Enter');
    await page.waitForSelector('button.track', { timeout: mode === 'mock' ? 8000 : 25000 });
    const resultCount = await page.locator('button.track').count();
    await page.screenshot({ path: join(artifacts, '02-results.png'), fullPage: true });
    check('results: 候補が出る', resultCount > 0, `${resultCount} 件`);
    check('results: 先頭が強調される', (await page.locator('.badge').count()) === 1);

    // 判定
    await page.locator('button.track').first().click();
    await page.waitForSelector('.verdict__arcade', { timeout: mode === 'mock' ? 8000 : 40000 });
    await page.waitForFunction(
      () => Array.from(document.images).every((image) => image.complete),
      undefined,
      { timeout: 15000 },
    );
    const arcade = (await page.locator('.verdict__arcade').innerText()).trim();
    const level = (await page.locator('.level__value').innerText()).trim();
    const spectrum = await page.locator('.spectrum__row').count();
    const feed = await page.locator('.feed__row').count();
    const comment = (await page.locator('.verdict__comment').innerText()).trim();
    await page.screenshot({ path: join(artifacts, '03-judgment.png'), fullPage: true });
    check('judgment: 大文字ジャンル名', /^[A-Z0-9&'.\- ]{3,}$/.test(arcade), arcade);
    check('judgment: LEVEL が 2 桁', /^\d{2}$/.test(level), level);
    check('judgment: SPECTRUM が 2 行以上', spectrum >= 2, `${spectrum} 行`);
    check('judgment: DATA FEED が 1 行以上', feed >= 1, `${feed} 行`);
    check('judgment: コメントが 1 行', comment.length > 0 && comment.length < 60);
    const preview = await page.locator('.preview').count();
    check('judgment: 試聴ボタンがある', preview === 1, `${preview} 個`);

    // リンク貼り付け
    await page.getByRole('button', { name: /別の曲/ }).first().click();
    const input = page.locator('input[type="search"], input[type="text"]').first();
    await input.fill('https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT');
    await page.keyboard.press('Enter');
    await page.waitForSelector('button.track', { timeout: mode === 'mock' ? 8000 : 30000 });
    await page.screenshot({ path: join(artifacts, '04-link.png'), fullPage: true });
    check('link: リンクから候補が出る', (await page.locator('button.track').count()) > 0);

    // 履歴: 判定 → アイドルに戻ると RECENT に残る
    await page.getByRole('button', { name: /別の曲/ }).first().click();
    await page.waitForSelector('.recent__row', { timeout: 8000 });
    const recentCount = await page.locator('.recent__row').count();
    await page.screenshot({ path: join(artifacts, '06-recent.png'), fullPage: true });
    check('recent: 履歴が残る', recentCount >= 1, `${recentCount} 件`);

    // モバイル
    const mobile = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    mobile.on('pageerror', (error) => errors.push(error.message));
    if (mode === 'mock') await installMocks(mobile);
    await mobile.goto(`${base}/`, { waitUntil: 'networkidle' });
    check('mobile: 横スクロールなし（idle）', await noHorizontalOverflow(mobile));
    await mobile.locator('input[type="search"], input[type="text"]').first().fill('夜に駆ける YOASOBI');
    await mobile.keyboard.press('Enter');
    await mobile.waitForSelector('button.track', { timeout: mode === 'mock' ? 8000 : 25000 });
    await mobile.locator('button.track').first().click();
    await mobile.waitForSelector('.verdict__arcade', { timeout: mode === 'mock' ? 8000 : 40000 });
    await mobile.screenshot({ path: join(artifacts, '05-mobile-judgment.png'), fullPage: true });
    check('mobile: 横スクロールなし（判定）', await noHorizontalOverflow(mobile));

    check('コンソールエラーなし', errors.length === 0, errors.slice(0, 3).join(' / '));
  } finally {
    await browser.close();
  }

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length} / ${results.length} passed (${mode})`);
  console.log(`screenshots: ${artifacts}`);
  if (failed.length > 0) process.exitCode = 1;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
