/*
 * Compile-time assertions. `vue-tsc --noEmit` failing here means the public
 * types drifted; every @ts-expect-error below must stay an error.
 */
import DtVue, { DEFAULT_HEATMAP_SCALE, createFormatter, heatmap } from 'dt-vue'
import type { DtCellStyle, DtColumnType, DtLabels, DtTableProps, DtVuePluginOptions } from 'dt-vue'

/* ---------------------------------------------------------------- heatmap */

const shade: DtCellStyle = heatmap()
const shaded: Record<string, string> | undefined = shade(50, {})

heatmap({ colors: ['red', 'green'], min: 0, max: 10, property: 'color' })

// @ts-expect-error min must be a number
heatmap({ min: 'low' })

// @ts-expect-error unknown option
heatmap({ colours: ['red'] })

const scale: string[] = DEFAULT_HEATMAP_SCALE

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

const type: DtColumnType = 'percent'

// @ts-expect-error not a column type
const badType: DtColumnType = 'money'

const labels: Partial<DtLabels> = { empty: 'None', results: '{from}-{to}' }

// @ts-expect-error unknown label key
const badLabels: Partial<DtLabels> = { emtpy: 'typo' }

/* ----------------------------------------------------------------- plugin */

const options: DtVuePluginOptions = { prefix: 'X' }
const installable = DtVue

export { badData, badLabels, badOrder, badProp, badType, format, installable, labels, options, props, scale, shaded, text, type, withDecimals }
