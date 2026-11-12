import { toNumber } from './format.js'

/**
 * Red through amber to green, in ten steps. Suitable for a 0-100 percentage.
 */
export const DEFAULT_HEATMAP_SCALE = [
  'rgb(239, 161, 170)',
  'rgb(238, 172, 162)',
  'rgb(237, 181, 162)',
  'rgb(236, 189, 163)',
  'rgb(236, 198, 164)',
  'rgb(235, 206, 164)',
  'rgb(253, 230, 142)',
  'rgb(235, 247, 149)',
  'rgb(201, 242, 156)',
  'rgb(176, 236, 162)',
]

/**
 * Build a `cell-style` function that shades a cell by where its value falls
 * between `min` and `max`.
 *
 *   <DtColumn field="rate" type="percent" :cell-style="heatmap()" />
 *   <DtColumn field="load" type="number" :cell-style="heatmap({ max: 50, colors: [...] })" />
 *
 * Values outside the range clamp to the end colours; blanks are left unstyled.
 *
 * @param {{ colors?: string[], min?: number, max?: number, property?: string }} options
 * @return {(value: unknown) => Record<string, string> | undefined}
 */
export function heatmap({ colors = DEFAULT_HEATMAP_SCALE, min = 0, max = 100, property = 'backgroundColor' } = {}) {
  return (value) => {
    const number = toNumber(value)

    if (number === null || colors.length === 0 || max === min) {
      return undefined
    }

    const ratio = (number - min) / (max - min)
    const index = Math.min(Math.max(Math.round(ratio * (colors.length - 1)), 0), colors.length - 1)

    return { [property]: colors[index] }
  }
}

/*
|--------------------------------------------------------------------------
| Graded bands
|--------------------------------------------------------------------------
*/

/**
 * Read `#rgb`, `#rrggbb` or `rgb(r, g, b)` into [r, g, b], or null.
 *
 * @param {unknown} value
 * @return {[number, number, number] | null}
 */
function parseColor(value) {
  if (typeof value !== 'string') {
    return null
  }

  const text = value.trim()

  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text)

  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1]

    return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16))
  }

  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(text)

  if (rgb) {
    const channels = [rgb[1], rgb[2], rgb[3]].map(Number)

    return channels.every((channel) => channel <= 255) ? channels : null
  }

  return null
}

/**
 * WCAG 2.x relative luminance.
 *
 * @param {[number, number, number]} rgb
 * @return {number}
 */
function relativeLuminance([red, green, blue]) {
  const [r, g, b] = [red, green, blue].map((channel) => {
    const value = channel / 255

    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * WCAG 2.x contrast ratio between two colours.
 *
 * @param {[number, number, number]} a
 * @param {[number, number, number]} b
 * @return {number}
 */
function contrastRatio(a, b) {
  const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * @param {unknown} value
 * @param {string} name what the colour is, for the error message
 * @return {[number, number, number]}
 */
function requireColor(value, name) {
  const rgb = parseColor(value)

  if (!rgb) {
    throw new TypeError(
      `dt-vue bands(): ${name} must be a hex colour of three or six digits, or rgb(r, g, b); got ${JSON.stringify(value)}.`
    )
  }

  return rgb
}

/**
 * Build a `cell-style` function that shades a cell by graded bands, two shades
 * per band, and picks readable text for each shade.
 *
 *   const rate = bands({
 *     cuts: [50, 80, 95],
 *     shades: [[dark, light], [dark, light], [dark, light], [dark, light]],
 *     labels: ['Far behind', 'Behind', 'Near target', 'Met'],
 *   })
 *
 *   <DtColumn field="rate" type="percent" :cell-style="rate" />
 *   rate.band(72) // { index: 1, label: 'Behind', background, color }
 *
 * Band `i` covers `[cuts[i - 1] ?? min, cuts[i] ?? max)`. The lower half of a
 * band takes `shades[i][0]`, the upper half `shades[i][1]` (the exact midpoint
 * takes the upper). Values below `min` take the first shade and values at or
 * above `max` the last one. `color` is `light` or `ink`, whichever reads better
 * on the shade (`light` wins a tie). Blank and non-numeric values are unstyled.
 *
 * @param {{ cuts: number[], shades: string[][], labels?: string[], min?: number, max?: number, ink?: string, light?: string }} options
 * @return {((value: unknown) => { backgroundColor: string, color: string } | undefined) & { band: (value: unknown) => { index: number, label: string | null, background: string, color: string } | null }}
 */
export function bands({ cuts, shades, labels = [], min = 0, max = 100, ink = '#111827', light = '#ffffff' } = {}) {
  if (!Array.isArray(cuts) || !Array.isArray(shades)) {
    throw new TypeError('dt-vue bands(): cuts and shades must both be arrays.')
  }

  if (shades.length !== cuts.length + 1) {
    throw new TypeError(
      `dt-vue bands(): ${cuts.length} cuts make ${cuts.length + 1} bands, so shades needs ${cuts.length + 1} entries; got ${shades.length}.`
    )
  }

  shades.forEach((pair, index) => {
    if (!Array.isArray(pair) || pair.length !== 2) {
      throw new TypeError(`dt-vue bands(): band ${index} needs exactly two shades, a lower-half one and an upper-half one.`)
    }
  })

  cuts.forEach((cut, index) => {
    if (typeof cut !== 'number' || Number.isNaN(cut)) {
      throw new TypeError(`dt-vue bands(): cut ${index} is not a number.`)
    }

    if (index > 0 && cut <= cuts[index - 1]) {
      throw new TypeError(`dt-vue bands(): cuts must be strictly ascending; cut ${index} does not rise above cut ${index - 1}.`)
    }
  })

  const inkRgb = requireColor(ink, 'ink')
  const lightRgb = requireColor(light, 'light')

  // Readable text per shade, worked out once.
  const textFor = shades.map((pair, index) =>
    pair.map((shade) => {
      const rgb = requireColor(shade, `shade in band ${index}`)

      return contrastRatio(lightRgb, rgb) >= contrastRatio(inkRgb, rgb) ? light : ink
    })
  )

  const lookup = (value) => {
    const number = toNumber(value)

    if (number === null) {
      return null
    }

    let index
    let half

    if (number < min) {
      index = 0
      half = 0
    } else if (number >= max) {
      index = shades.length - 1
      half = 1
    } else {
      const found = cuts.findIndex((cut) => number < cut)

      index = found === -1 ? cuts.length : found

      const lower = cuts[index - 1] ?? min
      const upper = cuts[index] ?? max

      half = number < (lower + upper) / 2 ? 0 : 1
    }

    return { index, label: labels[index] ?? null, background: shades[index][half], color: textFor[index][half] }
  }

  const cellStyle = (value) => {
    const found = lookup(value)

    return found ? { backgroundColor: found.background, color: found.color } : undefined
  }

  cellStyle.band = lookup

  return cellStyle
}
