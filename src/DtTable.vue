<script setup>
import {
  FlexRender,
  createColumnHelper,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useVueTable,
} from '@tanstack/vue-table'

import { computed, getCurrentInstance, h, onBeforeUnmount, ref, useSlots, watch } from 'vue'

import {
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
  DocumentArrowDownIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from '@heroicons/vue/16/solid'
import { TableCellsIcon } from '@heroicons/vue/20/solid'

import DtPager from './DtPager.vue'
import DtTooltip from './DtTooltip.vue'
import { GHOST_ICON_BUTTON } from './lib/classes.js'
import { readColumnsFromSlot, warnOnDuplicateFields } from './lib/columns.js'
import { DATE_TYPES, NUMERIC_TYPES, createFormatter, isValidDate, toDate, toNumber } from './lib/format.js'
import { exportRowsToXlsx, flattenRows } from './lib/export.js'

const props = defineProps({
  data: { type: Array, default: () => [] },

  // Heading, and the default export filename.
  title: { type: String, default: '' },

  /*
   * Locale for every number and date rendered by the table.
   * Leave unset to follow the runtime's locale.
   */
  locale: { type: String, default: undefined },

  /*
   * Intl.DateTimeFormatOptions, or a (date) => string function.
   * Defaults to a medium date, e.g. "Jan 5, 2026" under en-US.
   */
  dateFormat: { type: [Object, Function], default: null },

  // Intl.NumberFormatOptions applied to type="number" columns.
  numberFormat: { type: Object, default: null },

  // Override any UI string; see DEFAULT_LABELS below.
  labels: { type: Object, default: null },

  /*
   * Collapsible grouping with aggregated rows, driven by buttons in the header.
   *
   * :group-by="{ Province: ['Province'], City: ['Province', 'City/Municipality'] }"
   *
   * Each key is a button label ("Group by Province"); its value is the list of columns to group by.
   * Number columns are summed, date columns take their min / max.
   */
  groupBy: { type: Object, default: null },

  /*
   * Visual grouping only: inserts a heading row whenever this field changes between rows
   * (sort by the same field so equal values sit together).
   */
  groupRowsBy: { type: String, default: null },

  // Draws a hairline under every row. Pass :bordered="false" to remove it.
  bordered: { type: Boolean, default: true },

  /*
   * Text size and row padding: 'compact' (12px, the default) or 'comfortable' (13px, roomier rows).
   * Header cells and group headings keep their padding in both.
   */
  density: {
    type: String,
    default: 'compact',
    validator: (value) => ['compact', 'comfortable'].includes(value),
  },

  /*
   * Pager style: 'step' shows the range with previous / next, 'numbers' adds a
   * window of page numbers. Both keep the Rows select.
   */
  pagination: {
    type: String,
    default: 'step',
    validator: (value) => ['step', 'numbers'].includes(value),
  },

  // Monospace table text.
  mono: { type: Boolean, default: false },

  /*
   * Drops the overflow clipping on the card and the table's horizontal scroll
   * wrapper, so absolutely positioned content in cells (dropdown menus,
   * popovers) can escape the table. Wide tables then widen the page instead
   * of scrolling inside the card.
   */
  overflowVisible: { type: Boolean, default: false },

  /*
   * Shows a totals row under the table: number columns are summed,
   * minDate / maxDate columns show the earliest / latest date.
   */
  totals: { type: Boolean, default: false },

  loading: { type: Boolean, default: false },

  // Page size. Changing it after mount re-pages the table.
  rows: { type: Number, default: 10 },

  pageSizes: { type: Array, default: () => [10, 25, 50, 75, 100] },

  searchable: { type: Boolean, default: true },

  // Milliseconds to wait after typing before filtering.
  searchDebounce: { type: Number, default: 200 },

  sortField: { type: String, default: null },
  sortOrder: { type: Number, default: 1 },

  /*
   * Property containing nested rows.
   *
   * Defaults to:
   *
   * row.children
   */
  subRows: {
    type: [String, Function],
    default: 'children',
  },

  /*
   * Rows that have sub-rows get an expander column automatically.
   * Set false to hide it.
   */
  expandable: { type: Boolean, default: true },

  /*
   * Row identity. Also decides what v-model holds: `row[rowId]` values
   * when set, whole row objects when not.
   */
  rowId: { type: String, default: null },

  // Checkbox column, plus click, shift-click and drag selection.
  selectable: { type: Boolean, default: false },

  // Shows the built-in Export button.
  exportable: { type: Boolean, default: false },

  // Export filename without extension. Defaults to `title`.
  exportFilename: { type: String, default: null },

  sheetName: { type: String, default: 'Data' },
})

const emit = defineEmits(['export-error'])

const modelValue = defineModel({
  type: Array,
  default: () => [],
})

/*
|--------------------------------------------------------------------------
| Labels
|--------------------------------------------------------------------------
*/

const DEFAULT_LABELS = {
  search: 'Search',
  empty: 'No entries found',
  emptyHint: '',
  emptySearch: 'No entries match "{query}"',
  loading: 'Loading...',
  export: 'Export to Excel',
  groupBy: 'Group by {label}',
  groupCount: '{count}',
  clearGrouping: 'Clear grouping',
  total: 'Total',
  rowsPerPage: 'Rows',
  range: '{from}–{to} of {total}',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  pagination: 'Pagination',
  expandRow: 'Expand row',
  collapseRow: 'Collapse row',
  selectAll: 'Select all rows on this page',
  selectRow: 'Select row',
}

const labels = computed(() => ({ ...DEFAULT_LABELS, ...(props.labels ?? {}) }))

/**
 * Look up a label and interpolate {placeholders}.
 *
 * @param {string} key
 * @param {Record<string, string | number>} values
 * @return {string}
 */
function t(key, values = {}) {
  return String(labels.value[key] ?? '').replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match)
}

/**
 * Like t(), but returns the label as segments so a placeholder can be styled
 * (the pager bolds {from} and {to}) without putting HTML in a label.
 *
 * @param {string} key
 * @param {Record<string, string | number>} values
 * @return {{ text: string, placeholder: string | null }[]}
 */
