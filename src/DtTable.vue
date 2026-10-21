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
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpDownIcon,
  ChevronUpIcon,
} from '@heroicons/vue/24/solid'

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

  // Draws a thin border under every row.
  bordered: { type: Boolean, default: false },

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
  search: 'Search all columns...',
  empty: 'No entries found',
  loading: 'Loading...',
  export: 'Export',
  groupBy: 'Group by {label}',
  clearGrouping: 'Clear grouping',
  pageSize: 'Show {size}',
  noResults: 'No results',
  results: 'Showing {from}-{to} of {total} {unit}',
  unitRows: 'rows',
  unitResults: 'results',
  firstPage: 'First page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page',
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

function renderHeader(label, type = 'string', align = null) {
  return (header) => {
    const sorted = header.column.getIsSorted()

    const SortIcon = sorted === 'asc' ? ChevronUpIcon : sorted === 'desc' ? ChevronDownIcon : ChevronUpDownIcon

    // the header lines up with the cells below it
    const labelAlignment = getAlignment(type, align)

    return h(
      'div',
      {
        class: ['flex w-full items-center gap-1'],
      },
      [
        h(
          'span',
          {
            class: ['flex-1', labelAlignment],
          },
          label
        ),

        header.column.getCanSort()
          ? h(SortIcon, {
              class: 'h-3 w-3 shrink-0',
            })
          : null,
      ]
    )
  }
}

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

    return h('div', { class: 'w-full text-center font-semibold text-gray-700' }, text)
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
    h('div', { class: ['w-full text-gray-700', getAlignment(type)] }, formatValue(info.getValue(), type, decimals)),
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
    const { field, header, type, sortable, align, fit, width, decimals, cellStyle, exportable } = columnProps

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
        cellStyle,
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
            class: ['w-full text-gray-700', getAlignment(type, align), fit ? 'whitespace-nowrap' : ''],
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

    // Text columns to the left of the grouped column repeat their (shared) value, the rest stay blank
    category: (columnId, leafRows) => {
      const ids = table.getAllLeafColumns().map((column) => column.id)

      return ids.indexOf(columnId) < ids.indexOf(grouping.value[0]) ? leafRows[0].getValue(columnId) : ''
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

const pageSize = computed({
  get() {
    return table.getState().pagination.pageSize
  },

  set(value) {
    table.setPageSize(Number(value))
  },
})

watch(
  () => props.rows,
  (value) => {
    table.setPageSize(value || 10)
  }
)

// "Showing 1-25 of 140 results"
const resultsText = computed(() => {
  // the rows the pager actually walks through: groups (and any expanded children) when grouped
  const total = table.getPrePaginationRowModel().rows.length

  if (total === 0) {
    return t('noResults')
  }

  const { pageIndex, pageSize: size } = table.getState().pagination

  return t('results', {
    from: formatValue(pageIndex * size + 1, 'number'),
    to: formatValue(Math.min((pageIndex + 1) * size, total), 'number'),
    total: formatValue(total, 'number'),
    unit: grouping.value.length > 0 ? t('unitRows') : t('unitResults'),
  })
})

function goToFirst() {
  table.setPageIndex(0)
}

function goToPrevious() {
  table.previousPage()
}

function goToNext() {
  table.nextPage()
}

function goToLast() {
  table.setPageIndex(Math.max(table.getPageCount() - 1, 0))
}

function gotoPage(page) {
  table.setPageIndex(page)
}

const visiblePages = computed(() => {
  const total = table.getPageCount()

  if (total <= 5) {
    return Array.from({ length: total }, (_, index) => index)
  }

  const current = table.getState().pagination.pageIndex

  let start = current - 2
  let end = current + 2

  if (start < 0) {
    start = 0
    end = 4
  }

  if (end >= total) {
    end = total - 1
    start = total - 5
  }

  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
})

/*
|--------------------------------------------------------------------------
| Display rows / visual grouping
|--------------------------------------------------------------------------
*/

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
  Boolean(props.title || props.groupBy || props.exportable || slots.title || slots.toolbar)
)
</script>

