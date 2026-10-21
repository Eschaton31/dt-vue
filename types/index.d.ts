import type { AllowedComponentProps, Plugin, VNodeProps } from 'vue'
import type { Cell, Column, Row, Table } from '@tanstack/vue-table'

/*
|--------------------------------------------------------------------------
| Shared types
|--------------------------------------------------------------------------
*/

/**
 * Drives alignment, formatting, sorting, group aggregation and the value
 * written to the Excel export.
 */
export type DtColumnType = 'string' | 'category' | 'number' | 'percent' | 'date' | 'minDate' | 'maxDate'

export type DtAlign = 'left' | 'center' | 'right'

export type DtSortOrder = 1 | -1

/** A `cellStyle` function: anything assignable to a Vue inline style object. */
export type DtCellStyle<TRow = any> = (value: any, row: TRow) => Record<string, string> | undefined

/** Every string the table renders. Pass a partial to the `labels` prop. */
export interface DtLabels {
  search: string
  empty: string
  loading: string
  export: string
  /** Supports `{label}`. */
  groupBy: string
  clearGrouping: string
  /** Supports `{size}`. */
  pageSize: string
  noResults: string
  /** Supports `{from}`, `{to}`, `{total}` and `{unit}`. */
  results: string
  unitRows: string
  unitResults: string
  firstPage: string
  previousPage: string
  nextPage: string
  lastPage: string
  pagination: string
  expandRow: string
  collapseRow: string
  selectAll: string
  selectRow: string
}

/*
|--------------------------------------------------------------------------
| DtColumn
|--------------------------------------------------------------------------
*/

export interface DtColumnProps<TRow = any> {
  /** Key on the row object that this column reads. */
  field: string

  /** Column heading. Defaults to `field`. */
  header?: string

  type?: DtColumnType

  /** Allow the user to sort by clicking the header. */
  sortable?: boolean

  /** Defaults by type: `category` is left-aligned, everything else centred. */
  align?: DtAlign

  /** Shrink the column to its content. */
  fit?: boolean

  /** Tailwind width class, e.g. `w-1/3` or `w-[180px]`. */
  width?: string

  /** Fraction digits for `type="percent"`. Defaults to 2. */
  decimals?: number

  /** Conditional cell styling. See `heatmap()`. */
  cellStyle?: DtCellStyle<TRow>

  /** Include this column in the Excel export. Defaults to true. */
  exportable?: boolean
}

export interface DtColumnBodySlotProps<TRow = any> {
  /** The whole row object. */
  data: TRow
  /** This column's value for the row. */
  value: any
  row: Row<TRow>
  column: Column<TRow, unknown>
  table: Table<TRow>
  cell?: Cell<TRow, unknown>
}

export interface DtColumnSlots<TRow = any> {
  /** Replace the rendered cell. */
  body?: (props: DtColumnBodySlotProps<TRow>) => any
}

/**
 * Configuration-only component: declared inside `<DtTable>`, never mounted.
 */
export declare const DtColumn: {
  new <TRow extends Record<string, any> = any>(): {
    $props: DtColumnProps<TRow> & VNodeProps & AllowedComponentProps
    $slots: DtColumnSlots<TRow>
  }
}

/*
|--------------------------------------------------------------------------
| DtTable
|--------------------------------------------------------------------------
*/

export interface DtTableProps<TRow = any, TSelected = any> {
  data?: TRow[]

  /** Selected rows. `row[rowId]` values when `rowId` is set, otherwise row objects. */
  modelValue?: TSelected[]

  /** Heading, and the default export filename. */
  title?: string

  /** Locale for every number and date. Defaults to the runtime locale. */
  locale?: string

  /** Intl options, or a function that formats a Date. */
  dateFormat?: Intl.DateTimeFormatOptions | ((date: Date) => string)

  /** Intl options applied to `type="number"` columns. */
  numberFormat?: Intl.NumberFormatOptions

  labels?: Partial<DtLabels>

  /** `{ Province: ['province'] }` renders a "Group by Province" button. */
  groupBy?: Record<string, string | string[]>

  /** Visual-only heading row inserted whenever this field changes between rows. */
  groupRowsBy?: string

  /** Thin border under every row. */
  bordered?: boolean

  /** Monospace table text. */
  mono?: boolean