function parts(key, values = {}) {
  const text = String(labels.value[key] ?? '')
  const segments = []

  let last = 0

  for (const match of text.matchAll(/\{(\w+)\}/g)) {
    if (match.index > last) {
      segments.push({ text: text.slice(last, match.index), placeholder: null })
    }

    const known = match[1] in values

    segments.push({ text: String(known ? values[match[1]] : match[0]), placeholder: known ? match[1] : null })

    last = match.index + match[0].length
  }

  if (last < text.length) {
    segments.push({ text: text.slice(last), placeholder: null })
  }

  return segments
}

/*
|--------------------------------------------------------------------------
| DtColumn discovery
|--------------------------------------------------------------------------
|
| Columns are read from the default slot's vnodes rather than registering
| themselves, so declaration order always wins and no column component is
| ever mounted. Reactive state read by the slot (a v-if toggle, a dynamic
| :header) is tracked by this computed and recomputes the table.
|
*/

const slots = useSlots()
const instance = getCurrentInstance()

/**
 * The default slot, preferring the raw function off the component vnode.
 *
 * Vue wraps slots that were not compiled from a template (render functions,
 * JSX) in a dev-only guard that warns whenever the slot is invoked outside a
 * render function. We invoke it inside a computed, which does track
 * dependencies, so that warning is a false positive here. Reading the raw
 * function avoids it. Compiled template slots are unwrapped already, so for
 * them this returns exactly the same function.
 *
 * @return {Function | undefined}
 */
function defaultSlot() {
  const raw = instance?.vnode?.children

  if (raw && typeof raw === 'object' && !Array.isArray(raw) && typeof raw.default === 'function') {
    return raw.default
  }

  return slots.default
}

const declaredColumns = computed(() => {
  const columns = readColumnsFromSlot(defaultSlot())

  if (import.meta.env?.DEV) {
    warnOnDuplicateFields(columns)
  }

  return columns
})

/*
|--------------------------------------------------------------------------
| Formatting
|--------------------------------------------------------------------------
*/

const formatter = computed(() =>
  createFormatter({
    locale: props.locale,
    dateFormat: props.dateFormat ?? undefined,
    numberFormat: props.numberFormat ?? undefined,
  })
)

const formatValue = (value, type, decimals = null) => formatter.value(value, type, decimals)

/*
|--------------------------------------------------------------------------
| Column helpers
|--------------------------------------------------------------------------
*/

const columnHelper = createColumnHelper()

function getAlignment(type, align) {
  if (align) {
    switch (align) {
      case 'left':
        return 'text-left'

      case 'right':
        return 'text-right'

      default:
        return 'text-center'
    }
  }

  return type === 'category' ? 'text-left' : 'text-center'
}

/*
|--------------------------------------------------------------------------
| Sub-row helpers
|--------------------------------------------------------------------------
*/

/**
 * Return the children for a row.
 *
 * Supports either:
 *
 * subRows="children"
 *
 * or:
 *
 * :sub-rows="row => row.children"
 */
function getRowSubRows(row) {
  if (typeof props.subRows === 'function') {
    return props.subRows(row) ?? []
  }

  return row?.[props.subRows] ?? []
}

/**
 * Whether this dataset contains at least one expandable row.
 *
 * We use this to determine whether the generated expander
 * column should exist at all.
 */
const hasExpandableRows = computed(() => props.data.some((row) => getRowSubRows(row).length > 0))

/*
|--------------------------------------------------------------------------
| Tanstack header
|--------------------------------------------------------------------------
*/

/**
 * Header content. A sortable column returns the bare label and arrow, which the
 * template puts inside the sort <button> (the button supplies the flex row); a
 * plain column returns its own flex row.
 */
function renderHeader(label, type = 'string', align = null) {
  return (header) => {
    const canSort = header.column.getCanSort()

    const sorted = header.column.getIsSorted()

    const SortIcon = sorted === 'asc' ? ChevronUpIcon : sorted === 'desc' ? ChevronDownIcon : ChevronUpDownIcon

    // the header lines up with the cells below it
    const labelAlignment = getAlignment(type, align)

    const content = [
      h(
        'span',
        {
          class: ['flex-1', labelAlignment],
        },
        label
      ),

      canSort
        ? h(SortIcon, {
            'aria-hidden': 'true',
            class: ['size-3.5 shrink-0', sorted ? 'text-[var(--dt-accent)]' : 'text-gray-400'],
          })
        : null,
    ]

    if (canSort) {
      return content
    }

    return h('div', { class: 'flex w-full items-center gap-1' }, content)
  }
}

// Numbers and dates line their digits up in columns.
const tabularFor = (type) => (NUMERIC_TYPES.includes(type) || DATE_TYPES.includes(type) ? 'tabular-nums' : '')

/*
|--------------------------------------------------------------------------
| Grouping, totals and sorting by column type
|--------------------------------------------------------------------------
*/

// Aggregation used for a column's value on a grouped row (see aggregationFns on the table).
const aggregationFor = (type) =>
  ({ number: 'groupSum', minDate: 'minDate', maxDate: 'maxDate', percent: 'mean' })[type] ?? 'category'

// Totals row cell: sum for numbers, earliest / latest for dates, nothing for anything else.
function renderFooter(type, decimals) {
  if (!['number', 'minDate', 'maxDate'].includes(type)) {
    return undefined
  }

  return ({ table, column }) => {
    const values = table
      .getFilteredRowModel()
      .rows.map((row) => row.getValue(column.id))
      .filter((value) => value !== null && value !== undefined && value !== '')

    let text = ''

    if (type === 'number') {
      text = formatValue(
        values.reduce((sum, value) => sum + (toNumber(value) ?? 0), 0),
        'number',
        decimals
      )
    } else {
      const dates = values.map(toDate).filter(Boolean)

      if (dates.length > 0) {
        text = formatValue(new Date(type === 'minDate' ? Math.min(...dates) : Math.max(...dates)), 'date')
      }
    }

    return h('div', { class: ['w-full text-center', tabularFor(type)] }, text)
  }
}

