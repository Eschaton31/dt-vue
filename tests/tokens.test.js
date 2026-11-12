// @vitest-environment node
/*
 * Guards for the 0.3.0 design contract: the token set, no raw colours or banned
 * utilities in components, the icon import rules, and that the README and the
 * playground still cover what the release added.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

const read = (path) => readFileSync(join(ROOT, path), 'utf8')

const listFiles = (dir) =>
  readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? listFiles(join(dir, entry.name)) : [join(dir, entry.name).replace(/\\/g, '/')]
  )

const SRC = listFiles('src')
const SRC_CODE = SRC.filter((path) => /\.(vue|js)$/.test(path))
const SRC_VUE = SRC.filter((path) => path.endsWith('.vue'))
const SRC_LIB_JS = SRC.filter((path) => path.startsWith('src/lib/') && path.endsWith('.js'))

/** Drop comments, so a doc example or a banned word in prose is not flagged. */
const stripComments = (text) =>
  text
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1')

/**
 * The two places a literal colour is allowed in a component or lib file:
 * heatmap()'s default scale, and the ink / light defaults of bands().
 */
const withoutColourExemptions = (text) =>
  text
    .replace(/export const DEFAULT_HEATMAP_SCALE = \[[\s\S]*?\]/, '')
    .replace(/ink = '#[0-9a-fA-F]+', light = '#[0-9a-fA-F]+'/, '')

const NEW_TOKENS = [
  '--dt-accent',
  '--dt-accent-strong',
  '--dt-focus-border',
  '--dt-focus-ring',
  '--dt-selected',
  '--dt-hover',
  '--dt-header-bg',
  '--dt-border',
  '--dt-radius',
  '--dt-shadow',
  '--dt-group-bg',
]

const REMOVED_TOKENS = ['--dt-action', '--dt-action-fg', '--dt-accent-fg', '--dt-accent-wash']

const NEW_LABELS = ['rowsPerPage', 'range', 'groupCount', 'emptyHint', 'emptySearch', 'total']

