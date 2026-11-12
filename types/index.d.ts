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

/** Text size and row padding: 12px (the default) or 13px with roomier rows. */
export type DtDensity = 'compact' | 'comfortable'

/** Pager style: range with previous / next, or a window of page numbers as well. */
export type DtPagination = 'step' | 'numbers'

/** A `cellStyle` function: anything assignable to a Vue inline style object. */
export type DtCellStyle<TRow = any> = (value: any, row: TRow) => Record<string, string> | undefined

/** A `cellTitle` function: the text for a body cell's `title` attribute. Null or undefined leaves it off. */
export type DtCellTitle<TRow = any> = (value: any, row: TRow) => string | null | undefined

/** Every string the table renders. Pass a partial to the `labels` prop. */
export interface DtLabels {
  /** Placeholder and accessible name of the search box. */
  search: string
  /** Empty-state title. */
  empty: string
  /** Empty-state hint under the title. Omitted while empty. */
  emptyHint: string
  /** Empty-state title while a search is active. Supports `{query}`. */
  emptySearch: string
  /** Announced (visually hidden) while `loading`. */
  loading: string
  /** Name and tooltip of the export button. */
  export: string
  /** Supports `{label}`. */
  groupBy: string
  /** Count after a group heading or grouped row. Supports `{count}`. */
  groupCount: string
  clearGrouping: string
  /** Label in the totals row, under the first non-numeric column that has no total of its own. */
  total: string
  /** Visible label of the page-size select. */
  rowsPerPage: string
  /** Supports `{from}`, `{to}` and `{total}`. */
  range: string
  previousPage: string
  nextPage: string
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

  /** Conditional cell styling. See `heatmap()` and `bands()`. */
  cellStyle?: DtCellStyle<TRow>

  /** The body cell's native tooltip. Pairs with `bands().band(value)?.label`. */
  cellTitle?: DtCellTitle<TRow>

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

  /** Hairline under every row. Defaults to true. */
  bordered?: boolean

  /** Text size and row padding. Defaults to `'compact'`. */
  density?: DtDensity

  /** Pager style. Defaults to `'step'`. */
  pagination?: DtPagination

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

  /** Show the built-in Export button (icon only). Requires the optional `xlsx` peer. */
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

export interface DtTableEmptySlotProps {
  /** The active search, trimmed. Empty when there is none. */
  query: string
  /** Empty the search box and the filter. */
  clearSearch: () => void
}

export interface DtTableSlots<TRow = any> {
  /** Column declarations. */
  default?: () => any
  /** Replace the heading. */
  title?: () => any
  /** Buttons in the header bar, after the built-in ones. */
  toolbar?: (props: DtTableToolbarSlotProps<TRow>) => any
  /** The action area under the empty state's title and hint, e.g. a Clear search button. */
  empty?: (props: DtTableEmptySlotProps) => any
  /** Replaces the skeleton rows while `loading`. */
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

export interface BandsOptions {
  /** Ascending cut points between bands. `n` cuts make `n + 1` bands. */
  cuts: number[]
  /** Two shades per band, lower half then upper half: `#rgb`, `#rrggbb` or `rgb(r, g, b)`. */
  shades: [string, string][]
  /** A name for each band, read back by `.band(value)`. */
  labels?: string[]
  /** Values below this take the first shade. Defaults to 0. */
  min?: number
  /** Values at or above this take the last shade. Defaults to 100. */
  max?: number
  /** Text colour on light shades. Defaults to a near-black. */
  ink?: string
  /** Text colour on dark shades. Defaults to white. */
  light?: string
}

export interface DtBand {
  /** Which band the value falls in. */
  index: number
  /** `labels[index]`, or null. */
  label: string | null
  background: string
  /** `light` or `ink`, whichever reads better on `background`. */
  color: string
}

/** The function `bands()` returns: a `cellStyle` that also names the band. */
export interface DtBandsCellStyle {
  (value: unknown): { backgroundColor: string; color: string } | undefined
  /** The band for a value, or null for a blank or non-numeric one. */
  band: (value: unknown) => DtBand | null
}

/**
 * Build a `cell-style` function that shades a cell by graded bands (two shades
 * per band) and picks readable text for each shade. Throws a TypeError for
 * mismatched cuts and shades, cuts that do not strictly ascend, or an unreadable colour.
 */
export declare function bands(options: BandsOptions): DtBandsCellStyle

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