// Sort key of a cell: numbers and timestamps, with blanks first. Works on leaf values and on
// aggregated ones (numbers, Dates), which TanStack's auto-detected sorting cannot compare reliably.
const numberKey = (value) => toNumber(value) ?? -Infinity

const dateKey = (value) => toDate(value)?.getTime() ?? -Infinity

const sortingFnFor = (type) => {
  const toKey = NUMERIC_TYPES.includes(type) ? numberKey : DATE_TYPES.includes(type) ? dateKey : null

  if (!toKey) {
    return 'auto'
  }

  return (rowA, rowB, columnId) => {
    const a = toKey(rowA.getValue(columnId))
    const b = toKey(rowB.getValue(columnId))

    return a === b ? 0 : a > b ? 1 : -1
  }
}

// Column options that depend only on the column type.
const typeOptions = (type, decimals) => ({
  sortingFn: sortingFnFor(type),
  aggregationFn: aggregationFor(type),
  footer: renderFooter(type, decimals),
  aggregatedCell: (info) =>
    h('div', { class: ['w-full', getAlignment(type), tabularFor(type)] }, formatValue(info.getValue(), type, decimals)),
})

/*
|--------------------------------------------------------------------------
| Generated expander column
|--------------------------------------------------------------------------
*/

function createExpanderColumn() {
  return {
    id: '__expander',

    header: () =>
      h('div', {
        class: 'w-full',
      }),

    enableSorting: false,

    enableGlobalFilter: false,

    size: 36,

    // Same flag as <DtColumn fit>, so the column shrinks to its content.
    meta: { fit: true },

    cell: ({ row }) => {
      /*
       * Only rows that actually have children get
       * an interactive expander.
       */
      if (!row.getCanExpand()) {
        return h('div', {
          class: 'size-6',
        })
      }

      return h(
        'div',
        {
          class: 'flex items-center justify-center grow',
        },
        [
          h(
            'button',
            {
              type: 'button',

              class:
                'flex size-6 items-center justify-center rounded-md text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700',

              'aria-label': row.getIsExpanded() ? t('collapseRow') : t('expandRow'),

              onMousedown: (event) => {
                /*
                 * Do not allow the row drag-selection handler
                 * to start when clicking the expander.
                 */
                event.stopPropagation()
              },

              onClick: (event) => {
                event.stopPropagation()
                row.toggleExpanded()
              },
            },
            [
              h(ChevronRightIcon, {
                class: ['h-3.5 w-3.5 transition-transform duration-150', row.getIsExpanded() ? 'rotate-90' : ''],
              }),
            ]
          ),
        ]
      )
    },
  }
}

/*
|--------------------------------------------------------------------------
| Generated selection column
|--------------------------------------------------------------------------
*/

function createSelectionColumn() {
  return {
    id: '__selection',

    header: ({ table }) =>
      h(
        'div',
        {
          class: 'flex items-center justify-center',
        },
        [
          h('input', {
            type: 'checkbox',

            checked: table.getIsAllPageRowsSelected(),

            indeterminate: table.getIsSomePageRowsSelected(),

            'aria-label': t('selectAll'),

            class:
              'h-4 w-4 cursor-pointer rounded border-gray-300 text-[var(--dt-accent)] accent-[var(--dt-accent)] focus:ring-[var(--dt-focus-ring)]',

            onMousedown: (event) => {
              event.stopPropagation()
            },

            onClick: (event) => {
              event.stopPropagation()
            },

            // `change` is the canonical checkbox event; `click` only guards the row handler.
            onChange: (event) => {
              event.stopPropagation()

              table.toggleAllPageRowsSelected(event.target.checked)
            },
          }),
        ]
      ),

    enableSorting: false,

    enableGlobalFilter: false,

    size: 40,

    cell: ({ row }) => {
      // Child rows cannot be selected.
      if (row.depth > 0) {
        return h('div', {
          class: 'h-4 w-4',
        })
      }

      return h(
        'div',
        {
          class: 'flex grow items-center justify-center',
        },
        [
          h('input', {
            type: 'checkbox',

            checked: row.getIsSelected(),

            disabled: !row.getCanSelect(),

            'aria-label': t('selectRow'),

            class:
              'h-4 w-4 cursor-pointer rounded border-gray-300 text-[var(--dt-accent)] accent-[var(--dt-accent)] focus:ring-[var(--dt-focus-ring)] disabled:cursor-not-allowed disabled:opacity-50',

            onMousedown: (event) => {
              event.stopPropagation()
            },

            onClick: (event) => {
              event.stopPropagation()
            },

            onChange: (event) => {
              event.stopPropagation()

              row.toggleSelected(event.target.checked)
            },
          }),
        ]
      )
    },
  }
}

/*
|--------------------------------------------------------------------------
| Column definitions
|--------------------------------------------------------------------------
*/

const hiddenFields = computed(() => [props.sortField, props.groupRowsBy].filter(Boolean))

