/**
 * `npx tsx scripts/gen-chrome-theme.ts`
 *
 * Regenerates `src/lib/chromeTheme.generated.css` — the chrome neutrals
 * (`--app` / `--surface` / `--elevated` / `--line` / `--fg` / `--fg-muted`)
 * resolved from the Categorical projection of the default system.
 *
 * Same contract as the other `gen:*` scripts: the output is COMMITTED, and
 * `__tests__/chromeTheme.test.ts` asserts regenerating is a no-op.
 */

import { writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderChromeThemeCss } from '../src/lib/chromeTheme'
import { DEFAULT_ACCENT } from '../src/store/useDesignStore'

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../src/lib/chromeTheme.generated.css')
const css = renderChromeThemeCss(DEFAULT_ACCENT)
writeFileSync(out, css)
console.log(`wrote ${out}`)
