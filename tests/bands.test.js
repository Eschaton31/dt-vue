import { describe, expect, it } from 'vitest'

import { DEFAULT_HEATMAP_SCALE, bands, heatmap } from '../src/lib/heatmap.js'

// DV1's graded bands: far behind | behind | near target | met, two shades each.
const CUTS = [50, 80, 95]
const SHADES = [
  ['#9B272C', '#D03E45'],
  ['#F6B321', '#FED78B'],
  ['#C3F6C5', '#77D585'],
  ['#26873F', '#054A1F'],
]
const LABELS = ['Far behind', 'Behind', 'Near target', 'Met']

const graded = () => bands({ cuts: CUTS, shades: SHADES, labels: LABELS })

describe('bands()', () => {
  it('shades the lower half of a band with its first shade and the upper half with its second', () => {
    const style = graded()

    expect(style(0).backgroundColor).toBe('#9B272C')
    expect(style(24.9).backgroundColor).toBe('#9B272C')
    expect(style(49.9).backgroundColor).toBe('#D03E45')
    expect(style(50).backgroundColor).toBe('#F6B321')
    expect(style(64).backgroundColor).toBe('#F6B321')
    expect(style(79).backgroundColor).toBe('#FED78B')
    expect(style(80).backgroundColor).toBe('#C3F6C5')
    expect(style(94).backgroundColor).toBe('#77D585')
  })

  it('gives the exact midpoint of a band to its upper shade', () => {
    // Band 0 is 0 to 50, so 25 is the midpoint; band 1 is 50 to 80, so 65.
    expect(graded()(25).backgroundColor).toBe('#D03E45')
    expect(graded()(65).backgroundColor).toBe('#FED78B')
  })

  it('takes a cut value into the band above it', () => {
    expect(graded().band(50).index).toBe(1)
    expect(graded().band(95).index).toBe(3)
  })

  it('clamps below min to the first shade and at or above max to the last', () => {
    const style = graded()

    expect(style(-20).backgroundColor).toBe('#9B272C')
    expect(style(100).backgroundColor).toBe('#054A1F')
    expect(style(250).backgroundColor).toBe('#054A1F')
    expect(style.band(-20).index).toBe(0)
    expect(style.band(250).index).toBe(3)
  })

  it('honours min and max', () => {
    const style = bands({ cuts: [5], shades: [['#9B272C', '#D03E45'], ['#26873F', '#054A1F']], min: 0, max: 10 })

    expect(style(2).backgroundColor).toBe('#9B272C')
    expect(style(4).backgroundColor).toBe('#D03E45')
    expect(style(7).backgroundColor).toBe('#26873F')
    expect(style(10).backgroundColor).toBe('#054A1F')
  })

  it('leaves blank and non-numeric values unstyled', () => {
    const style = graded()

    expect(style('')).toBeUndefined()
    expect(style(null)).toBeUndefined()
    expect(style(undefined)).toBeUndefined()
    expect(style('n/a')).toBeUndefined()
    expect(style.band('')).toBeNull()
    expect(style.band('n/a')).toBeNull()
  })

  it('accepts numeric strings, as cell values often are', () => {
    expect(graded()('92.4').backgroundColor).toBe('#77D585')
  })

  it('picks white on dark shades and ink on light ones', () => {
    const style = graded()

    expect(style(10).color).toBe('#ffffff')
    expect(style(60).color).toBe('#111827')
    expect(style(85).color).toBe('#111827')
    expect(style(99).color).toBe('#ffffff')
  })

  it('uses the ink and light it is given', () => {
    const style = bands({
      cuts: [50],
      shades: [['#9B272C', '#D03E45'], ['#C3F6C5', '#77D585']],
      ink: 'rgb(0, 0, 0)',
      light: '#fafafa',
    })

    expect(style(10).color).toBe('#fafafa')
    expect(style(90).color).toBe('rgb(0, 0, 0)')
  })

  it('gives the light colour a tie', () => {
    // Ink and light are the same colour spelled two ways, so their contrast is exactly equal.
    const style = bands({ cuts: [], shades: [['#777777', '#777777']], ink: 'rgb(255, 255, 255)', light: '#ffffff' })

    expect(style(10).color).toBe('#ffffff')
  })

  it('accepts rgb(r, g, b) and three-digit shades', () => {
    const style = bands({ cuts: [50], shades: [['rgb(10, 20, 30)', '#abc'], ['#000', 'rgb( 255 , 255 , 255 )']] })

    expect(style(10).backgroundColor).toBe('rgb(10, 20, 30)')
    expect(style(40).backgroundColor).toBe('#abc')
  })

  describe('.band()', () => {
    it('returns the band index, label, shade and text colour', () => {
      expect(graded().band(72)).toEqual({ index: 1, label: 'Behind', background: '#FED78B', color: '#111827' })
      expect(graded().band(10)).toEqual({ index: 0, label: 'Far behind', background: '#9B272C', color: '#ffffff' })
    })

    it('gives a null label when there is none', () => {
      expect(bands({ cuts: [50], shades: [['#9B272C', '#D03E45'], ['#26873F', '#054A1F']] }).band(70).label).toBeNull()
    })
  })

  describe('validation', () => {
    const pair = ['#9B272C', '#D03E45']

    it('throws when shades do not number one more than cuts', () => {
      expect(() => bands({ cuts: [50], shades: [pair] })).toThrow(TypeError)
      expect(() => bands({ cuts: [50], shades: [pair, pair, pair] })).toThrow(/shades/)
    })

    it('throws when a band does not have exactly two shades', () => {
      expect(() => bands({ cuts: [50], shades: [['#9B272C'], pair] })).toThrow(/two shades/)
      expect(() => bands({ cuts: [50], shades: [pair, [...pair, '#000000']] })).toThrow(TypeError)
      expect(() => bands({ cuts: [50], shades: ['#9B272C', pair] })).toThrow(TypeError)
    })

    it('throws when cuts are not strictly ascending, equal cuts included', () => {
      expect(() => bands({ cuts: [80, 50], shades: [pair, pair, pair] })).toThrow(/ascending/)
      expect(() => bands({ cuts: [50, 50], shades: [pair, pair, pair] })).toThrow(/ascending/)
    })

    it('throws when a shade is not a colour the helper can read', () => {
      expect(() => bands({ cuts: [50], shades: [['teal', '#D03E45'], pair] })).toThrow(/shade/)
      expect(() => bands({ cuts: [50], shades: [['#12345', '#D03E45'], pair] })).toThrow(TypeError)
      expect(() => bands({ cuts: [50], shades: [['rgb(1, 2)', '#D03E45'], pair] })).toThrow(TypeError)
      expect(() => bands({ cuts: [50], shades: [['rgb(300, 2, 3)', '#D03E45'], pair] })).toThrow(TypeError)
    })

    it('validates ink and light too', () => {
      expect(() => bands({ cuts: [50], shades: [pair, pair], ink: 'black' })).toThrow(/ink/)
      expect(() => bands({ cuts: [50], shades: [pair, pair], light: 'white' })).toThrow(/light/)
    })

    it('does not put a colour in its error messages', () => {
      let message = ''

      try {
        bands({ cuts: [50], shades: [['nope', 'nope'], pair] })
      } catch (error) {
        message = error.message
      }

      expect(message).not.toMatch(/#[0-9a-fA-F]{3}\b/)
      expect(message).not.toMatch(/rgba?\(\s*\d/)
    })

    it('allows a cut outside min and max, with clamping taking precedence', () => {
      // S6b passes cuts [50, 80, target], and a target can exceed max.
      const style = bands({ cuts: [50, 80, 120], shades: [pair, pair, pair, ['#26873F', '#054A1F']] })

      expect(() => style(10)).not.toThrow()
      expect(style.band(90).index).toBe(2)
      expect(style.band(100).index).toBe(3)
      expect(style(100).backgroundColor).toBe('#054A1F')
      expect(style(-5).backgroundColor).toBe('#9B272C')
    })
  })
})

describe('heatmap() is unchanged', () => {
  it('still exports the ten-step scale and shades by position', () => {
    expect(DEFAULT_HEATMAP_SCALE).toHaveLength(10)
    expect(DEFAULT_HEATMAP_SCALE[0]).toBe('rgb(239, 161, 170)')
    expect(DEFAULT_HEATMAP_SCALE[9]).toBe('rgb(176, 236, 162)')
    expect(heatmap()(0)).toEqual({ backgroundColor: DEFAULT_HEATMAP_SCALE[0] })
    expect(heatmap()(100)).toEqual({ backgroundColor: DEFAULT_HEATMAP_SCALE[9] })
    expect(heatmap({ property: 'color' })(50)).toHaveProperty('color')
  })
})
