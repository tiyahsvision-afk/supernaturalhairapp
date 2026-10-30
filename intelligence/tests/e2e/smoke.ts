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

const PAGES = ['/', '/workbench', '/founder', '/reports', '/admin', '/products/compare', ...['SUBSTITUTES', 'FORMULATION', 'CLAIM', 'SUPPLIERS', 'COMPARISON', 'GENERAL'].map((w) => `/workbench/new?workflow=${w}`), '/ingredients?cls=cationic&free=silicone', '/ingredients', '/ingredients?fn=humectant', '/search?q=shea', '/search?q=glycerine', '/graph', '/formulas', '/products', '/raw-materials', '/suppliers', '/evidence', '/patents', '/research-candidates', '/imports', '/review', '/review?tab=quarantine', '/review?tab=identity', '/sources', '/integrations', '/settings', '/organizations', '/completion', '/audit', '/api-docs']
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
    check(/What do you need to find out/i.test(dash), 'home leads with research')
    const admin = await visit(page, '/admin')
    check(/Data operations/i.test(admin), 'admin dashboard holds data operations')

    // Workflow A end-to-end: pick an ingredient with the type-ahead, run, generate a report.
    await page.goto(`${BASE}/workbench/new?workflow=SUBSTITUTES`)
    await page.waitForLoadState('networkidle')
    await page.fill('input[aria-label="Ingredient to replace"]', 'behentrimonium chloride')
    await page.locator('[role="option"] button').first().click()
    await page.fill('textarea[name="reason"]', 'smoke test: milder alternative')
    await Promise.all([page.waitForURL(/\/workbench\/[0-9a-f-]{36}/, { timeout: 60000 }), page.click('button[type=submit]:has-text("Find substitutes")')])
    await page.getByText('Candidate overview').first().waitFor({ timeout: 60000 })
    const proj = await page.textContent('main') ?? ''
    check(/Candidate overview/.test(proj) && /Needs lab testing/.test(proj), 'substitution project shows candidates and testing needs')
    await Promise.all([page.waitForURL(/\/reports\/[0-9a-f-]{36}/, { timeout: 60000 }), page.click('button:has-text("Generate report")')])
    await page.getByText('Data verification status').first().waitFor({ timeout: 60000 })
    const rep = await page.textContent('main') ?? ''
    check(/Ingredient Substitution Research Report/.test(rep) && /Sources/.test(rep) && /Data verification status/.test(rep), 'report has type, sources and verification status')
    if (SHOTS) { await page.setViewportSize({ width: 1280, height: 900 }); await page.screenshot({ path: `${SHOTS}/report.png`, fullPage: true }) }

    // Workflow B with pasted lines
    await page.goto(`${BASE}/workbench/new?workflow=FORMULATION`)
    await page.waitForLoadState('networkidle')
    await page.fill('textarea[name="lines"]', 'Aqua q.s.\nSodium Laureth Sulfate 10\nBehentrimonium Chloride 2\nSodium Benzoate 0.5')
    await page.fill('input[name="ph"]', '6.5')
    await Promise.all([page.waitForURL(/\/workbench\/[0-9a-f-]{36}/, { timeout: 60000 }), page.click('button[type=submit]:has-text("Research this formulation")')])
    await page.getByText('Functional building blocks').first().waitFor({ timeout: 60000 })
    check(/Cationic and anionic/.test(await page.textContent('main') ?? ''), 'formulation research flags complexation')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/formulation.png`, fullPage: true })

    // Founder wizard: step through all ten questions
    await page.goto(`${BASE}/founder`)
    await page.waitForLoadState('networkidle')
    for (let i = 0; i < 9; i++) { await page.click('button:has-text("Next")'); await page.getByText(`Question ${i + 2} of 10`).waitFor() }
    await Promise.all([page.waitForURL(/\/workbench\/[0-9a-f-]{36}/, { timeout: 60000 }), page.click('button:has-text("Generate research brief")')])
    await page.getByText('Development roadmap').first().waitFor({ timeout: 60000 })
    const brief = await page.textContent('main') ?? ''
    check(/Functional building blocks/.test(brief) && /not a finished, safety-tested formulation/.test(brief), 'founder wizard produces a research brief with the disclaimer')

    // Compare via picker (two ingredients)
    await page.goto(`${BASE}/compare`)
    await page.waitForLoadState('networkidle')
    for (const q of ['glycerin', 'panthenol']) { await page.fill('input[aria-label^="Ingredients to compare"]', q); await page.locator('[role="option"] button').first().click() }
    await Promise.all([page.waitForURL(/\/workbench\/[0-9a-f-]{36}/, { timeout: 60000 }), page.click('button[type=submit]:has-text("Compare")')])
    await page.getByText('Side-by-side').first().waitFor({ timeout: 60000 })
    check(/Side-by-side/.test(await page.textContent('main') ?? ''), 'comparison renders side-by-side table')
    if (SHOTS) await page.screenshot({ path: `${SHOTS}/compare.png`, fullPage: true })
    check(!/Proven to work|Safe to manufacture|globally approved/i.test(dash), 'dashboard contains no prohibited claims wording')
    if (SHOTS) {
      await page.setViewportSize({ width: 1280, height: 900 })
      await page.goto(`${BASE}/`); await page.waitForLoadState('networkidle'); await page.screenshot({ path: `${SHOTS}/dashboard.png`, fullPage: true })
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