const columnsConfig = computed(() => {
  const generatedColumns = []

  // An expander appears whenever the data actually nests.
  if (props.expandable && hasExpandableRows.value) {
    generatedColumns.push(createExpanderColumn())
  }

  if (props.selectable) {
    generatedColumns.push(createSelectionColumn())
  }

  const dataColumns = declaredColumns.value.map(({ props: columnProps, slots: columnSlots }) => {
    const { field, header, type, sortable, align, fit, width, decimals, cellStyle, cellTitle, exportable } = columnProps

    return columnHelper.accessor(field, {
      accessorFn: (row) => row[field],

      header: renderHeader(header, type, align),

      /*
       * `sortable` governs whether the user may sort by clicking the header.
       * A programmatic sort-field must work regardless, otherwise TanStack
       * drops the sorting state for the column and nothing happens.
       */
      enableSorting: sortable || field === props.sortField,

      ...typeOptions(type, decimals),

      meta: {
        header,
        type,
        decimals,
        fit,
        width,
        align,
        cellStyle,
        cellTitle,
        exportable,
      },

      cell: (info) => {
        const value = info.getValue()

        if (columnSlots.body) {
          return h(
            'div',
            {
              class: ['w-full', getAlignment(type, align), fit ? 'whitespace-nowrap' : ''],
            },
            columnSlots.body({
              data: info.row.original,
              value,
              row: info.row,
              column: info.column,
              table: info.table,
            })
          )
        }

        return h(
          'div',
          {
            class: ['w-full', getAlignment(type, align), tabularFor(type), fit ? 'whitespace-nowrap' : ''],
          },
          formatValue(value, type, decimals)
        )
      },
    })
  })

  /*
   * sort-field / group-rows-by may reference a field that has no visible
   * column. Register it as a hidden column so TanStack can still sort by it.
   */
  const knownFields = new Set(dataColumns.map((column) => column.accessorKey))
  const hiddenColumns = hiddenFields.value
    .filter((field) => !knownFields.has(field))
    .map((field) =>
      columnHelper.accessor(field, {
        accessorFn: (row) => row[field],
        enableSorting: true,
      })
    )

  return [...generatedColumns, ...dataColumns, ...hiddenColumns]
})

/*
|--------------------------------------------------------------------------
| Table state
|--------------------------------------------------------------------------
*/

const sorting = ref([])
const grouping = ref([])
const expanded = ref({})
const rowSelection = ref({})
const globalFilter = ref('')
const userColumnVisibility = ref({})

// Helper columns added only for sorting/grouping are always hidden.
const autoHiddenColumns = computed(() => {
  const declared = new Set(declaredColumns.value.map(({ props: columnProps }) => columnProps.field))

  return Object.fromEntries(hiddenFields.value.filter((field) => !declared.has(field)).map((field) => [field, false]))
})

const columnVisibility = computed(() => ({ ...userColumnVisibility.value, ...autoHiddenColumns.value }))

/*
|--------------------------------------------------------------------------
| Search
|--------------------------------------------------------------------------
*/

const searchInput = ref('')

let searchTimer

watch(searchInput, (value) => {
  clearTimeout(searchTimer)

  searchTimer = setTimeout(() => {
    globalFilter.value = value
  }, Math.max(props.searchDebounce, 0))
})

onBeforeUnmount(() => clearTimeout(searchTimer))

/*
|--------------------------------------------------------------------------
| TanStack table
|--------------------------------------------------------------------------
*/

const table = useVueTable({
  get data() {
    return props.data
  },

  get columns() {
    return columnsConfig.value
  },

  /*
   * Use the application's row ID where possible.
   *
   * For nested rows, add the parent row ID to TanStack's
   * internal ID so nested rows cannot collide with their parent.
   *
   * The actual selected value is still taken from row.original[rowId].
   */
  getRowId: (row, index, parent) => {
    if (props.rowId) {
      const value = row?.[props.rowId]

      if (parent) {
        return `${parent.id}.${String(value ?? index)}`
      }

      return String(value ?? index)
    }

    if (parent) {
      return `${parent.id}.${index}`
    }

    return String(index)
  },

  /*
   * Only top-level rows are selectable, matching the blank checkbox
   * rendered for nested rows.
   */
  enableRowSelection: (row) => props.selectable && row.depth === 0,

  /*
   * Nested rows come from the configured subRows property.
   */
  getSubRows: (row) => getRowSubRows(row),

  getCoreRowModel: getCoreRowModel(),

  getExpandedRowModel: getExpandedRowModel(),

  getFilteredRowModel: getFilteredRowModel(),

  getGroupedRowModel: getGroupedRowModel(),

  getPaginationRowModel: getPaginationRowModel(),

  getSortedRowModel: getSortedRowModel(),

  groupedColumnMode: false,

  /*
   * TanStack's auto-reset queues a resetPageIndex() that is flushed by the
   * next setOptions call, and the Vue adapter runs setOptions on every state
   * change. The queued reset therefore lands immediately after the user
   * changes page, snapping them back to page 1. We reset deliberately
   * instead; see the watcher below.
   */
  autoResetPageIndex: false,

  /*
   * Match against the text the user can actually see as well as the raw
   * value, so searching "1,234" or "Jan 5, 2026" finds the row.
   */
  globalFilterFn: (row, columnId, filterValue) => {
    const needle = String(filterValue ?? '')
      .trim()
      .toLowerCase()

    if (!needle) {
      return true
    }

    const raw = row.getValue(columnId)

    if (raw === null || raw === undefined) {
      return false
    }

    const meta = table.getColumn(columnId)?.columnDef?.meta

    const haystack = `${raw}\u0000${formatValue(raw, meta?.type, meta?.decimals)}`.toLowerCase()

    return haystack.includes(needle)
  },

  state: {
    get sorting() {
      return sorting.value
    },

    get grouping() {
      return grouping.value
    },

    get expanded() {
      return expanded.value
    },

    get rowSelection() {
      return rowSelection.value
    },

    get globalFilter() {
      return globalFilter.value
    },

    get columnVisibility() {
      return columnVisibility.value
    },
  },

  initialState: {
    pagination: {
      pageSize: props.rows || 10,
    },
  },

  onSortingChange: (updater) => {
    sorting.value = typeof updater === 'function' ? updater(sorting.value) : updater
  },

  onGroupingChange: (updater) => {
    grouping.value = typeof updater === 'function' ? updater(grouping.value) : updater
  },

  onExpandedChange: (updater) => {
    expanded.value = typeof updater === 'function' ? updater(expanded.value) : updater
  },

  onRowSelectionChange: (updater) => {
    rowSelection.value = typeof updater === 'function' ? updater(rowSelection.value) : updater
  },

  onGlobalFilterChange: (updater) => {
    globalFilter.value = typeof updater === 'function' ? updater(globalFilter.value) : updater
  },

  onColumnVisibilityChange: (updater) => {
    userColumnVisibility.value = typeof updater === 'function' ? updater(columnVisibility.value) : updater
  },

  // How a column is summarised on a grouped row (picked per column by aggregationFor)
  aggregationFns: {
    groupSum: (columnId, leafRows) => leafRows.reduce((sum, row) => sum + (toNumber(row.getValue(columnId)) ?? 0), 0),

    minDate: (columnId, leafRows) =>
      leafRows.reduce((min, row) => {
        const date = toDate(row.getValue(columnId))

        return isValidDate(date) && (min === null || date < min) ? date : min
      }, null),

    maxDate: (columnId, leafRows) =>
      leafRows.reduce((max, row) => {
        const date = toDate(row.getValue(columnId))

        return isValidDate(date) && (max === null || date > max) ? date : max
      }, null),

    // Text columns show the value every leaf shares, and stay blank when the leaves differ
    // Date columns compare by time value, so two equal Date objects count as shared
    category: (columnId, leafRows) => {
      const isDate = DATE_TYPES.includes(table.getColumn(columnId)?.columnDef.meta?.type)
      const keyOf = (value) => (isDate ? (toDate(value)?.getTime() ?? value) : value)
      const first = leafRows[0]?.getValue(columnId)

      return leafRows.every((row) => keyOf(row.getValue(columnId)) === keyOf(first)) ? (first ?? '') : ''
    },
  },
})