describe('tokens (criteria 1 and 2)', () => {
  const css = read('src/styles.css')

  const rootBlock = css.match(/:root\s*\{([\s\S]*?)\n\}/)[1]
  const declared = Object.fromEntries([...rootBlock.matchAll(/(--dt-[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]))

  it('declares exactly the eleven tokens on :root', () => {
    expect(Object.keys(declared).sort()).toEqual([...NEW_TOKENS].sort())
  })

  it('defaults them to neutral greys with no brand hue', () => {
    expect(declared).toEqual({
      '--dt-accent': '#374151',
      '--dt-accent-strong': '#111827',
      '--dt-focus-border': '#9ca3af',
      '--dt-focus-ring': 'rgb(156 163 175 / 0.25)',
      '--dt-selected': '#f3f4f6',
      '--dt-hover': '#f9fafb',
      '--dt-header-bg': '#f9fafb',
      '--dt-border': '#e5e7eb',
      '--dt-radius': '0.5rem',
      '--dt-shadow': '0 1px 2px 0 rgb(16 24 40 / 0.05)',
      '--dt-group-bg': '#f9fafb',
    })
  })

  it('has removed the old tokens from every file in src', () => {
    for (const path of SRC) {
      const text = read(path)

      for (const token of REMOVED_TOKENS) {
        expect(text.includes(token), `${path} still mentions ${token}`).toBe(false)
      }
    }
  })

  it('hides the native search cancel button on the toolbar search', () => {
    expect(css).toMatch(/\.dt-search::-webkit-search-cancel-button[^{]*\{[^}]*appearance:\s*none/)
  })

  it('defines the sweep keyframes and the progress line', () => {
    expect(css).toMatch(/@keyframes dt-sweep\s*\{/)
    expect(css).toMatch(/\.dt-progress\s*\{[^}]*height:\s*2px/)
    expect(css).toMatch(/animation:\s*dt-sweep\s+1\.6s/)
  })

  it('holds the line still, faint and full width, under reduced motion', () => {
    const block = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)[1]

    expect(block).toMatch(/animation:\s*none/)
    expect(block).toMatch(/width:\s*100%/)
    expect(block).toMatch(/opacity:\s*0\.35/)
  })
})

describe('no raw colours or banned utilities (criterion 3)', () => {
  const colourPatterns = [/#[0-9a-fA-F]{3}\b/, /#[0-9a-fA-F]{6}\b/, /rgba?\(\s*\d/]

  it.each([...SRC_VUE, ...SRC_LIB_JS])('%s holds no literal colour', (path) => {
    const code = withoutColourExemptions(stripComments(read(path)))

    for (const pattern of colourPatterns) {
      expect(code, `${path} matches ${pattern}`).not.toMatch(pattern)
    }
  })

  it('keeps the exemptions to the two named places', () => {
    const heatmap = read('src/lib/heatmap.js')

    expect(heatmap).toMatch(/export const DEFAULT_HEATMAP_SCALE = \[/)
    expect(heatmap).toMatch(/ink = '#[0-9a-fA-F]+', light = '#[0-9a-fA-F]+'/)

    // Once those are removed there is no colour left in the file, error messages included.
    expect(withoutColourExemptions(stripComments(heatmap))).not.toMatch(/#[0-9a-fA-F]{3}\b|rgba?\(\s*\d/)
  })

  it.each(SRC_CODE)('%s uses none of the retired utilities', (path) => {
    const code = stripComments(read(path))

    for (const banned of ['shadow-sm', 'shadow-md', 'hover:shadow', 'active:translate', 'transition-all', 'dark:']) {
      expect(code.includes(banned), `${path} contains ${banned}`).toBe(false)
    }
  })
})

describe('icon imports (criterion 4)', () => {
  it('uses named imports from the 16 or 20 solid sets only', () => {
    for (const path of SRC_CODE) {
      const code = stripComments(read(path))

      // Quotes cannot appear before `from`, so a match never runs into the next statement.
      for (const [statement, source] of code.matchAll(/^import\s+[^'";]*?from\s+'([^']+)'/gm)) {
        if (source.startsWith('@heroicons/vue')) {
          expect(statement, `${path}: ${statement}`).toMatch(
            /^import \{[^}]+\} from '@heroicons\/vue\/(16|20)\/solid'$/
          )
        }
      }

      expect(code, `${path} has a bare heroicons import`).not.toMatch(/^import\s+'@heroicons/m)
    }
  })

  it('imports at least one icon, so the guard is not vacuous', () => {
    expect(read('src/DtTable.vue')).toContain("@heroicons/vue/16/solid'")
    expect(read('src/DtTable.vue')).toContain("@heroicons/vue/20/solid'")
  })

  it('asks consumers for a heroicons release that has the 16px set', () => {
    expect(JSON.parse(read('package.json')).peerDependencies['@heroicons/vue']).toBe('^2.1.0')
  })
})

describe('release (criteria 28, 29 and 32)', () => {
  it('is version 0.3.0', () => {
    expect(JSON.parse(read('package.json')).version).toBe('0.3.0')
  })

  it('documents the new surface and the upgrade in the README', () => {
    const readme = read('README.md')

    for (const needle of [...NEW_TOKENS, ...NEW_LABELS, 'Upgrading from 0.2', 'bands(', 'cellTitle', 'density', 'pagination']) {
      expect(readme, `README is missing ${needle}`).toContain(needle)
    }

    for (const token of REMOVED_TOKENS) {
      expect(readme, `README should map ${token} to its replacement`).toContain(token)
    }
  })

  it('tells upgraders about the Tailwind 3.4 requirement and every removed label', () => {
    const readme = read('README.md')

    expect(readme).toMatch(/Tailwind 3\.4/)

    for (const label of ['firstPage', 'lastPage', 'results', 'unitRows', 'unitResults', 'noResults', 'pageSize']) {
      expect(readme, `README upgrade notes omit ${label}`).toContain(label)
    }
  })

  it('keeps the playground able to reach every visual-review state', () => {
    const playground = read('dev/App.vue')

    for (const needle of ['groupRowsBy', 'bands(', 'density', 'pagination', 'emptyHint', 'clearSearch', 'Theme']) {
      expect(playground, `dev/App.vue is missing ${needle}`).toContain(needle)
    }
  })
})
