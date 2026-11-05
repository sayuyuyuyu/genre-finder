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


/** テスト用の ID3v2.3 タグ付き MP3 バイト列を作る。 */
function makeTaggedMp3(frames) {
  const frameBuffers = frames.map((frame) => {
    const body = Buffer.concat([Buffer.from([0x03]), Buffer.from(frame.text, 'utf8')]); // UTF-8
    const header = Buffer.alloc(10);
    header.write(frame.id, 0, 'ascii');
    header.writeUInt32BE(body.length, 4);
    return Buffer.concat([header, body]);
  });
  const frameData = Buffer.concat(frameBuffers);
  const size = frameData.length;
  const synchsafe = Buffer.from([
    (size >> 21) & 0x7f,
    (size >> 14) & 0x7f,
    (size >> 7) & 0x7f,
    size & 0x7f,
  ]);
  const header = Buffer.concat([Buffer.from('ID3'), Buffer.from([0x03, 0x00, 0x00]), synchsafe]);
  return Buffer.concat([header, frameData, Buffer.alloc(2048)]);
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function installMocks(page) {
  const search = fixture('search');
  const analyze = fixture('analyze');
  const resolve = fixture('resolve');
  await page.route('**/api/search**', async (route) => {
    await delay(1000);
    await route.fulfill({ json: search });
  });
  await page.route('**/api/analyze**', async (route) => {
    await delay(1400);
    await route.fulfill({ json: analyze });
  });
  await page.route('**/api/resolve**', async (route) => {
    await delay(300);
    await route.fulfill({ json: resolve });
  });
}

/** 画像の読み込みを待つ。間に合わなくてもスクショは撮る。 */
async function settleImages(page, timeout = 8000) {
  await page
    .waitForFunction(() => Array.from(document.images).every((image) => image.complete), undefined, {
      timeout,
    })
    .catch(() => {});
}


/**
 * 本文テキストのコントラストを検査する（WCAG AA: 通常 4.5 / 大 3.0）。
 * 背景色は要素自身から祖先へ辿って、不透明な色を採用する。
 */
async function contrastViolations(page) {
  return page.evaluate(() => {
    const parse = (str) => {
      const m = str.match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(',').map((v) => parseFloat(v.trim()));
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = ({ r, g, b }) => {
      const f = (v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const blend = (fg, bg) => ({
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a),
      a: 1,
    });
    const ratio = (a, b) => {
      const l1 = lum(a);
      const l2 = lum(b);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const effectiveBg = (el) => {
      let node = el;
      while (node && node !== document.documentElement) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg && bg.a > 0.6) return bg;
        node = node.parentElement;
      }
      return { r: 18, g: 16, b: 14, a: 1 };
    };

    const out = [];
    for (const el of document.querySelectorAll('.judgment *')) {
      if (el.closest('[aria-hidden="true"]')) continue;
      const text = (el.textContent || '').trim();
      if (!text || el.children.length > 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) < 0.1) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const fg = parse(cs.color);
      if (!fg) continue;
      const bg = effectiveBg(el);
      const cr = ratio(blend(fg, bg), bg);
      const size = parseFloat(cs.fontSize);
      const large = size >= 18.66 || (size >= 14 && parseFloat(cs.fontWeight) >= 700);
      const min = large ? 3 : 4.5;
      if (cr < min) out.push({ text: text.slice(0, 20), cls: String(el.className || el.tagName), cr: Math.round(cr * 100) / 100 });
    }
    return out;
  });
}

/** タップ領域が 24x24 未満の操作要素を返す（WCAG 2.2 AA）。 */
async function tapTargetViolations(page) {
  return page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('button, a[href]')) {
      if (el.closest('[aria-hidden="true"]')) continue;
      if (el.classList.contains('skip-link')) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.width < 24 || rect.height < 24) {
        out.push({
          text: (el.textContent || '').trim().slice(0, 18),
          cls: String(el.className || el.tagName),
          w: Math.round(rect.width),
          h: Math.round(rect.height),
        });
      }
    }
    return out;
  });
}

async function noHorizontalOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

