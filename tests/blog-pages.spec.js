const { test, expect } = require('@playwright/test');

const SLUG = 'minimax-kimi-multipolar-ai';
const TITLE = 'MiniMax, Kimi, and the End of the US-Only AI Narrative';

test.describe('Static blog pages', () => {

  test('page has correct meta tags in source HTML', async ({ request }) => {
    const response = await request.get(`/blog/${SLUG}/`);
    expect(response.status()).toBe(200);
    const html = await response.text();

    // Title
    expect(html).toContain(`<title>${TITLE} | Stefano Straus</title>`);

    // Meta description
    expect(html).toMatch(/meta name="description" content="[^"]*Chinese models/);

    // Canonical URL
    expect(html).toContain(`href="https://straus.it/blog/${SLUG}/"`);

    // Open Graph
    expect(html).toContain(`og:title" content="${TITLE}"`);
    expect(html).toContain('og:type" content="article"');
    expect(html).toContain(`og:url" content="https://straus.it/blog/${SLUG}/"`);

    // Twitter Card
    expect(html).toContain('twitter:card" content="summary_large_image"');

    // JSON-LD
    expect(html).toContain('"@type": "Article"');
    expect(html).toContain(`"headline": "${TITLE}"`);
    expect(html).toContain('"datePublished": "2026-02-13"');
  });

  test('page source contains article content in noscript', async ({ request }) => {
    const response = await request.get(`/blog/${SLUG}/`);
    const html = await response.text();

    // Content is inside noscript
    expect(html).toContain('<noscript>');
    expect(html).toContain(`<h1>${TITLE}</h1>`);
    expect(html).toContain('datetime="2026-02-13"');

    // Has actual article body (not just meta)
    const noscriptMatch = html.match(/<noscript>([\s\S]*?)<\/noscript>/);
    expect(noscriptMatch).not.toBeNull();
    expect(noscriptMatch[1].length).toBeGreaterThan(500);
  });

  test('page source contains JS redirect', async ({ request }) => {
    const response = await request.get(`/blog/${SLUG}/`);
    const html = await response.text();

    expect(html).toContain(`window.location.replace('/#read/${SLUG}')`);
  });

  test('JS redirect sends users to terminal view', async ({ page }) => {
    await page.goto(`/blog/${SLUG}/`);
    await page.waitForURL(`**/#read/${SLUG}`);
    expect(page.url()).toContain(`/#read/${SLUG}`);
  });

  test('all blog posts have generated pages', async ({ request }) => {
    const indexResp = await request.get('/content/blog/index.json');
    const index = await indexResp.json();

    for (const article of index.articles) {
      const resp = await request.get(`/blog/${article.slug}/`);
      expect(resp.status(), `Missing page for ${article.slug}`).toBe(200);
    }
  });
});

test.describe('404 fallback', () => {

  test('404.html contains redirect logic', async ({ request }) => {
    // Python http.server doesn't serve 404.html for missing paths,
    // but we can verify 404.html itself has the right redirect logic
    const response = await request.get('/404.html');
    expect(response.status()).toBe(200);
    const html = await response.text();

    // Blog path redirect
    expect(html).toContain("match(/^\\/blog\\/([^/]+)\\/?$/)");
    expect(html).toContain("window.location.replace('/#read/'");

    // Non-blog path redirect to home
    expect(html).toContain("window.location.replace('/')");
  });
});
