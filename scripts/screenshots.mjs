/**
 * Capture screenshots of every route at mobile + laptop widths for UI/UX review.
 * Uses the system Chrome via playwright-core (no bundled browser download).
 *
 * Run: node scripts/screenshots.mjs            (defaults to http://localhost:3000)
 *      BASE=http://localhost:3001 node scripts/screenshots.mjs
 */
import { chromium } from 'playwright-core'
import { mkdirSync } from 'node:fs'

const BASE = process.env.BASE || 'http://localhost:3000'
const OUT = '.screenshots'
const ROUTES = [
  ['root', '/'],
  ['today', '/today'],
  ['diet', '/diet'],
  ['timeline', '/timeline'],
  ['report', '/report'],
  ['imports', '/imports'],
  ['log', '/log'],
]
const VIEWPORTS = [
  ['mobile', 390, 844],
  ['laptop', 1440, 900],
]

mkdirSync(OUT, { recursive: true })

let browser
for (const channel of ['chrome', 'msedge', 'chromium']) {
  try {
    browser = await chromium.launch({ channel })
    console.log(`launched via channel: ${channel}`)
    break
  } catch {
    /* try next */
  }
}
if (!browser) {
  console.error('Could not launch a browser. Install Chrome, or run: npx playwright install chromium')
  process.exit(1)
}

try {
  for (const [vpName, w, h] of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 })
    const page = await ctx.newPage()
    for (const [name, route] of ROUTES) {
      try {
        await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 45000 })
      } catch {
        await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
      }
      await page.waitForTimeout(1200) // let client effects/animations settle
      const file = `${OUT}/${name}-${vpName}.png`
      await page.screenshot({ path: file, fullPage: true })
      console.log(`  ${file}`)
    }
    await ctx.close()
  }
} finally {
  await browser.close()
}
console.log('done')
