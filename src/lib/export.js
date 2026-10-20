import { DATE_TYPES, NUMERIC_TYPES, toDate, toNumber } from './format.js'

/** Characters Windows and macOS reject in a file name. */
const UNSAFE_FILENAME = /[/\\?%*:|"<>]/g

/**
 * @param {string} name
 * @return {string}
 */
export function filenameSafe(name) {
  return String(name || 'Data').replace(UNSAFE_FILENAME, '-')
}

/**
 * Walk a row model depth-first so nested rows land directly under their parent,
 * matching the order they appear in the table.
 *
 * Grouping rows are skipped but still descended into: a grouped table exports
 * its real rows in group order, rather than rows of aggregates.
 *
 * @param {object[]} rows
 * @return {object[]}
 */
export function flattenRows(rows) {
  const result = []

  const walk = (list) => {
    for (const row of list ?? []) {
      if (!row.getIsGrouped?.()) {
        result.push(row)
      }

      if (row.subRows?.length) {
        walk(row.subRows)
      }
    }
  }

  walk(rows)

  return result
}

/**
 * Value written into the sheet.
 *
 * Numbers and dates are written as real numbers and dates so Excel can sort,
 * total and reformat them; everything else goes in as display text.
 *
 * @return {string | number | Date | null}
 */
function cellValue(row, column, formatValue) {
  const raw = row.getValue(column.id)
  const { type, decimals } = column.columnDef.meta ?? {}

  if (NUMERIC_TYPES.includes(type)) {
    return toNumber(raw)
  }

  if (DATE_TYPES.includes(type)) {
    return toDate(raw)
  }

  const formatted = formatValue(raw, type, decimals)

  return formatted === '' ? null : String(formatted)
}

/**
 * Write the table's current rows to an .xlsx file.
 *
 * `xlsx` is an optional peer dependency and is imported on demand, so apps
 * that never export do not pay for it in their bundle.
 *
 * @param {{ rows: object[], columns: object[], filename: string, sheetName?: string, formatValue: Function }} options
 * @return {Promise<void>}
 */
export async function exportRowsToXlsx({ rows, columns, filename, sheetName = 'Data', formatValue }) {
  let XLSX

  try {
    XLSX = await import('xlsx')
  } catch {
    throw new Error(
      'dt-vue: Excel export needs the optional "xlsx" peer dependency. Install it with `npm i xlsx`, or hide the export button.'
    )
  }

  const header = columns.map((column) => column.columnDef.meta?.header ?? column.id)

  const body = rows.map((row) => columns.map((column) => cellValue(row, column, formatValue)))

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...body], { cellDates: true })

  const workbook = XLSX.utils.book_new()

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

  XLSX.writeFile(workbook, `${filenameSafe(filename)}.xlsx`, { cellDates: true })
}
