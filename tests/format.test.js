import { describe, expect, it } from 'vitest'

import { createFormatter, toDate, toNumber } from '../src/lib/format.js'
import { DEFAULT_HEATMAP_SCALE, heatmap } from '../src/lib/heatmap.js'

describe('coercion', () => {
  it('treats blanks as absent', () => {
    expect(toNumber('')).toBeNull()
    expect(toNumber(null)).toBeNull()
    expect(toNumber('abc')).toBeNull()
    expect(toDate('')).toBeNull()
    expect(toDate('not a date')).toBeNull()
  })

  it('accepts zero and the epoch', () => {
    expect(toNumber(0)).toBe(0)
    expect(toDate(0)).toBeInstanceOf(Date)
  })
})

describe('createFormatter', () => {
  const format = createFormatter({ locale: 'en-US' })

  it('groups numbers', () => {
    expect(format(1234567, 'number')).toBe('1,234,567')
  })

  it('renders percentages with two fraction digits by default', () => {
    expect(format(92.4, 'percent')).toBe('92.40%')
    expect(format(92.4, 'percent', 0)).toBe('92%')
  })

  it('renders a medium date', () => {
    expect(format('2026-01-05T00:00:00Z', 'date')).toBe('Jan 5, 2026')
  })

  it('returns an empty string for blanks', () => {
    expect(format(null, 'number')).toBe('')
    expect(format('', 'date')).toBe('')
    expect(format(undefined, 'percent')).toBe('')
  })

  it('passes non-typed values straight through', () => {
    expect(format('Alpha', 'category')).toBe('Alpha')
  })

  it('honours a different locale', () => {
    expect(createFormatter({ locale: 'de-DE' })(1234.5, 'number')).toBe('1.234,5')
  })

  it('accepts Intl date options', () => {
    const formatted = createFormatter({
      locale: 'en-US',
      dateFormat: { year: 'numeric', month: '2-digit', day: '2-digit' },
    })('2026-01-05T00:00:00Z', 'date')

    expect(formatted).toBe('01/05/2026')
  })

  it('accepts a custom date function', () => {
    const formatted = createFormatter({
      dateFormat: (date) => `day ${date.getUTCDate()}`,
    })('2026-01-05T00:00:00Z', 'date')

    expect(formatted).toBe('day 5')
  })

  it('applies number format options', () => {
    const formatted = createFormatter({
      locale: 'en-US',
      numberFormat: { minimumFractionDigits: 2 },
    })(5, 'number')

    expect(formatted).toBe('5.00')
  })
})

describe('heatmap', () => {
  const shade = heatmap()

  it('maps the range onto the scale', () => {
    expect(shade(0)).toEqual({ backgroundColor: DEFAULT_HEATMAP_SCALE[0] })
    expect(shade(100)).toEqual({ backgroundColor: DEFAULT_HEATMAP_SCALE.at(-1) })
  })

  it('clamps values outside the range', () => {
    expect(shade(-50)).toEqual({ backgroundColor: DEFAULT_HEATMAP_SCALE[0] })
    expect(shade(500)).toEqual({ backgroundColor: DEFAULT_HEATMAP_SCALE.at(-1) })
  })

  it('leaves blanks unstyled', () => {
    expect(shade(null)).toBeUndefined()
    expect(shade('')).toBeUndefined()
  })

  it('accepts a custom range, scale and property', () => {
    const custom = heatmap({ colors: ['red', 'green'], min: 0, max: 10, property: 'color' })

    expect(custom(0)).toEqual({ color: 'red' })
    expect(custom(10)).toEqual({ color: 'green' })
  })
})