const changeGrouping = (columns) => {
  grouping.value = Array.isArray(columns) ? columns : [columns]
  expanded.value = {}
  table.setPageIndex(0)
}

const clearGrouping = () => {
  grouping.value = []
  expanded.value = {}
  table.setPageIndex(0)
}

// The first group-by toggle, so clearing grouping can hand focus back to it.
let firstGroupToggle = null

const setFirstGroupToggle = (element, index) => {
  if (index === 0) {
    firstGroupToggle = element
  }
}

// Pressing a toggle that is already on turns grouping off.
const toggleGrouping = (columns) => {
  if (grouping.value.join() === [].concat(columns).join()) {
    clearGrouping()
  } else {
    changeGrouping(columns)
  }
}

// The Clear grouping button disappears once it is used, which would drop focus to <body>.
const onClearGrouping = () => {
  clearGrouping()

  firstGroupToggle?.focus()
}

/*
 * Anything that changes how many rows there are sends the user back to the
 * first page, which is what TanStack's autoResetPageIndex would have done
 * had it not also fired on ordinary page changes.
 */
watch([globalFilter, () => props.data], () => {
  table.setPageIndex(0)
})

/*
|--------------------------------------------------------------------------
| External sorting
|--------------------------------------------------------------------------
*/

watch(
  () => [props.sortField, props.sortOrder],
  ([field, order]) => {
    if (!field) {
      sorting.value = []
      return
    }

    sorting.value = [
      {
        id: field,
        desc: order === -1,
      },
    ]
  },
  {
    immediate: true,
  }
)

/*
|--------------------------------------------------------------------------
| Pagination
|--------------------------------------------------------------------------
*/

watch(
  () => props.rows,
  (value) => {
    table.setPageSize(value || 10)
  }
)

const formatCount = (value) => formatValue(value, 'number')

/*
|--------------------------------------------------------------------------
| Display rows / visual grouping
|--------------------------------------------------------------------------
*/

// Top-level rows per groupRowsBy value, after search and before pagination.
const groupCounts = computed(() => {
  const counts = new Map()

  if (!props.groupRowsBy) {
    return counts
  }

  for (const row of table.getPrePaginationRowModel().rows) {
    if (row.depth === 0) {
      const value = row.original?.[props.groupRowsBy] ?? ''

      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }

  return counts
})

const groupCountText = (count) => t('groupCount', { count: formatCount(count) })

const displayRows = computed(() => {
  const rows = table.getRowModel().rows

  if (!props.groupRowsBy) {
    return rows.map((row) => ({
      type: 'data',
      row,
    }))
  }

  const result = []
  let currentGroup

  rows.forEach((row) => {
    const value = row.original?.[props.groupRowsBy] ?? ''

    if (value !== currentGroup) {
      currentGroup = value

      result.push({
        type: 'group',
        value,
      })
    }

    result.push({
      type: 'data',
      row,
    })
  })

  return result
})

/*
|--------------------------------------------------------------------------
| Selection
|--------------------------------------------------------------------------
|
| v-model is two-way: the table writes the selection out, and a selection
| set from the outside is applied back in. Both directions bail out when
| nothing actually changed, which is what keeps them from looping.
|
*/

const selectedRows = computed(() => {
  const rows = table.getSelectedRowModel().rows

  if (props.rowId) {
    return rows.map((row) => row.original[props.rowId])
  }

  return rows.map((row) => row.original)
})

function sameList(a, b) {
  if (a === b) {
    return true
  }

  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false
  }

  return a.every((item, index) => item === b[index])
}

function sameKeys(a, b) {
  const selectedA = Object.keys(a).filter((key) => a[key])
  const selectedB = Object.keys(b).filter((key) => b[key])

  return selectedA.length === selectedB.length && selectedA.every((key) => b[key])
}

/**
 * Translate v-model entries into TanStack row-selection keys.
 *
 * @param {unknown[]} values
 * @return {Record<string, boolean>}
 */
function selectionKeysFor(values) {
  const keys = {}

  if (!props.selectable) {
    return keys
  }

  if (props.rowId) {
    for (const value of values ?? []) {
      keys[String(value)] = true
    }

    return keys
  }

  const rows = table.getCoreRowModel().flatRows

  for (const value of values ?? []) {
    const row = rows.find((candidate) => candidate.original === value)

    if (row) {
      keys[row.id] = true
    }
  }

  return keys
}

// Inbound: runs first so an initial v-model value is not clobbered.
watch(
  modelValue,
  (value) => {
    const keys = selectionKeysFor(value)

    if (!sameKeys(keys, rowSelection.value)) {
      rowSelection.value = keys
    }
  },
  {
    immediate: true,
  }
)

// Outbound.
watch(selectedRows, (value) => {
  if (!sameList(value, modelValue.value)) {
    modelValue.value = value
  }
})

watch(
  () => props.data,
  () => {
    if (!props.rowId) {
      table.resetRowSelection()
    }
  }
)