  /**
   * Drop the card's overflow clipping and the horizontal scroll wrapper so
   * dropdowns and popovers in cells are not cut off.
   */
  overflowVisible?: boolean

  /** Totals row for numeric and min/max date columns. */
  totals?: boolean

  loading?: boolean

  /** Page size. Reactive after mount. */
  rows?: number

  pageSizes?: number[]

  searchable?: boolean

  /** Milliseconds to wait after typing before filtering. */
  searchDebounce?: number

  /** Programmatic sort. Works whether or not the column is `sortable`. */
  sortField?: string

  sortOrder?: DtSortOrder

  /** Where nested rows live. Defaults to `'children'`. */
  subRows?: string | ((row: TRow) => TRow[])

  /** Expander column when the data nests. Defaults to true. */
  expandable?: boolean

  /** Row identity. Also decides what `v-model` holds. */
  rowId?: string

  /** Checkbox column, plus click, shift-click and drag selection. */
  selectable?: boolean

  /** Show the built-in Export button. Requires the optional `xlsx` peer. */
  exportable?: boolean

  /** Export filename without extension. Defaults to `title`. */
  exportFilename?: string

  sheetName?: string

  'onUpdate:modelValue'?: (value: TSelected[]) => void

  'onExport-error'?: (error: Error) => void
}

export interface DtTableToolbarSlotProps<TRow = any> {
  table: Table<TRow>
  exportXlsx: () => Promise<void>
  grouping: string[]
  setGrouping: (columns: string | string[]) => void
  clearGrouping: () => void
}

export interface DtTableSlots<TRow = any> {
  /** Column declarations. */
  default?: () => any
  /** Replace the heading. */
  title?: () => any
  /** Buttons in the header bar. */
  toolbar?: (props: DtTableToolbarSlotProps<TRow>) => any
  empty?: () => any
  loading?: () => any
}

export interface DtTableExposed<TRow = any> {
  /** The underlying TanStack table instance. */
  table: Table<TRow>
  /** Write the current rows to an .xlsx file. */
  exportXlsx: () => Promise<void>
  resetSelection: () => void
  getSelectedRows: () => TRow[]
}

export declare const DtTable: {
  new <TRow extends Record<string, any> = any, TSelected = any>(): {
    $props: DtTableProps<TRow, TSelected> & VNodeProps & AllowedComponentProps
    $slots: DtTableSlots<TRow>
    $emit: {
      (event: 'update:modelValue', value: TSelected[]): void
      (event: 'export-error', error: Error): void
    }
  } & DtTableExposed<TRow>
}

/*
|--------------------------------------------------------------------------
| Helpers
|--------------------------------------------------------------------------
*/

/** Red through amber to green, in ten steps. */
export declare const DEFAULT_HEATMAP_SCALE: string[]

export interface HeatmapOptions {
  /** Ordered colours, low to high. */
  colors?: string[]
  /** Value mapped to the first colour. Defaults to 0. */
  min?: number
  /** Value mapped to the last colour. Defaults to 100. */
  max?: number
  /** CSS property to set. Defaults to `backgroundColor`. */
  property?: string
}

/**
 * Build a `cell-style` function that shades a cell by where its value falls
 * between `min` and `max`.
 */
export declare function heatmap(options?: HeatmapOptions): DtCellStyle

export interface FormatterOptions {
  locale?: string
  dateFormat?: Intl.DateTimeFormatOptions | ((date: Date) => string)
  numberFormat?: Intl.NumberFormatOptions
}

/** The same value formatter the table uses internally. */
export declare function createFormatter(
  options?: FormatterOptions
): (value: unknown, type?: DtColumnType, decimals?: number | null) => string

/*
|--------------------------------------------------------------------------
| Plugin
|--------------------------------------------------------------------------
*/

export interface DtVuePluginOptions {
  /** Prefix for the globally registered names, e.g. `'X'` gives `<XDtTable>`. */
  prefix?: string
}

declare const plugin: Plugin<[DtVuePluginOptions?]>

export default plugin

/*
|--------------------------------------------------------------------------
| Global component registration
|--------------------------------------------------------------------------
|
| Makes <DtTable> and <DtColumn> resolve in templates when the plugin is
| installed with app.use(DtVue).
|
*/

declare module 'vue' {
  export interface GlobalComponents {
    DtTable: typeof DtTable
    DtColumn: typeof DtColumn
  }
}
