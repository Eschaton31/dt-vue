/*
 * Compile-time assertions. `vue-tsc --noEmit` failing here means the public
 * types drifted; every @ts-expect-error below must stay an error.
 */
import DtVue, { DEFAULT_HEATMAP_SCALE, bands, createFormatter, heatmap } from 'dt-vue'
import type {
  BandsOptions,
  DtBand,
  DtBandsCellStyle,
  DtCellStyle,
  DtCellTitle,
  DtColumnProps,
  DtColumnType,
  DtLabels,
  DtTableEmptySlotProps,
  DtTableProps,
  DtVuePluginOptions,
} from 'dt-vue'

/* ---------------------------------------------------------------- heatmap */

const shade: DtCellStyle = heatmap()
const shaded: Record<string, string> | undefined = shade(50, {})

heatmap({ colors: ['red', 'green'], min: 0, max: 10, property: 'color' })

// @ts-expect-error min must be a number
heatmap({ min: 'low' })

// @ts-expect-error unknown option
heatmap({ colours: ['red'] })

const scale: string[] = DEFAULT_HEATMAP_SCALE

/* ------------------------------------------------------------------ bands */

const rate: DtBandsCellStyle = bands({
  cuts: [50, 80, 95],
  shades: [
    ['#9B272C', '#D03E45'],
    ['#F6B321', '#FED78B'],
    ['#C3F6C5', '#77D585'],
    ['#26873F', '#054A1F'],
  ],
  labels: ['Far behind', 'Behind', 'Near target', 'Met'],
})

const bandStyle: { backgroundColor: string; color: string } | undefined = rate(72)
const found: DtBand | null = rate.band(50)
const bandLabel: string | null | undefined = rate.band(50)?.label
const bandIndex: number | undefined = rate.band(50)?.index

// A bands() function is a cellStyle.
const asCellStyle: DtCellStyle = rate

const bandOptions: BandsOptions = { cuts: [], shades: [['#000', '#fff']], min: 0, max: 10, ink: '#111', light: '#fff' }

// @ts-expect-error cuts are numbers
bands({ cuts: ['50'], shades: [['#000', '#fff'], ['#000', '#fff']] })

// @ts-expect-error a band has exactly two shades
bands({ cuts: [], shades: [['#000']] })

// @ts-expect-error shades are required
bands({ cuts: [50] })

// @ts-expect-error band() takes no style properties
rate.band(1)?.nope

/* -------------------------------------------------------------- formatter */

const format = createFormatter({ locale: 'en-US' })
const text: string = format(1234, 'number')
const withDecimals: string = format(1, 'percent', 0)

createFormatter({ dateFormat: (date: Date) => date.toISOString() })
createFormatter({ dateFormat: { year: 'numeric' } })

// @ts-expect-error not a valid column type
format(1, 'currency')

// @ts-expect-error numberFormat takes Intl options
createFormatter({ numberFormat: 'wide' })

/* ------------------------------------------------------------------ props */

interface Row {
  id: number
  name: string
}

const props: DtTableProps<Row, number> = {
  data: [{ id: 1, name: 'Alpha' }],
  modelValue: [1],
  rowId: 'id',
  selectable: true,
  density: 'comfortable',
  pagination: 'numbers',
  bordered: false,
  sortOrder: -1,
  subRows: (row) => [row],
  'onUpdate:modelValue': (value) => value.map((entry) => entry + 1),
}

// @ts-expect-error sortOrder is 1 | -1
const badOrder: DtTableProps = { sortOrder: 2 }

// @ts-expect-error data must match the row type
const badData: DtTableProps<Row> = { data: [{ nope: true }] }

// @ts-expect-error unknown prop
const badProp: DtTableProps = { sortable: true }

// @ts-expect-error density is 'compact' | 'comfortable'
const badDensity: DtTableProps = { density: 'cozy' }

// @ts-expect-error pagination is 'step' | 'numbers'
const badPagination: DtTableProps = { pagination: 'pages' }

const column: DtColumnProps<Row> = {
  field: 'name',
  cellStyle: rate,
  cellTitle: (value, row) => `${row.name}: ${value}`,
}

const title: DtCellTitle<Row> = (value) => (value ? String(value) : undefined)

// @ts-expect-error cellTitle returns a string, not an object
const badTitle: DtColumnProps = { field: 'x', cellTitle: () => ({}) }

const emptyProps: DtTableEmptySlotProps = { query: 'zzz', clearSearch: () => {} }

const type: DtColumnType = 'percent'

// @ts-expect-error not a column type
const badType: DtColumnType = 'money'

const labels: Partial<DtLabels> = {
  empty: 'None',
  emptyHint: 'Check the spelling.',
  emptySearch: 'Nothing for "{query}"',
  range: '{from}-{to} of {total}',
  rowsPerPage: 'Per page',
  groupCount: '{count} facilities',
}

// @ts-expect-error unknown label key
const badLabels: Partial<DtLabels> = { emtpy: 'typo' }

// @ts-expect-error removed in 0.3.0: first and last buttons are gone
const removedFirst: Partial<DtLabels> = { firstPage: 'First' }

// @ts-expect-error removed in 0.3.0: replaced by `range`
const removedResults: Partial<DtLabels> = { results: '{from}-{to}' }

// @ts-expect-error removed in 0.3.0: the range has no unit
const removedUnit: Partial<DtLabels> = { unitRows: 'rows' }

// @ts-expect-error removed in 0.3.0: replaced by `rowsPerPage`
const removedPageSize: Partial<DtLabels> = { pageSize: 'Show {size}' }

// @ts-expect-error removed in 0.3.0: an empty table hides the pager
const removedNoResults: Partial<DtLabels> = { noResults: 'None' }

/* ----------------------------------------------------------------- plugin */

const options: DtVuePluginOptions = { prefix: 'X' }
const installable = DtVue

export {
  asCellStyle,
  badData,
  badDensity,
  badLabels,
  badOrder,
  badPagination,
  badProp,
  badTitle,
  badType,
  bandIndex,
  bandLabel,
  bandOptions,
  bandStyle,
  column,
  emptyProps,
  format,
  found,
  installable,
  labels,
  options,
  props,
  rate,
  removedFirst,
  removedNoResults,
  removedPageSize,
  removedResults,
  removedUnit,
  scale,
  shaded,
  text,
  title,
  type,
  withDecimals,
}
