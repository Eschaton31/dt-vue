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
