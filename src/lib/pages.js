/**
 * The page numbers a numbered pager shows.
 *
 * Seven pages or fewer show every number. Otherwise the window holds the first
 * and last page and the current page plus one either side, widened at the edges
 * so the first three (or last three) pages always show when the current page is
 * among them. A gap of exactly one page shows that page's number; a longer gap
 * becomes the string 'gap', which the pager draws as a non-interactive ellipsis.
 *
 *   pageWindow(0, 25)  // [0, 1, 2, 'gap', 24]
 *   pageWindow(9, 25)  // [0, 'gap', 8, 9, 10, 'gap', 24]
 *
 * @param {number} current 0-based current page
 * @param {number} total number of pages
 * @return {(number | 'gap')[]} 0-based page indexes and 'gap'
 */
export function pageWindow(current, total) {
  if (total <= 0) {
    return []
  }

  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index)
  }

  const shown = new Set([0, total - 1, current - 1, current, current + 1])

  if (current <= 2) {
    ;[0, 1, 2].forEach((page) => shown.add(page))
  }

  if (current >= total - 3) {
    ;[total - 3, total - 2, total - 1].forEach((page) => shown.add(page))
  }

  const pages = [...shown].filter((page) => page >= 0 && page < total).sort((a, b) => a - b)

  const result = []

  pages.forEach((page, index) => {
    const previous = pages[index - 1]

    if (previous !== undefined) {
      const missing = page - previous - 1

      if (missing === 1) {
        result.push(previous + 1)
      } else if (missing > 1) {
        result.push('gap')
      }
    }

    result.push(page)
  })

  return result
}
