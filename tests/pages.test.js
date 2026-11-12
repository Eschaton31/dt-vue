import { describe, expect, it } from 'vitest'

import { pageWindow } from '../src/lib/pages.js'

// Labels as the pager draws them: 1-based numbers, with … for a gap.
const labels = (current, total) =>
  pageWindow(current - 1, total)
    .map((page) => (page === 'gap' ? '…' : page + 1))
    .join(' ')

describe('pageWindow', () => {
  it('returns nothing without pages', () => {
    expect(pageWindow(0, 0)).toEqual([])
  })

  it('shows the one page', () => {
    expect(pageWindow(0, 1)).toEqual([0])
  })

  it('shows every number for seven pages or fewer', () => {
    expect(pageWindow(3, 7)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(pageWindow(0, 2)).toEqual([0, 1])
  })

  it('starts windowing at eight pages', () => {
    expect(labels(1, 8)).toBe('1 2 3 … 8')
    expect(labels(5, 8)).toBe('1 … 4 5 6 7 8')
  })

  it('returns 0-based indexes and the string gap', () => {
    expect(pageWindow(0, 25)).toEqual([0, 1, 2, 'gap', 24])
  })

  it('draws the five 25-page windows from the spec', () => {
    expect(labels(1, 25)).toBe('1 2 3 … 25')
    expect(labels(3, 25)).toBe('1 2 3 4 … 25')
    expect(labels(4, 25)).toBe('1 2 3 4 5 … 25')
    expect(labels(10, 25)).toBe('1 … 9 10 11 … 25')
    expect(labels(25, 25)).toBe('1 … 23 24 25')
  })

  it('keeps the last three pages when the current page is among them', () => {
    expect(labels(23, 25)).toBe('1 … 22 23 24 25')
    expect(labels(24, 25)).toBe('1 … 23 24 25')
  })

  it('shows the number for a gap of exactly one page, and … for longer ones', () => {
    // Page 4: page 2 would be the single hidden page between 1 and 3.
    expect(pageWindow(3, 25)).toEqual([0, 1, 2, 3, 4, 'gap', 24])
    // Page 22 of 25: page 23 is the single hidden page before 24.
    expect(labels(22, 25)).toBe('1 … 21 22 23 24 25')
    // Page 9 of 25: pages 2 to 7 are hidden, so a gap.
    expect(pageWindow(8, 25)).toEqual([0, 'gap', 7, 8, 9, 'gap', 24])
  })

  it('never repeats or skips a page, whatever the position', () => {
    for (const total of [8, 9, 12, 25, 100]) {
      for (let current = 0; current < total; current += 1) {
        const pages = pageWindow(current, total)
        const numbers = pages.filter((page) => page !== 'gap')

        expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
        expect(new Set(numbers).size).toBe(numbers.length)
        expect(numbers).toContain(current)
        expect(numbers[0]).toBe(0)
        expect(numbers.at(-1)).toBe(total - 1)
        expect(pages.every((page, index) => page !== 'gap' || (typeof pages[index - 1] === 'number' && typeof pages[index + 1] === 'number'))).toBe(true)
      }
    }
  })
})
