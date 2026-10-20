/*
|--------------------------------------------------------------------------
| Value formatting
|--------------------------------------------------------------------------
|
| Built on Intl so the package carries no date library. Everything is
| locale-driven: pass `locale` / `dateFormat` / `numberFormat` to DtTable
| to control it, or leave them unset to follow the runtime's locale.
|
*/

/** Column types that hold a date. */
export const DATE_TYPES = ['date', 'minDate', 'maxDate']

/** Column types that hold a number. */
export const NUMERIC_TYPES = ['number', 'percent']

export const DEFAULT_DATE_FORMAT = {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
}

/**
 * @param {unknown} value
 * @return {boolean}
 */
export function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime())
}

/**
 * Coerce a cell value to a Date, or null when it is blank or unparseable.
 *
 * @param {unknown} value
 * @return {Date | null}
 */
export function toDate(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const date = value instanceof Date ? value : new Date(value)

  return isValidDate(date) ? date : null
}

/**
 * Coerce a cell value to a finite number, or null.
 *
 * @param {unknown} value
 * @return {number | null}
 */
export function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const number = Number(value)

  return Number.isFinite(number) ? number : null
}

/**
 * Build a formatter bound to one table's locale options.
 *
 * Intl instances are comparatively expensive to construct, so they are
 * created once here and reused for every cell.
 *
 * @param {{ locale?: string, dateFormat?: object | Function, numberFormat?: object }} options
 * @return {(value: unknown, type?: string, decimals?: number | null) => string}
 */
export function createFormatter({ locale, dateFormat, numberFormat } = {}) {
  const numberFormatter = new Intl.NumberFormat(locale, numberFormat ?? {})

  const dateFormatter = typeof dateFormat === 'function' ? null : new Intl.DateTimeFormat(locale, dateFormat ?? DEFAULT_DATE_FORMAT)

  const formatDate = (date) => (dateFormatter ? dateFormatter.format(date) : dateFormat(date))

  // Percentages keep their own formatter so `decimals` can vary per column.
  const percentFormatters = new Map()

  const percentFormatter = (decimals) => {
    const digits = decimals ?? 2

    if (!percentFormatters.has(digits)) {
      percentFormatters.set(
        digits,
        new Intl.NumberFormat(locale, {
          minimumFractionDigits: digits,
          maximumFractionDigits: digits,
        })
      )
    }

    return percentFormatters.get(digits)
  }

  return function formatValue(value, type = 'string', decimals = null) {
    if (type === 'number') {
      const number = toNumber(value)

      return number === null ? '' : numberFormatter.format(number)
    }

    if (type === 'percent') {
      const number = toNumber(value)

      return number === null ? '' : `${percentFormatter(decimals).format(number)}%`
    }

    if (DATE_TYPES.includes(type)) {
      const date = toDate(value)

      return date === null ? '' : formatDate(date)
    }

    return value ?? ''
  }
}