async function run() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const errors = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 });
    await page.addInitScript(() => {
      window.__copied = '';
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
          writeText: async (text) => {
            window.__copied = text;
          },
        },
      });
    });
    const analyzeUrls = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/analyze')) analyzeUrls.push(request.url());
    });
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

    // メタ情報（共有カード・ホーム画面追加用）
    const meta = await page.evaluate(() => ({
      manifest: Boolean(document.querySelector('link[rel="manifest"]')),
      appleIcon: Boolean(document.querySelector('link[rel="apple-touch-icon"]')),
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? '',
    }));
    check('meta: manifest がある', meta.manifest);
    check('meta: apple-touch-icon がある', meta.appleIcon);
    check('meta: og:image が設定されている', meta.ogImage.endsWith('/og.png'), meta.ogImage);
    const assets = await page.evaluate(async () => {
      const urls = ['/manifest.webmanifest', '/og.png', '/icon-192.png', '/apple-touch-icon.png'];
      const result = {};
      for (const url of urls) result[url] = (await fetch(url)).status;
      return result;
    });
    check(
      'meta: アイコン/OGPが配信されている',
      Object.values(assets).every((status) => status === 200),
      JSON.stringify(assets),
    );

    // 検索 → 結果
    await page.locator('input[type="search"], input[type="text"]').first().fill('夜に駆ける YOASOBI');
    await page.keyboard.press('Enter');
    if (mode === 'mock') {
      await page.waitForTimeout(150);
      check('skeleton: 検索中に出る', (await page.locator('.skeleton-rows').count()) === 1);
      await page.screenshot({ path: join(artifacts, '09-skeleton-results.png'), fullPage: true });
    }
    await page.waitForSelector('button.track', { timeout: mode === 'mock' ? 8000 : 25000 });
    await settleImages(page);
    const resultCount = await page.locator('button.track').count();
    check(
      'results: ジャンルが大文字で出る',
      /^[A-Z0-9&'.\- ]+$/.test(
        ((await page.locator('.track').first().locator('.track__arcade').innerText().catch(() => '')) || '')
          .trim(),
      ),
    );
    await page.screenshot({ path: join(artifacts, '02-results.png'), fullPage: true });
    check('results: 候補が出る', resultCount > 0, `${resultCount} 件`);
    check('results: 先頭が強調される', (await page.locator('.badge').count()) === 1);
    const resultsContrast = await contrastViolations(page);
    check(
      'a11y: 検索結果のコントラスト（WCAG AA）',
      resultsContrast.length === 0,
      resultsContrast.slice(0, 3).map((v) => `${v.cr} .${v.cls}`).join(' / '),
    );
    const resultsTaps = await tapTargetViolations(page);
    check(
      'a11y: 検索結果のタップ領域（24px）',
      resultsTaps.length === 0,
      JSON.stringify(resultsTaps.slice(0, 3)),
    );
    if (mode === 'mock') {
      const before = await page.locator('button.track').count();
      await page.getByRole('button', { name: /COVERS ON/ }).click();
      const after = await page.locator('button.track').count();
      await page.getByRole('button', { name: /COVERS OFF/ }).click();
      const restored = await page.locator('button.track').count();
      check(
        'results: カバーを隠せる',
        before >= 2 && after === before - 1 && restored === before,
        `${before} → ${after} → ${restored}`,
      );
    }

    // 判定
    await page.locator('button.track').first().click();
    if (mode === 'mock') {
      await page.waitForTimeout(250);
      check('skeleton: 判定中に出る', (await page.locator('.sk-line--arcade').count()) === 1);
      check('skeleton: スキャン表示が出る', (await page.locator('.scan__lamp').count()) === 3);
      await page.screenshot({ path: join(artifacts, '08-skeleton-judgment.png'), fullPage: true });
    }
    await page.waitForSelector('.verdict__arcade', { timeout: mode === 'mock' ? 8000 : 40000 });
    await settleImages(page);
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
    await page.getByRole('button', { name: 'COPY' }).click();
    await page.waitForTimeout(120);
    const copied = await page.evaluate(() => window.__copied ?? '');
    const copyTitle = (await page.locator('.judgment__track-title').innerText()).trim();
    const copyGenre = (await page.locator('.verdict__arcade').innerText()).trim();
    check(
      'judgment: COPYで曲名とジャンルをコピー',
      copied.includes(copyTitle.slice(0, 6)) && copied.includes(copyGenre) && copied.includes('?t='),
      copied.replace(/\n/g, ' | ').slice(0, 70),
    );

    await page.locator('.chip--related').first().click();
    await page.waitForSelector('.related-note', { timeout: 4000 });
    const relatedNote = (await page.locator('.related-note').innerText()).replace(/\n/g, ' ');
    await page.locator('.judgment__lower').screenshot({ path: join(artifacts, '17-related-note.png') });
    await page.locator('.chip--related').first().click();
    await page.waitForTimeout(100);
    check(
      'judgment: RELATEDを押すと一行コメントが出る',
      relatedNote.length > 0 && (await page.locator('.related-note').count()) === 0,
      relatedNote.slice(0, 40),
    );

    check(
      'judgment: 検索結果のジャンルをヒントとして送る',
      analyzeUrls.some((url) => url.includes('genreHint=')),
      analyzeUrls[0] ?? '',
    );

    const lampCount = await page.locator('.lamp').count();
    const agreeCount = await page.locator('.lamp--agree').count();
    check(
      'judgment: 情報源ランプが出る',
      lampCount >= 3 && agreeCount >= 1,
      `${agreeCount}/${lampCount} が一致`,
    );

    const taps = await tapTargetViolations(page);
    check('a11y: 判定画面のタップ領域（24px）', taps.length === 0, JSON.stringify(taps.slice(0, 3)));

    const contrast = await contrastViolations(page);
    check(
      'a11y: テキストのコントラスト（WCAG AA）',
      contrast.length === 0,
      contrast.slice(0, 3).map((v) => `${v.cr} .${v.cls} "${v.text}"`).join(' / '),
    );
    const preview = await page.locator('.preview').count();
    check('judgment: 試聴ボタンがある', preview === 1, `${preview} 個`);
    if (mode === 'mock') {
      const work = await page.locator('.verdict__work').count();
      check('judgment: ゲーム作品名が出る', work === 1, `${work} 個`);
      const workHref = await page.locator('.verdict__work-link').getAttribute('href');
      check(
        'judgment: 作品名がApple Music検索にリンク',
        (workHref ?? '').includes('music.apple.com') && (workHref ?? '').includes('UNDERTALE'),
        workHref ?? '',
      );

      // SPECTRUM を押すと DATA FEED がそのジャンルの根拠に絞られる
      const allRows = await page.locator('.feed__row').count();
      await page.locator('.spectrum__row').nth(1).click();
      await page.waitForTimeout(100);
      const filteredRows = await page.locator('.feed__row').count();
      const filterLabel = (await page.locator('.feed__filter').innerText()).trim();
      check(
        'spectrum: 選択で DATA FEED が絞られる',
        allRows === 4 && filteredRows === 1 && filterLabel === 'GAME MUSIC',
        `${allRows} → ${filteredRows} / ${filterLabel}`,
      );
      await page.locator('.judgment').screenshot({ path: join(artifacts, '11-spectrum-filter.png') });
      await page.locator('.spectrum__row').nth(1).click();
      await page.waitForTimeout(100);
      check('spectrum: もう一度押すと全体に戻る', (await page.locator('.feed__row').count()) === 4);
    }

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

    // PLAY DATA: 2件以上でジャンル集計が出る
    await page.evaluate(() => {
      const entry = (id, title, arcade) => ({
        track: { id, title, artist: 'TEST', source: 'itunes', sourceId: id },
        arcade,
        labelJa: arcade,
        at: Date.now(),
      });
      window.localStorage.setItem(
        'genre-finder:recent:v1',
        JSON.stringify([entry('a', 'A', 'J-POP'), entry('b', 'B', 'J-POP'), entry('c', 'C', 'CHIPTUNE')]),
      );
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.recent__top');
    const topCount = await page.locator('.recent__top-item').count();
    const firstTop = (await page.locator('.recent__top-item').first().innerText()).replace(/\s+/g, ' ');
    check(
      'recent: PLAY DATA が集計される',
      topCount === 2 && firstTop.includes('J-POP') && firstTop.includes('2'),
      `${topCount} / ${firstTop}`,
    );
    await page.screenshot({ path: join(artifacts, '13-play-data.png'), fullPage: true });

    // RANDOM（おまかせ）で1曲選ぶ
    check('random: ボタンがある', (await page.getByRole('button', { name: /RANDOM/ }).count()) === 1);
    if (mode === 'mock') {
      await page.getByRole('button', { name: /RANDOM/ }).click();
      await page.waitForSelector('button.track', { timeout: 8000 });
      check('random: おまかせで結果が出る', (await page.locator('button.track').count()) > 0);
      await page.screenshot({ path: join(artifacts, '12-random.png'), fullPage: true });
    }

    // 共有URL（?t=&a=）で開く
    await page.goto(`${base}/?t=Megalovania&a=Toby%20Fox`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.verdict__arcade', { timeout: mode === 'mock' ? 8000 : 40000 });
    check('share: URL から直接判定できる', (await page.locator('.verdict__arcade').innerText()).trim().length > 0);
    check('share: 判定後に URL が共有形式になる', page.url().includes('?t='));

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
    await settleImages(mobile);
    await mobile.screenshot({ path: join(artifacts, '07-mobile-results.png'), fullPage: true });
    await mobile.locator('button.track').first().click();
    await mobile.waitForSelector('.verdict__arcade', { timeout: mode === 'mock' ? 8000 : 40000 });
    await mobile.screenshot({ path: join(artifacts, '05-mobile-judgment.png'), fullPage: true });
    check('mobile: 横スクロールなし（判定）', await noHorizontalOverflow(mobile));

    // ランキング回帰（実 API のみ）: 「曲名 アーティスト」入力で原曲が1位
    if (mode === 'live') {
      await page.goto(`${base}/`, { waitUntil: 'networkidle' });
      await page.locator('input[type="search"], input[type="text"]').first().fill('Lemon 米津玄師');
      await page.keyboard.press('Enter');
      await page.waitForSelector('button.track', { timeout: 30000 });
      const topRow = (await page.locator('button.track').first().innerText()).replace(/\n/g, ' | ');
      check(
        'ranking: 「曲名 アーティスト」で原曲が1位',
        topRow.includes('Lemon') && topRow.includes('米津玄師'),
        topRow.slice(0, 80),
      );
    }

    // 360px（最小幅）でも崩れないこと
    const narrow = await browser.newPage({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });
    if (mode === 'mock') await installMocks(narrow);
    await narrow.goto(`${base}/`, { waitUntil: 'networkidle' });
    check('360px: 横スクロールなし（idle）', await noHorizontalOverflow(narrow));
    await narrow.locator('input[type="search"], input[type="text"]').first().fill('Megalovania');
    await narrow.keyboard.press('Enter');
    await narrow.waitForSelector('button.track', { timeout: mode === 'mock' ? 8000 : 25000 });
    check('360px: 横スクロールなし（結果）', await noHorizontalOverflow(narrow));
    await narrow.locator('button.track').first().click();
    await narrow.waitForSelector('.verdict__arcade', { timeout: mode === 'mock' ? 8000 : 40000 });
    check('360px: 横スクロールなし（判定）', await noHorizontalOverflow(narrow));
    await narrow.screenshot({ path: join(artifacts, '10-360-judgment.png'), fullPage: true });

    // 空状態
    const emptyPage = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 });
    await emptyPage.route('**/api/search**', (route) =>
      route.fulfill({ json: { query: { title: 'zzzz' }, tracks: [], warnings: [] } }),
    );
    await emptyPage.goto(`${base}/`, { waitUntil: 'networkidle' });
    await emptyPage.locator('input[type="search"], input[type="text"]').first().fill('zzzz');
    await emptyPage.keyboard.press('Enter');
    await emptyPage.waitForSelector('.empty', { timeout: 10000 });
    check('empty: ヒントがチップで出る', (await emptyPage.locator('.empty__chips .chip').count()) >= 3);
    await emptyPage.screenshot({ path: join(artifacts, '14-empty.png'), fullPage: true });

    // エラー状態
    const errorPage = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1.5 });
    if (mode === 'mock') await installMocks(errorPage);
    await errorPage.route('**/api/analyze**', (route) =>
      route.fulfill({ status: 500, json: { error: 'テスト用のエラー' } }),
    );
    await errorPage.goto(`${base}/`, { waitUntil: 'networkidle' });
    await errorPage.locator('input[type="search"], input[type="text"]').first().fill('Megalovania');
    await errorPage.keyboard.press('Enter');
    await errorPage.waitForSelector('button.track', { timeout: mode === 'mock' ? 8000 : 25000 });
    await errorPage.locator('button.track').first().click();
    await errorPage.waitForSelector('.error-card', { timeout: 10000 });
    check('error: 再試行ボタンが出る', (await errorPage.getByRole('button', { name: /再試行/ }).count()) === 1);
    await errorPage.screenshot({ path: join(artifacts, '15-error.png'), fullPage: true });

    if (mode === 'mock') {
      // ブラウザの戻るで検索結果に戻れる
      const backPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await installMocks(backPage);
      await backPage.goto(`${base}/`, { waitUntil: 'networkidle' });
      await backPage.locator('input[type="search"], input[type="text"]').first().fill('Megalovania');
      await backPage.keyboard.press('Enter');
      await backPage.waitForSelector('button.track');
      await backPage.locator('button.track').first().click();
      await backPage.waitForSelector('.verdict__arcade');
      await backPage.goBack();
      await backPage.waitForSelector('button.track', { timeout: 8000 });
      check('history: 戻るで検索結果に戻れる', !backPage.url().includes('?t='), backPage.url());
      await backPage.close();

      // 選曲カーソル（↑↓ + Enter）
      const cursorPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await installMocks(cursorPage);
      await cursorPage.goto(`${base}/`, { waitUntil: 'networkidle' });
      await cursorPage.locator('input[type="search"], input[type="text"]').first().fill('Megalovania');
      await cursorPage.keyboard.press('Enter');
      await cursorPage.waitForSelector('button.track');
      await cursorPage.keyboard.press('ArrowDown');
      const activeIndex = await cursorPage.evaluate(() =>
        Array.from(document.querySelectorAll('button.track')).findIndex((el) =>
          el.classList.contains('is-active'),
        ),
      );
      await cursorPage.screenshot({ path: join(artifacts, '18-cursor.png'), fullPage: true });
      await cursorPage.keyboard.press('Enter');
      await cursorPage.waitForSelector('.verdict__arcade', { timeout: 8000 });
      check('results: ↑↓で選曲カーソルが動き Enter で判定', activeIndex === 1, `active=${activeIndex}`);
      await cursorPage.close();

      // 情報源が落ちたときの注記（赤系）のコントラスト
      const warnPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await installMocks(warnPage);
      const warnFixture = fixture('analyze');
      warnFixture.judgment.failedSources = ['musicbrainz'];
      warnFixture.judgment.warnings = [];
      await warnPage.route('**/api/analyze**', (route) => route.fulfill({ json: warnFixture }));
      await warnPage.goto(`${base}/`, { waitUntil: 'networkidle' });
      await warnPage.locator('input[type="search"], input[type="text"]').first().fill('Megalovania');
      await warnPage.keyboard.press('Enter');
      await warnPage.waitForSelector('button.track');
      await warnPage.locator('button.track').first().click();
      await warnPage.waitForSelector('.judgment__note--warn', { timeout: 8000 });
      const warnContrast = await contrastViolations(warnPage);
      check(
        'a11y: 注意注記のコントラスト（WCAG AA）',
        warnContrast.length === 0,
        warnContrast.slice(0, 3).map((v) => `${v.cr} .${v.cls}`).join(' / '),
      );
      await warnPage.screenshot({ path: join(artifacts, '19-warn-note.png'), fullPage: true });
      await warnPage.close();

      // 音声ファイル: ID3タグから検索
      const filePage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await installMocks(filePage);
      await filePage.goto(`${base}/`, { waitUntil: 'networkidle' });
      const tagged = makeTaggedMp3([
        { id: 'TIT2', text: 'Megalovania' },
        { id: 'TPE1', text: 'Toby Fox' },
      ]);
      await filePage.setInputFiles('#audio-file', {
        name: 'tagged.mp3',
        mimeType: 'audio/mpeg',
        buffer: tagged,
      });
      await filePage.waitForSelector('button.track', { timeout: 12000 });
      const tagNotice = await filePage.locator('.notice').innerText().catch(() => '');
      check(
        'file: ID3タグから検索できる',
        tagNotice.includes('Megalovania') && tagNotice.includes('Toby Fox'),
        tagNotice.slice(0, 60),
      );
      await filePage.screenshot({ path: join(artifacts, '20-file-tags.png'), fullPage: true });

      // 音声ファイル: タグが無ければファイル名から推測
      await filePage.goto(`${base}/`, { waitUntil: 'networkidle' });
      await filePage.setInputFiles('#audio-file', {
        name: '02 - Daft Punk - Get Lucky.mp3',
        mimeType: 'audio/mpeg',
        buffer: Buffer.alloc(2048),
      });
      await filePage.waitForSelector('button.track', { timeout: 12000 });
      const filenameNotice = await filePage.locator('.notice').innerText().catch(() => '');
      check(
        'file: タグが無ければファイル名から推測する',
        filenameNotice.includes('Get Lucky') && filenameNotice.includes('Daft Punk'),
        filenameNotice.slice(0, 70),
      );
      // 音声ファイル以外はやさしく弾く
      await filePage.goto(`${base}/`, { waitUntil: 'networkidle' });
      await filePage.setInputFiles('#audio-file', {
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('not audio', 'utf8'),
      });
      await filePage.waitForSelector('.error-card', { timeout: 10000 });
      const fileError = await filePage.locator('.error-card').innerText();
      check('file: 音声ファイル以外はエラー表示', fileError.includes('音声ファイル'), fileError.split('\n')[1] ?? '');
      await filePage.close();

      // 並び替え（新しい順）
      const sortPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await installMocks(sortPage);
      await sortPage.goto(`${base}/`, { waitUntil: 'networkidle' });
      await sortPage.locator('input[type="search"], input[type="text"]').first().fill('Megalovania');
      await sortPage.keyboard.press('Enter');
      await sortPage.waitForSelector('button.track');
      await sortPage.waitForTimeout(200);
      const matchFirst = await sortPage.locator('button.track').first().innerText();
      await sortPage.getByRole('button', { name: /SORT MATCH/ }).click();
      await sortPage.waitForTimeout(150);
      const newestFirst = await sortPage.locator('button.track').first().innerText();
      await sortPage.screenshot({ path: join(artifacts, '21-sort.png'), fullPage: true });
      check(
        'results: 新しい順に並べ替えられる',
        matchFirst.includes('2015') && newestFirst.includes('2024'),
        `${matchFirst.split('\n')[1] ?? ''} / ${newestFirst.split('\n')[1] ?? ''}`,
      );
      await sortPage.close();

      // 判定画面から同じアーティストを検索
      const artistPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await installMocks(artistPage);
      await artistPage.goto(`${base}/`, { waitUntil: 'networkidle' });
      await artistPage.locator('input[type="search"], input[type="text"]').first().fill('Megalovania');
      await artistPage.keyboard.press('Enter');
      await artistPage.waitForSelector('button.track');
      await artistPage.locator('button.track').first().click();
      await artistPage.waitForSelector('.verdict__arcade');
      await artistPage.getByRole('button', { name: /の曲を検索する/ }).click();
      await artistPage.waitForSelector('button.track', { timeout: 8000 });
      const artistQuery = await artistPage.locator('.stage__title').innerText();
      check('judgment: 同じアーティストで検索できる', artistQuery.includes('Toby Fox'), artistQuery);
      await artistPage.close();

      // キーボードだけで検索できる
      const kbPage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
      await installMocks(kbPage);
      await kbPage.goto(`${base}/`, { waitUntil: 'networkidle' });
      let focused = false;
      for (let i = 0; i < 12 && !focused; i += 1) {
        await kbPage.keyboard.press('Tab');
        focused = await kbPage.evaluate(
          () => document.activeElement?.matches('input[type="text"]') ?? false,
        );
      }
      check('a11y: Tabで検索欄に到達できる', focused);
      if (focused) {
        await kbPage.keyboard.type('Megalovania');
        await kbPage.keyboard.press('Enter');
        await kbPage.waitForSelector('button.track', { timeout: 8000 });
        check('a11y: キーボードだけで検索できる', true);
      }
      await kbPage.screenshot({ path: join(artifacts, '16-keyboard.png'), fullPage: true });
      await kbPage.close();
    }

    if (mode === 'mock') {
      // 動きを減らす設定ではアニメーションしない
      const reducedPage = await browser.newPage({
        viewport: { width: 1440, height: 1000 },
        reducedMotion: 'reduce',
      });
      await installMocks(reducedPage);
      await reducedPage.goto(`${base}/`, { waitUntil: 'networkidle' });
      await reducedPage.locator('input[type="search"], input[type="text"]').first().fill('Megalovania');
      await reducedPage.keyboard.press('Enter');
      await reducedPage.waitForSelector('button.track', { timeout: 8000 });
      await reducedPage.locator('button.track').first().click();
      await reducedPage.waitForSelector('.scan__lamp', { timeout: 8000 });
      const reduced = await reducedPage.evaluate(() => {
        const line = document.querySelector('.sk-line');
        const after = line ? getComputedStyle(line, '::after') : null;
        const lamp = document.querySelector('.scan__lamp');
        const lampBefore = lamp ? getComputedStyle(lamp, '::before') : null;
        return {
          shimmer: after?.animationName ?? '',
          lamp: lampBefore?.animationName ?? '',
        };
      });
      check(
        'a11y: 動きを減らす設定でアニメーション停止',
        reduced.shimmer === 'none' && reduced.lamp === 'none',
        JSON.stringify(reduced),
      );
      await reducedPage.close();
    }

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