<template>
  <div
    :class="[
      'relative w-full rounded-lg border border-gray-200 bg-white shadow-md',
      overflowVisible ? 'overflow-visible' : 'overflow-hidden',
    ]">
    <!--
      DtColumn children are configuration, not markup. They are read straight
      out of the slot's vnodes and deliberately never mounted.
    -->

    <!-- Header -->
    <div v-if="hasHeader" class="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3">
      <div class="min-w-0">
        <slot name="title">
          <h3 v-if="title" class="text-base font-semibold text-gray-800">
            {{ title }}
          </h3>
        </slot>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <template v-if="groupBy">
          <button
            v-for="(columns, label) in groupBy"
            :key="label"
            :class="[
              'inline-flex h-7 items-center rounded-lg border bg-white px-3 text-xs font-semibold shadow-sm transition-all duration-150 ease-out hover:shadow-md active:translate-y-px',
              grouping.join() === [].concat(columns).join()
                ? 'border-[var(--dt-accent)] text-[var(--dt-accent-strong)]'
                : 'border-gray-300 text-gray-700',
            ]"
            type="button"
            @click="changeGrouping(columns)">
            {{ t('groupBy', { label }) }}
          </button>

          <button
            v-if="grouping.length > 0"
            class="inline-flex h-7 items-center rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 shadow-sm transition-all duration-150 ease-out hover:shadow-md active:translate-y-px"
            type="button"
            @click="clearGrouping">
            {{ t('clearGrouping') }}
          </button>
        </template>

        <button
          v-if="exportable"
          class="inline-flex h-7 items-center gap-2 rounded-lg border border-[var(--dt-action)] bg-[var(--dt-action)] px-3 text-xs font-semibold text-[var(--dt-action-fg)] shadow-sm transition-all duration-150 ease-out hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--dt-action)] active:translate-y-px disabled:cursor-not-allowed disabled:shadow-none"
          type="button"
          @click="onExportClick">
          {{ t('export') }}
        </button>

        <slot
          name="toolbar"
          :clear-grouping="clearGrouping"
          :export-xlsx="exportXlsx"
          :grouping="grouping"
          :set-grouping="changeGrouping"
          :table="table" />
      </div>
    </div>

    <!-- Search -->
    <div v-if="searchable" class="px-4 pt-4">
      <input
        v-model="searchInput"
        :placeholder="t('search')"
        class="block w-full rounded-md border border-gray-300 bg-white py-1.5 pl-3 pr-3 text-xs text-gray-900 shadow-sm transition focus:border-[var(--dt-focus-border)] focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)]"
        type="search" />
    </div>

    <!-- Table -->
    <div :class="['p-4', overflowVisible ? 'overflow-visible' : 'overflow-x-auto']">
      <table :class="['w-full border-collapse text-left text-xs', mono ? 'font-mono' : '']">
        <colgroup>
          <col
            v-for="column in table.getVisibleLeafColumns()"
            :key="column.id"
            :class="[column.columnDef.meta?.fit ? 'w-px' : '', column.columnDef.meta?.width ?? '']" />
        </colgroup>

        <!-- Header -->
        <thead>
          <tr v-for="headerGroup in table.getHeaderGroups()" :key="headerGroup.id" class="border-b-2 border-gray-200">
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
                header.column.getCanSort() ? 'cursor-pointer select-none' : '',
                'px-2 py-2 text-xs font-semibold text-gray-700 transition-colors hover:text-[var(--dt-accent-strong)]',
                header.column.columnDef.meta?.fit ? 'whitespace-nowrap' : '',
                header.column.columnDef.meta?.width ?? '',
              ]"
              :colspan="header.colSpan"
              :style="{
                width: header.column.columnDef.meta?.fit ? '1%' : undefined,
              }"
              @click="header.column.getToggleSortingHandler()?.($event)">
              <FlexRender
                v-if="!header.isPlaceholder"
                :props="header.getContext()"
                :render="header.column.columnDef.header" />
            </th>
          </tr>
        </thead>

        <!-- Body -->
        <tbody>
          <template
            v-for="(item, index) in displayRows"
            :key="item.type === 'group' ? `group-${item.value}-${index}` : item.row.id">
            <!-- Visual group row -->
            <tr v-if="item.type === 'group'" class="border-b border-gray-200 bg-[var(--dt-accent-wash)]">
              <td
                :colspan="table.getVisibleLeafColumns().length || 1"
                class="px-3 py-2 text-xs font-semibold text-[var(--dt-accent-strong)]">
                {{ item.value }}
              </td>
            </tr>

            <!-- Normal data row -->
            <tr
              v-else
              :class="[
                item.row.getIsSelected()
                  ? 'bg-[var(--dt-accent-wash)]'
                  : item.row.depth > 0
                    ? 'bg-gray-50/60'
                    : 'bg-white',
                'transition-colors duration-100',
                { 'border-b border-gray-200': bordered },
                { 'cursor-pointer select-none hover:bg-gray-50': selectable && item.row.depth === 0 },
              ]"
              @mousedown="startRowDrag($event, item.row)"
              @mouseenter="dragOverRow(item.row)">
              <td
                v-for="cell in item.row.getVisibleCells()"
                :key="cell.id"
                :class="[
                  'px-2 py-2 align-middle text-xs text-gray-700',
                  cell.column.columnDef.meta?.fit ? 'whitespace-nowrap' : '',
                  cell.column.columnDef.meta?.width ?? '',
                ]"
                :style="cell.column.columnDef.meta?.cellStyle?.(cell.getValue(), cell.row.original)"
                @click="onRowClick($event, item.row)">
                <!-- Grouped cell: the group's value and size, click to expand -->
                <button
                  v-if="cell.getIsGrouped()"
                  class="inline-flex items-center gap-1 font-semibold text-gray-700"
                  type="button"
                  @click.stop="item.row.getToggleExpandedHandler()()">
                  <ChevronDownIcon v-if="item.row.getIsExpanded()" aria-hidden="true" class="size-3" />
                  <ChevronRightIcon v-else aria-hidden="true" class="size-3" />
                  <span>{{ cell.getValue() }}</span>
                  <span class="font-normal text-gray-500">({{ item.row.subRows.length }})</span>
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

          <!-- Empty -->
          <tr v-if="!loading && table.getRowModel().rows.length === 0">
            <td
              :colspan="table.getVisibleLeafColumns().length || 1"
              class="px-4 py-10 text-center text-xs text-gray-400">
              <slot name="empty">{{ t('empty') }}</slot>
            </td>
          </tr>

          <!-- Loading -->
          <tr v-if="loading">
            <td
              :colspan="table.getVisibleLeafColumns().length || 1"
              class="px-4 py-10 text-center text-xs text-gray-400">
              <slot name="loading">{{ t('loading') }}</slot>
            </td>
          </tr>
        </tbody>

        <!-- Totals -->
        <tfoot v-if="totals">
          <tr v-for="footerGroup in table.getFooterGroups()" :key="footerGroup.id" class="border-t-2 border-gray-200">
            <th
              v-for="header in footerGroup.headers"
              :key="header.id"
              :colspan="header.colSpan"
              class="px-2 py-2 text-xs font-semibold text-gray-700">
              <FlexRender
                v-if="!header.isPlaceholder && header.column.columnDef.footer"
                :props="header.getContext()"
                :render="header.column.columnDef.footer" />
            </th>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Pagination -->
    <div class="flex items-center justify-between rounded-b-lg border-t border-gray-200 bg-gray-50/50 px-4 py-3">
      <!-- Results / page size -->
      <div class="flex items-center gap-3">
        <select
          v-model="pageSize"
          class="rounded-md border border-gray-300 bg-white py-1.5 pl-2 pr-8 text-xs text-gray-700 shadow-sm transition focus:border-[var(--dt-focus-border)] focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)]">
          <option v-for="size in pageSizes" :key="size" :value="size">{{ t('pageSize', { size }) }}</option>
        </select>

        <span class="hidden text-xs text-gray-500 sm:inline">{{ resultsText }}</span>
      </div>

      <!-- Pagination controls -->
      <nav :aria-label="t('pagination')" class="flex items-center gap-1">
        <!-- First -->
        <button
          :aria-label="t('firstPage')"
          :disabled="!table.getCanPreviousPage()"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
          type="button"
          @click="goToFirst">
          <ChevronDoubleLeftIcon aria-hidden="true" class="size-3.5" />
        </button>

        <!-- Previous -->
        <button
          :aria-label="t('previousPage')"
          :disabled="!table.getCanPreviousPage()"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
          type="button"
          @click="goToPrevious">
          <ChevronLeftIcon aria-hidden="true" class="size-4" />
        </button>

        <!-- Page numbers -->
        <div class="flex items-center gap-1">
          <button
            v-for="page in visiblePages"
            :key="page"
            :aria-current="page === table.getState().pagination.pageIndex ? 'page' : undefined"
            :class="[
              'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-xs font-medium transition-colors',

              page === table.getState().pagination.pageIndex
                ? 'bg-[var(--dt-accent-strong)] text-[var(--dt-accent-fg)] shadow-sm'
                : 'text-gray-600 hover:bg-white hover:text-[var(--dt-accent-strong)]',
            ]"
            type="button"
            @click="gotoPage(page)">
            {{ page + 1 }}
          </button>
        </div>

        <!-- Next -->
        <button
          :aria-label="t('nextPage')"
          :disabled="!table.getCanNextPage()"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
          type="button"
          @click="goToNext">
          <ChevronRightIcon aria-hidden="true" class="size-4" />
        </button>

        <!-- Last -->
        <button
          :aria-label="t('lastPage')"
          :disabled="!table.getCanNextPage()"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
          type="button"
          @click="goToLast">
          <ChevronDoubleRightIcon aria-hidden="true" class="size-3.5" />
        </button>
      </nav>
    </div>
  </div>
</template>