/*
|--------------------------------------------------------------------------
| Shift / drag selection
|--------------------------------------------------------------------------
*/

/*
 * Clicking anything interactive inside a cell must not also toggle the row.
 * Add data-dt-no-select to opt a custom element out.
 */
const INTERACTIVE_SELECTOR = 'a,button,input,select,textarea,label,summary,[contenteditable],[data-dt-no-select]'

function isInteractiveTarget(event) {
  return Boolean(event.target?.closest?.(INTERACTIVE_SELECTOR))
}

const lastSelectedRowId = ref(null)
const isDragging = ref(false)
const hasDragged = ref(false)
const dragStartRowId = ref(null)
const dragSelectedState = ref(true)

function onRowClick(event, row) {
  if (hasDragged.value) {
    hasDragged.value = false
    return
  }

  if (!props.selectable || row.depth > 0 || isInteractiveTarget(event)) {
    return
  }

  const rows = table.getRowModel().rows

  if (event.shiftKey && lastSelectedRowId.value != null) {
    const startIndex = rows.findIndex((item) => item.id === lastSelectedRowId.value)

    const endIndex = rows.findIndex((item) => item.id === row.id)

    if (startIndex !== -1 && endIndex !== -1) {
      const start = Math.min(startIndex, endIndex)

      const end = Math.max(startIndex, endIndex)

      rows.forEach((item, index) => {
        if (item.getCanSelect()) {
          item.toggleSelected(index >= start && index <= end)
        }
      })
    }
  } else {
    row.toggleSelected()
  }

  lastSelectedRowId.value = row.id
}

function startRowDrag(event, row) {
  if (!props.selectable || row.depth > 0 || isInteractiveTarget(event)) {
    return
  }

  if (event.button !== 0) {
    return
  }

  isDragging.value = true
  hasDragged.value = false
  dragStartRowId.value = row.id
  dragSelectedState.value = !row.getIsSelected()

  document.addEventListener('mouseup', stopRowDrag)
}

function dragOverRow(row) {
  if (!isDragging.value || dragStartRowId.value == null) {
    return
  }

  const rows = table.getRowModel().rows

  const startIndex = rows.findIndex((item) => item.id === dragStartRowId.value)

  const endIndex = rows.findIndex((item) => item.id === row.id)

  if (startIndex === -1 || endIndex === -1) {
    return
  }

  if (startIndex !== endIndex) {
    hasDragged.value = true
  }

  const start = Math.min(startIndex, endIndex)

  const end = Math.max(startIndex, endIndex)

  rows.forEach((item, index) => {
    if (item.getCanSelect()) {
      item.toggleSelected(index >= start && index <= end ? dragSelectedState.value : false)
    }
  })
}

function stopRowDrag() {
  isDragging.value = false
  dragStartRowId.value = null

  document.removeEventListener('mouseup', stopRowDrag)
}

// A drag in progress must not outlive the component.
onBeforeUnmount(stopRowDrag)

/*
|--------------------------------------------------------------------------
| Export
|--------------------------------------------------------------------------
*/

/**
 * Write the rows the user is currently looking at, in their current order,
 * to an .xlsx file. Search, sorting, grouping order and column visibility all
 * apply; pagination and expand/collapse state do not, so the export always
 * holds the full result set including nested rows.
 *
 * Note that getSortedRowModel sits after filtering and grouping in TanStack's
 * pipeline, which is what makes it the right source here.
 *
 * @return {Promise<void>}
 */
async function exportXlsx() {
  const columns = table
    .getVisibleLeafColumns()
    .filter((column) => !column.id.startsWith('__') && column.columnDef.meta?.exportable !== false)

  await exportRowsToXlsx({
    rows: flattenRows(table.getSortedRowModel().rows),
    columns,
    filename: props.exportFilename ?? props.title,
    sheetName: props.sheetName,
    formatValue,
  })
}

function onExportClick() {
  exportXlsx().catch((error) => {
    emit('export-error', error)

    console.error(error)
  })
}

/*
|--------------------------------------------------------------------------
| Expose
|--------------------------------------------------------------------------
*/

defineExpose({
  table,

  exportXlsx,

  resetSelection() {
    table.resetRowSelection()
  },

  getSelectedRows() {
    return table.getSelectedRowModel().rows.map((row) => row.original)
  },
})

const hasHeader = computed(() =>
  Boolean(props.title || props.searchable || props.groupBy || props.exportable || slots.title || slots.toolbar)
)

/*
|--------------------------------------------------------------------------
| Density, loading and empty states
|--------------------------------------------------------------------------
*/

const densityClasses = computed(() =>
  props.density === 'comfortable'
    ? { table: 'text-[13px]', cell: 'px-3 py-2.5' }
    : { table: 'text-xs', cell: 'px-3 py-2' }
)

// Numbers, percents and dates stay on one line; the wrapper scrolls instead.
const NOWRAP_TYPES = new Set(['number', 'percent', 'date', 'minDate', 'maxDate'])

// The totals row's label goes under the first data column that is not numeric and has no total of its own.
const totalLabelColumnId = computed(
  () =>
    table
      .getVisibleLeafColumns()
      .find(
        (column) =>
          !column.id.startsWith('__') &&
          !NUMERIC_TYPES.includes(column.columnDef.meta?.type) &&
          !column.columnDef.footer
      )?.id
)

const isEmpty = computed(() => table.getRowModel().rows.length === 0)

const searchQuery = computed(() => String(globalFilter.value ?? '').trim())

const emptyTitle = computed(() => (searchQuery.value ? t('emptySearch', { query: searchQuery.value }) : t('empty')))

const emptyHint = computed(() => t('emptyHint'))

function clearSearch() {
  clearTimeout(searchTimer)

  searchInput.value = ''
  globalFilter.value = ''
}

// Skeleton rows: as many as a page, up to five, one varied bar per data cell.
const SKELETON_WIDTHS = [62, 48, 70, 55, 40]

const skeletonRows = computed(() =>
  Array.from({ length: Math.min(table.getState().pagination.pageSize, 5) }, (_, row) => row)
)

