/**
 * Browser smoke test against a running server (npm run build && npm start, seeded database, MFA_ENFORCEMENT=optional).
 *   E2E_BASE_URL=http://localhost:3100 E2E_ADMIN_EMAIL=… E2E_ADMIN_PASSWORD=… npm run test:e2e
 * Demo users (SEED_DEMO_USERS=true) are used for the partner-isolation checks.
 */
import { chromium, type Page } from 'playwright'

try { process.loadEnvFile() } catch { /* optional */ }
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3100'
const ADMIN = { email: process.env.E2E_ADMIN_EMAIL ?? process.env.SEED_ADMIN_EMAIL ?? '', password: process.env.E2E_ADMIN_PASSWORD ?? process.env.SEED_ADMIN_PASSWORD ?? '' }
const PARTNER = { email: 'brand-partner@demo.sii.local', password: 'DemoUser!2026-local' }
const SHOTS = process.env.E2E_SCREENSHOT_DIR

const PAGES = ['/', '/ingredients', '/ingredients?fn=humectant', '/search?q=shea', '/search?q=glycerine', '/graph', '/formulas', '/products', '/raw-materials', '/suppliers', '/evidence', '/patents', '/research-candidates', '/imports', '/review', '/review?tab=quarantine', '/review?tab=identity', '/sources', '/integrations', '/settings', '/organizations', '/completion', '/audit', '/api-docs']
const ERROR_TEXT = /Application error|Something went wrong|Unhandled Runtime Error|Internal Server Error/i

const failures: string[] = []
const check = (ok: boolean, msg: string) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failures.push(msg) }

async function login(page: Page, who: { email: string; password: string }) {
  await page.goto(`${BASE}/login`)
  await page.fill('input[name=email]', who.email)
  await page.fill('input[name=password]', who.password)
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 15000 }), page.click('button[type=submit]')])
}

async function visit(page: Page, path: string) {
  const res = await page.goto(`${BASE}${path}`)
  const body = await page.textContent('body') ?? ''
  check(!!res && res.status() < 400 && !ERROR_TEXT.test(body), `${path} → ${res?.status()}`)
  return body
}

async function main() {
  if (!ADMIN.email || !ADMIN.password) throw new Error('Set E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD (or SEED_ADMIN_*).')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    const consoleErrors: string[] = []
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(`${page.url()}: ${m.text()}`) })

    // Unauthenticated access redirects to login.
    await page.goto(`${BASE}/ingredients`)
    check(page.url().includes('/login'), 'unauthenticated /ingredients redirects to /login')

    // Wrong password gives a generic error.
    await page.fill('input[name=email]', ADMIN.email)
    await page.fill('input[name=password]', 'wrong-password-123')
    await page.click('button[type=submit]')
    await page.waitForTimeout(800)
    check(/invalid|incorrect/i.test(await page.textContent('body') ?? ''), 'wrong password shows a generic error')

    await login(page, ADMIN)
    check(!page.url().includes('/login'), `admin signed in (landed on ${new URL(page.url()).pathname})`)
    for (const p of PAGES) await visit(page, p)

    // Ingredient detail + every tab renders.
    await page.goto(`${BASE}/ingredients?q=glycerin`)
    const href = await page.getAttribute('a[href^="/ingredients/"]:not([href="/ingredients/new"])', 'href')
    check(!!href, 'ingredient list links to a detail page')
    if (href) {
      const body = await visit(page, href)
      check(/Completeness/i.test(body), 'ingredient detail shows completeness')
      for (const tab of ['identity', 'properties', 'functions', 'concentrations', 'compatibility', 'safety', 'regulatory', 'evidence', 'patents', 'suppliers', 'products', 'formulas', 'phenotypes', 'outcomes', 'graph', 'history']) await visit(page, `${href}?tab=${tab}`)
    }
    // A product detail and a formula detail.
    for (const list of ['/products', '/formulas', '/evidence', '/patents', '/sources']) {
      await page.goto(`${BASE}${list}`)
      const first = await page.getAttribute(`main a[href^="${list}/"]:not([href="${list}/new"])`, 'href')
      check(!!first, `${list} has at least one record`)
      if (first) await visit(page, first)
    }
    const dash = await visit(page, '/')
    check(/Phase 1|completion/i.test(dash), 'dashboard references Phase 1 completion status')
    check(!/Proven to work|Safe to manufacture|globally approved/i.test(dash), 'dashboard contains no prohibited claims wording')
    if (SHOTS) {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(`${BASE}/`); await page.screenshot({ path: `${SHOTS}/dashboard.png`, fullPage: true })
      if (href) { await page.goto(`${BASE}${href}`); await page.getByText('Completeness').first().waitFor(); await page.screenshot({ path: `${SHOTS}/ingredient.png`, fullPage: true }) }
      await page.goto(`${BASE}/completion`); await page.waitForLoadState('networkidle'); await page.screenshot({ path: `${SHOTS}/completion.png`, fullPage: true })
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(`${BASE}/ingredients`); await page.waitForLoadState('networkidle'); await page.screenshot({ path: `${SHOTS}/ingredients-mobile.png`, fullPage: false })
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
      check(!overflow, 'no horizontal page scroll at 390px')
    }
    await Promise.all([page.waitForURL(/\/login/, { timeout: 15000 }), page.click('form[action="/logout"] button')])
    check(page.url().includes('/login'), 'sign out (POST /logout) returns to /login')
    await page.goto(`${BASE}/ingredients`)
    check(page.url().includes('/login'), 'session is revoked after sign out')
    check(consoleErrors.length === 0, `no browser console errors${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(' | ')}` : ''}`)

    // Partner isolation: a brand partner cannot see Supernatural's restricted formulas, the audit log or IP.
    const p2 = await browser.newPage()
    await login(p2, PARTNER)
    const formulas = await (await p2.goto(`${BASE}/formulas`), p2.textContent('main')) ?? ''
    check(!/SAMPLE-|Sample formula/i.test(formulas), 'partner sees no Supernatural sample formulas')
    await p2.goto(`${BASE}/settings?tab=users`)
    check(!/Users & roles/.test(await p2.textContent('main') ?? ''), 'partner has no user-administration tab')
    for (const path of ['/audit', '/research-candidates', '/review']) {
      await p2.goto(`${BASE}${path}`)
      check(/have access to this/i.test(await p2.textContent('main') ?? ''), `partner is denied ${path}`)
    }
  } finally {
    await browser.close()
  }
  console.log(failures.length ? `\n${failures.length} check(s) failed.` : '\nAll smoke checks passed.')
  process.exit(failures.length ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