// A bar lines up the way its column's values do.
const skeletonBarClass = (column) => {
  const { type, align } = column.columnDef.meta ?? {}

  const alignment = getAlignment(type, align)

  return [
    'block h-2.5 rounded bg-gray-100',
    alignment === 'text-right' ? 'ml-auto' : alignment === 'text-center' ? 'mx-auto' : '',
  ]
}

// A cell's native tooltip, for ordinary cells only (not group, placeholder or aggregated ones).
function cellTitleFor(cell) {
  if (cell.getIsGrouped() || cell.getIsPlaceholder() || (grouping.value.length > 0 && cell.getIsAggregated())) {
    return undefined
  }

  return cell.column.columnDef.meta?.cellTitle?.(cell.getValue(), cell.row.original)
}
</script>

<template>
  <div
    :class="[
      'relative w-full rounded-[var(--dt-radius)] border border-[var(--dt-border)] bg-white shadow-[shadow:var(--dt-shadow)]',
      overflowVisible ? 'overflow-visible' : 'overflow-hidden',
    ]">
    <!--
      DtColumn children are configuration, not markup. They are read straight
      out of the slot's vnodes and deliberately never mounted.
    -->

    <!-- Loading: a 2px progress line, and an announcement that is always mounted so it is read out -->
    <div v-if="loading" aria-hidden="true" class="dt-progress" />

    <span class="sr-only" role="status">{{ loading ? t('loading') : '' }}</span>

    <!-- Header -->
    <div
      v-if="hasHeader"
      class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-[var(--dt-border)] px-4 py-3">
      <div v-if="title || $slots.title" class="min-w-0">
        <slot name="title">
          <h3 v-if="title" class="text-[15px] font-semibold text-gray-900">
            {{ title }}
          </h3>
        </slot>
      </div>

      <div class="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
        <!-- Search -->
        <div v-if="searchable" class="relative w-full sm:w-60">
          <MagnifyingGlassIcon
            aria-hidden="true"
            class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-400" />

          <input
            v-model="searchInput"
            :aria-label="t('search')"
            :placeholder="t('search')"
            class="dt-search h-8 w-full rounded-lg border border-gray-300 bg-white pl-8 pr-2.5 text-[13px] text-gray-900 placeholder:text-gray-500 focus:border-[var(--dt-focus-border)] focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)]"
            type="search" />
        </div>

        <template v-if="groupBy">
          <button
            v-for="(columns, label, index) in groupBy"
            :key="label"
            :ref="(element) => setFirstGroupToggle(element, index)"
            :aria-pressed="grouping.join() === [].concat(columns).join()"
            :class="[
              'inline-flex h-7 items-center rounded-lg border px-2.5 text-xs font-semibold transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-focus-ring)]',
              grouping.join() === [].concat(columns).join()
                ? 'border-[var(--dt-accent)] bg-[var(--dt-selected)] text-[var(--dt-accent-strong)]'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
            ]"
            type="button"
            @click="toggleGrouping(columns)">
            {{ t('groupBy', { label }) }}
          </button>

          <DtTooltip v-if="grouping.length > 0" :text="t('clearGrouping')">
            <button
              :aria-label="t('clearGrouping')"
              :class="GHOST_ICON_BUTTON"
              type="button"
              @click="onClearGrouping">
              <XMarkIcon aria-hidden="true" class="size-4" />
            </button>
          </DtTooltip>
        </template>

        <DtTooltip v-if="exportable" :text="t('export')">
          <button :aria-label="t('export')" :class="GHOST_ICON_BUTTON" type="button" @click="onExportClick">
            <DocumentArrowDownIcon aria-hidden="true" class="size-4" />
          </button>
        </DtTooltip>

        <slot
          name="toolbar"
          :clear-grouping="clearGrouping"
          :export-xlsx="exportXlsx"
          :grouping="grouping"
          :set-grouping="changeGrouping"
          :table="table" />
      </div>
    </div>

    <!-- Table -->
    <div :class="[overflowVisible ? 'overflow-visible' : 'overflow-x-auto']">
      <table
        :aria-busy="loading ? 'true' : undefined"
        :class="['w-full border-collapse text-left', densityClasses.table, mono ? 'font-mono' : '']">
        <colgroup>
          <col
            v-for="column in table.getVisibleLeafColumns()"
            :key="column.id"
            :class="[column.columnDef.meta?.fit ? 'w-px' : '', column.columnDef.meta?.width ?? '']" />
        </colgroup>

        <!-- Header -->
        <thead>
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id">
            <th
              v-for="header in headerGroup.headers"
              :key="header.id"
              :aria-sort="
                header.column.getIsSorted() === 'asc'
                  ? 'ascending'
                  : header.column.getIsSorted() === 'desc'
                    ? 'descending'
                    : undefined
              "
              :class="[
                header.column.getCanSort() ? 'p-0' : 'px-3 py-2',
                'whitespace-nowrap border-b border-[var(--dt-border)] bg-[var(--dt-header-bg)] text-xs font-semibold',
                header.column.getIsSorted() ? 'text-gray-900' : 'text-gray-600',
                header.column.columnDef.meta?.width ?? '',
              ]"
              :colspan="header.colSpan"
              :style="{
                width: header.column.columnDef.meta?.fit ? '1%' : undefined,
              }">
              <template v-if="!header.isPlaceholder">
                <!-- Sortable: the label is a real button, so Tab reaches it and Enter or Space sorts -->
                <button
                  v-if="header.column.getCanSort()"
                  class="flex w-full select-none items-center gap-1 whitespace-nowrap rounded-lg px-3 py-2 transition-colors duration-150 ease-out hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--dt-focus-ring)]"
                  type="button"
                  @click="header.column.getToggleSortingHandler()?.($event)">
                  <FlexRender :props="header.getContext()" :render="header.column.columnDef.header" />
                </button>

                <FlexRender v-else :props="header.getContext()" :render="header.column.columnDef.header" />
              </template>
            </th>
          </tr>
        </thead>

        <!-- Body -->
        <tbody>
          <template v-if="!loading">
            <template
              v-for="(item, index) in displayRows"
              :key="item.type === 'group' ? `group-${item.value}-${index}` : item.row.id">
              <!-- Visual group row -->
              <tr v-if="item.type === 'group'" class="border-b border-[var(--dt-border)] bg-[var(--dt-group-bg)]">
                <td
                  :colspan="table.getVisibleLeafColumns().length || 1"
                  class="px-3 py-1.5 text-xs font-semibold text-gray-900">
                  {{ item.value
                  }}<span class="ml-1.5 font-medium text-gray-500">{{
                    groupCountText(groupCounts.get(item.value) ?? 0)
                  }}</span>
                </td>
              </tr>

              <!-- Normal data row -->
              <tr
                v-else
                :class="[
                  item.row.getIsGrouped()
                    ? 'bg-[var(--dt-group-bg)]'
                    : item.row.getIsSelected()
                      ? 'bg-[var(--dt-selected)]'
                      : [item.row.depth > 0 ? 'bg-gray-50/60' : 'bg-white', 'hover:bg-[var(--dt-hover)]'],
                  'transition-colors duration-150 ease-out',
                  { 'border-b border-[var(--dt-border)]': bordered },
                  { 'cursor-pointer select-none': selectable && item.row.depth === 0 },
                ]"
                @mousedown="startRowDrag($event, item.row)"
                @mouseenter="dragOverRow(item.row)">
                <td
                  v-for="cell in item.row.getVisibleCells()"
                  :key="cell.id"
                  :class="[
                    'align-middle text-gray-800',
                    densityClasses.cell,
                    cell.column.columnDef.meta?.fit || NOWRAP_TYPES.has(cell.column.columnDef.meta?.type)
                      ? 'whitespace-nowrap'
                      : '',
                    cell.column.columnDef.meta?.width ?? '',
                  ]"
                  :style="cell.column.columnDef.meta?.cellStyle?.(cell.getValue(), cell.row.original)"
                  :title="cellTitleFor(cell)"
                  @click="onRowClick($event, item.row)">
                  <!-- Grouped cell: the group's value and size, click to expand -->
                  <button
                    v-if="cell.getIsGrouped()"
                    class="inline-flex items-center gap-1 rounded font-semibold text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-focus-ring)]"
                    type="button"
                    @click.stop="item.row.getToggleExpandedHandler()()">
                    <ChevronDownIcon v-if="item.row.getIsExpanded()" aria-hidden="true" class="size-3" />
                    <ChevronRightIcon v-else aria-hidden="true" class="size-3" />
                    <span>{{ cell.getValue() }}</span>
                    <span class="font-medium text-gray-500">{{ groupCountText(item.row.subRows.length) }}</span>
                  </button>

                  <!-- Placeholder cell: nothing to aggregate for this column -->
                  <div v-else-if="cell.getIsPlaceholder()" class="size-3" />

                  <!-- Aggregated cell on a grouped row -->
                  <FlexRender
                    v-else-if="grouping.length > 0 && cell.getIsAggregated()"
                    :props="cell.getContext()"
                    :render="cell.column.columnDef.aggregatedCell ?? cell.column.columnDef.cell" />

                  <!-- Regular cell -->
                  <FlexRender v-else :props="cell.getContext()" :render="cell.column.columnDef.cell" />
                </td>
              </tr>
            </template>
          </template>

          <!-- Loading: the #loading slot, or still skeleton rows -->
          <tr v-else-if="$slots.loading">
            <td
              :colspan="table.getVisibleLeafColumns().length || 1"
              class="px-4 py-10 text-center text-xs text-gray-400">
              <slot name="loading" />
            </td>
          </tr>

          <template v-else>
            <tr
              v-for="row in skeletonRows"
              :key="`skeleton-${row}`"
              :class="{ 'border-b border-[var(--dt-border)]': bordered }">
              <td v-for="(column, columnIndex) in table.getVisibleLeafColumns()" :key="column.id" class="p-3">
                <span
                  v-if="!column.id.startsWith('__')"
                  :class="skeletonBarClass(column)"
                  :style="{ width: `${SKELETON_WIDTHS[(row + columnIndex) % SKELETON_WIDTHS.length]}%` }"
                  aria-hidden="true" />
              </td>
            </tr>
          </template>
        </tbody>

        <!-- Totals -->
        <tfoot v-if="totals && !loading && !isEmpty">
          <tr
            v-for="footerGroup in table.getFooterGroups()"
            :key="footerGroup.id"
            class="border-t border-gray-300 bg-white">
            <td
              v-for="header in footerGroup.headers"
              :key="header.id"
              :class="['font-semibold text-gray-900', densityClasses.cell]"
              :colspan="header.colSpan">
              <FlexRender
                v-if="!header.isPlaceholder && header.column.columnDef.footer"
                :props="header.getContext()"
                :render="header.column.columnDef.footer" />

              <template v-else-if="!header.isPlaceholder && header.column.id === totalLabelColumnId">{{
                t('total')
              }}</template>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Empty: outside the scrolling table, so it stays centred in the visible card width -->
    <div v-if="isEmpty && !loading" class="px-4 py-8 text-center" data-dt-empty>
      <div class="mx-auto flex size-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
        <TableCellsIcon aria-hidden="true" class="size-5" />
      </div>

      <p class="mt-2.5 text-sm font-semibold text-gray-900">{{ emptyTitle }}</p>

      <p v-if="emptyHint" class="mt-0.5 text-[13px] text-gray-600">{{ emptyHint }}</p>

      <div v-if="$slots.empty" class="mt-1.5">
        <slot name="empty" :clear-search="clearSearch" :query="searchQuery" />
      </div>
    </div>

    <!-- Pagination -->
    <DtPager
      v-if="!loading && table.getPrePaginationRowModel().rows.length > 0"
      :format-number="formatCount"
      :mode="pagination"
      :page-sizes="pageSizes"
      :parts="parts"
      :t="t"
      :table="table" />
  </div>
</template>
