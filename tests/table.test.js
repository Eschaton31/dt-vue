import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'

import DtColumn from '../src/DtColumn.vue'
import DtTable from '../src/DtTable.vue'
import { bands } from '../src/lib/heatmap.js'

const REGIONS = [
  { id: 1, name: 'Alpha', region: 'NCR', cases: 100, seen: '2026-01-05T00:00:00Z' },
  { id: 2, name: 'Bravo', region: 'NCR', cases: 200, seen: '2026-03-05T00:00:00Z' },
  { id: 3, name: 'Charlie', region: 'VII', cases: 30, seen: '2026-02-05T00:00:00Z' },
]

function mountTable(props = {}, columns) {
  return mount(DtTable, {
    props: { data: REGIONS, locale: 'en-US', ...props },
    slots: {
      default: () =>
        columns ?? [
          h(DtColumn, { field: 'name', header: 'Name', type: 'category' }),
          h(DtColumn, { field: 'region', header: 'Region', type: 'category' }),
          h(DtColumn, { field: 'cases', header: 'Cases', type: 'number' }),
        ],
    },
  })
}

const rowTexts = (wrapper) => wrapper.findAll('tbody tr').map((row) => row.text())

describe('grouping', () => {
  it('renders a group button per groupBy entry', () => {
    const wrapper = mountTable({ groupBy: { Region: ['region'], Name: ['name'] } })

    const labels = wrapper.findAll('thead ~ *, div button').map((button) => button.text())

    expect(labels).toContain('Group by Region')
    expect(labels).toContain('Group by Name')
  })

  it('collapses rows into groups with a count', async () => {
    const wrapper = mountTable({ groupBy: { Region: ['region'] }, labels: { groupCount: '{count} rows' } })

    await wrapper.findAll('button').find((button) => button.text() === 'Group by Region').trigger('click')

    const rows = rowTexts(wrapper)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('NCR')
    expect(rows[0]).toContain('2 rows')
  })

  it('shows a category value on a grouped row only when every leaf shares it', async () => {
    const data = [
      { id: 1, name: 'Alpha', region: 'NCR', kind: 'Hospital', cases: 1 },
      { id: 2, name: 'Bravo', region: 'NCR', kind: 'Hospital', cases: 2 },
      { id: 3, name: 'Charlie', region: 'VII', kind: 'Clinic', cases: 3 },
      { id: 4, name: 'Delta', region: 'VII', kind: 'Hospital', cases: 4 },
    ]

    const wrapper = mountTable({ data, groupBy: { Region: ['region'] } }, [
      h(DtColumn, { field: 'name', header: 'Name', type: 'category' }),
      h(DtColumn, { field: 'region', header: 'Region', type: 'category' }),
      h(DtColumn, { field: 'kind', header: 'Kind', type: 'category' }),
      h(DtColumn, { field: 'cases', header: 'Cases', type: 'number' }),
    ])

    await wrapper.findAll('button').find((button) => button.text() === 'Group by Region').trigger('click')

    const rows = wrapper.findAll('tbody tr')

    // Name differs in both groups, so it is blank; Kind is shared only in NCR.
    expect(rows[0].findAll('td').map((cell) => cell.text())).toEqual(['', expect.stringContaining('NCR'), 'Hospital', '3'])
    expect(rows[1].findAll('td').map((cell) => cell.text())).toEqual(['', expect.stringContaining('VII'), '', '7'])
  })

  it('shows a date-typed value on a grouped row when every leaf holds an equal Date', async () => {
    const data = [
      { id: 1, name: 'Alpha', region: 'NCR', opened: new Date('2026-01-05T00:00:00Z'), closed: new Date('2026-02-01T00:00:00Z') },
      { id: 2, name: 'Bravo', region: 'NCR', opened: new Date('2026-01-05T00:00:00Z'), closed: new Date('2026-03-01T00:00:00Z') },
    ]

    const wrapper = mountTable({ data, groupBy: { Region: ['region'] } }, [
      h(DtColumn, { field: 'name', header: 'Name', type: 'category' }),
      h(DtColumn, { field: 'region', header: 'Region', type: 'category' }),
      h(DtColumn, { field: 'opened', header: 'Opened', type: 'date' }),
      h(DtColumn, { field: 'closed', header: 'Closed', type: 'date' }),
    ])

    await wrapper.findAll('button').find((button) => button.text() === 'Group by Region').trigger('click')

    const cells = wrapper.findAll('tbody tr')[0].findAll('td')

    // Equal dates are shared, so they show; differing dates stay blank.
    expect(cells[2].text()).not.toBe('')
    expect(cells[3].text()).toBe('')
  })

  it('sums number columns on the group row', async () => {
    const wrapper = mountTable({ groupBy: { Region: ['region'] } })

    await wrapper.findAll('button').find((button) => button.text() === 'Group by Region').trigger('click')

    expect(rowTexts(wrapper)[0]).toContain('300')
  })

  it('expands a group back to its rows', async () => {
    const wrapper = mountTable({ groupBy: { Region: ['region'] } })

    await wrapper.findAll('button').find((button) => button.text() === 'Group by Region').trigger('click')
    await wrapper.findAll('tbody button')[0].trigger('click')

    expect(wrapper.findAll('tbody tr').length).toBeGreaterThan(2)
  })

  it('clears grouping', async () => {
    const wrapper = mountTable({ groupBy: { Region: ['region'] } })

    await wrapper.findAll('button').find((button) => button.text() === 'Group by Region').trigger('click')
    await wrapper.find('button[aria-label="Clear grouping"]').trigger('click')

    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
  })

  it('aggregates min and max dates', async () => {
    const wrapper = mountTable({ groupBy: { Region: ['region'] } }, [
      h(DtColumn, { field: 'region', header: 'Region', type: 'category' }),
      h(DtColumn, { field: 'seen', header: 'First', type: 'minDate' }),
    ])

    await wrapper.findAll('button').find((button) => button.text() === 'Group by Region').trigger('click')

    expect(rowTexts(wrapper)[0]).toContain('Jan 5, 2026')
  })
})

describe('visual grouping (groupRowsBy)', () => {
  it('inserts a heading row whenever the field changes', () => {
    const wrapper = mountTable({ groupRowsBy: 'region', sortField: 'region' })

    const rows = rowTexts(wrapper)

    expect(rows[0]).toMatch(/^NCR/)

    const headings = wrapper.findAll('tbody tr').filter((row) => row.findAll('td').length === 1)

    expect(headings.map((row) => row.text().replace(/\d+$/, ''))).toEqual(['NCR', 'VII'])
  })

  it('hides the helper column it sorts by', () => {
    const wrapper = mountTable({ groupRowsBy: 'missingField', sortField: 'missingField' }, [
      h(DtColumn, { field: 'name', header: 'Name' }),
    ])

    expect(wrapper.findAll('thead th span').map((node) => node.text())).toEqual(['Name'])
  })
})

describe('totals row', () => {
  it('sums number columns', () => {
    const wrapper = mountTable({ totals: true })

    expect(wrapper.find('tfoot').text()).toContain('330')
  })

  it('shows the earliest and latest date', () => {
    const wrapper = mountTable({ totals: true, data: REGIONS.map((row) => ({ ...row, lastSeen: row.seen })) }, [
      h(DtColumn, { field: 'seen', header: 'First', type: 'minDate' }),
      h(DtColumn, { field: 'lastSeen', header: 'Last', type: 'maxDate' }),
    ])

    expect(wrapper.find('tfoot').text()).toContain('Jan 5, 2026')
    expect(wrapper.find('tfoot').text()).toContain('Mar 5, 2026')
  })

  it('is absent unless asked for', () => {
    expect(mountTable().find('tfoot').exists()).toBe(false)
  })

  it('labels the first non-numeric column that has no total of its own, and no other', () => {
    const wrapper = mountTable({ totals: true })

    const cells = wrapper.findAll('tfoot td')

    expect(cells[0].text()).toBe('Total')
    expect(cells[1].text()).toBe('')
    expect(cells[2].text()).toBe('330')
  })

  it('skips numeric and percent columns, and any column that has a total', () => {
    const wrapper = mountTable({ totals: true, data: REGIONS.map((row) => ({ ...row, rate: row.cases / 1000 })) }, [
      h(DtColumn, { field: 'cases', header: 'Cases', type: 'number' }),
      h(DtColumn, { field: 'rate', header: 'Rate', type: 'percent' }),
      h(DtColumn, { field: 'seen', header: 'First', type: 'minDate' }),
      h(DtColumn, { field: 'name', header: 'Name', type: 'category' }),
      h(DtColumn, { field: 'region', header: 'Region', type: 'category' }),
    ])

    const cells = wrapper.findAll('tfoot td')

    expect(cells.map((cell) => cell.text())).toEqual(['330', '', 'Jan 5, 2026', 'Total', ''])
  })

  it('has no label when every column is numeric or has a total, and rewords through labels.total', () => {
    const numeric = mountTable({ totals: true }, [h(DtColumn, { field: 'cases', header: 'Cases', type: 'number' })])

    expect(numeric.find('tfoot').text()).toBe('330')

    const reworded = mountTable({ totals: true, labels: { total: 'Kabuuan' } })

    expect(reworded.find('tfoot td').text()).toBe('Kabuuan')
  })
})

describe('pagination', () => {
  const many = Array.from({ length: 12 }, (_, index) => ({ id: index, name: `Row ${index}`, cases: index }))

  const mountPaged = (props = {}) =>
    mount(DtTable, {
      props: { data: many, rows: 1, ...props },
      slots: { default: () => [h(DtColumn, { field: 'name', header: 'Name' })] },
    })

  const pageButtons = (wrapper) =>
    wrapper
      .findAll('nav button')
      .filter((button) => /^\d+$/.test(button.text()))
      .map((button) => button.text())

  const pageButton = (wrapper, text) => wrapper.findAll('nav button').find((button) => button.text() === text)

  it('shows a windowed page list in numbers mode', () => {
    expect(pageButtons(mountPaged({ pagination: 'numbers' }))).toEqual(['1', '2', '3', '12'])
  })

  it('shows no page numbers in step mode, the default', () => {
    expect(pageButtons(mountPaged())).toEqual([])
  })

  it('walks forward and back', async () => {
    const wrapper = mountPaged()

    await wrapper.find('nav button[aria-label="Next page"]').trigger('click')
    expect(wrapper.find('tbody').text()).toContain('Row 1')

    await wrapper.find('nav button[aria-label="Previous page"]').trigger('click')
    expect(wrapper.find('tbody').text()).toContain('Row 0')
  })

  it('jumps to the last and first page by number, with no first or last buttons', async () => {
    const wrapper = mountPaged({ pagination: 'numbers' })

    expect(wrapper.find('nav button[aria-label="First page"]').exists()).toBe(false)
    expect(wrapper.find('nav button[aria-label="Last page"]').exists()).toBe(false)

    await pageButton(wrapper, '12').trigger('click')
    expect(wrapper.find('tbody').text()).toContain('Row 11')
    expect(pageButtons(wrapper)).toEqual(['1', '10', '11', '12'])

    await pageButton(wrapper, '1').trigger('click')
    expect(wrapper.find('tbody').text()).toContain('Row 0')
  })

  it('jumps to a numbered page', async () => {
    const wrapper = mountPaged({ pagination: 'numbers' })

    await pageButton(wrapper, '3').trigger('click')

    expect(wrapper.find('tbody').text()).toContain('Row 2')
  })

  it('marks the current page and disables the edges', async () => {
    const wrapper = mountPaged({ pagination: 'numbers' })

    expect(wrapper.find('nav button[aria-label="Previous page"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('nav button[aria-label="Next page"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.find('nav button[aria-current="page"]').text()).toBe('1')

    await pageButton(wrapper, '12').trigger('click')

    expect(wrapper.find('nav button[aria-label="Next page"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('nav button[aria-current="page"]').text()).toBe('12')
  })

  it('reports the visible range', () => {
    expect(mountPaged().find('nav').text()).toContain('1–1 of 12')
    expect(mountPaged({ pagination: 'numbers' }).find('nav').text()).toContain('1–1 of 12')
  })

  it('hides the pager for an empty table', () => {
    const wrapper = mount(DtTable, {
      props: { data: [] },
      slots: { default: () => [h(DtColumn, { field: 'name', header: 'Name' })] },
    })

    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('hides the pager while loading, even with rows', () => {
    expect(mountPaged({ loading: true }).find('nav').exists()).toBe(false)
  })

  it('changes page size from the select', async () => {
    const wrapper = mountPaged()

    await wrapper.find('select').setValue('10')

    expect(wrapper.findAll('tbody tr')).toHaveLength(10)
  })

  /*
   * TanStack's autoResetPageIndex queues a reset that the Vue adapter flushes
   * on the next setOptions, which lands right after a page change and snaps
   * the user back to page 1. Resets are now explicit instead.
   */
  it('stays on the chosen page', async () => {
    const wrapper = mountPaged({ pagination: 'numbers' })

    await pageButton(wrapper, '3').trigger('click')
    await pageButton(wrapper, '4').trigger('click')
    await nextTick()
    await nextTick()

    expect(wrapper.vm.table.getState().pagination.pageIndex).toBe(3)
    expect(wrapper.find('tbody').text()).toContain('Row 3')
  })

  it('returns to the first page when the search changes', async () => {
    const wrapper = mount(DtTable, {
      props: { data: many, rows: 1, searchDebounce: 0 },
      slots: { default: () => [h(DtColumn, { field: 'name', header: 'Name' })] },
    })

    await wrapper.find('nav button[aria-label="Next page"]').trigger('click')
    expect(wrapper.vm.table.getState().pagination.pageIndex).toBe(1)

    await wrapper.find('input[type="search"]').setValue('Row 1')
    await new Promise((resolve) => setTimeout(resolve, 5))
    await nextTick()

    expect(wrapper.vm.table.getState().pagination.pageIndex).toBe(0)
  })

  it('returns to the first page when the data changes', async () => {
    const wrapper = mountPaged()

    await wrapper.find('nav button[aria-label="Next page"]').trigger('click')
    expect(wrapper.vm.table.getState().pagination.pageIndex).toBe(1)

    await wrapper.setProps({ data: many.slice(0, 3) })
    await nextTick()

    expect(wrapper.vm.table.getState().pagination.pageIndex).toBe(0)
  })

  it('returns to the first page when grouping changes', async () => {
    const wrapper = mount(DtTable, {
      props: { data: REGIONS, rows: 1, groupBy: { Region: ['region'] } },
      slots: {
        default: () => [
          h(DtColumn, { field: 'name', header: 'Name' }),
          h(DtColumn, { field: 'region', header: 'Region' }),
        ],
      },
    })

    await wrapper.find('nav button[aria-label="Next page"]').trigger('click')
    expect(wrapper.vm.table.getState().pagination.pageIndex).toBe(1)

    await wrapper.findAll('button').find((button) => button.text() === 'Group by Region').trigger('click')
    await nextTick()

    expect(wrapper.vm.table.getState().pagination.pageIndex).toBe(0)
  })
})

describe('range selection', () => {
  const mountSelectable = () =>
    mount(DtTable, {
      props: { data: REGIONS, rowId: 'id', selectable: true, modelValue: [] },
      slots: { default: () => [h(DtColumn, { field: 'name', header: 'Name' })] },
      attachTo: document.body,
    })

  it('selects every row on the page from the header checkbox', async () => {
    const wrapper = mountSelectable()

    await wrapper.find('thead input[type="checkbox"]').setValue(true)

    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([[1, 2, 3]])
  })

  it('selects a range with shift-click', async () => {
    const wrapper = mountSelectable()
    const rows = wrapper.findAll('tbody tr')

    await rows[0].findAll('td')[1].trigger('click')
    await rows[2].findAll('td')[1].trigger('click', { shiftKey: true })

    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([[1, 2, 3]])
  })

  it('selects a range by dragging', async () => {
    const wrapper = mountSelectable()
    const rows = wrapper.findAll('tbody tr')

    await rows[0].trigger('mousedown', { button: 0 })
    await rows[1].trigger('mouseenter')

    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([[1, 2]])

    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('ignores a non-primary mouse button', async () => {
    const wrapper = mountSelectable()
    const rows = wrapper.findAll('tbody tr')

    await rows[0].trigger('mousedown', { button: 2 })
    await rows[1].trigger('mouseenter')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('toggles a single row off again', async () => {
    const wrapper = mountSelectable()
    const cell = wrapper.findAll('tbody tr')[0].findAll('td')[1]

    await cell.trigger('click')
    await cell.trigger('click')

    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([[]])
  })

  it('selects from the row checkbox', async () => {
    const wrapper = mountSelectable()

    await wrapper.findAll('tbody input[type="checkbox"]')[1].setValue(true)

    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([[2]])
  })
})

describe('presentation', () => {
  it('applies alignment, fit and width', () => {
    const wrapper = mountTable({}, [
      h(DtColumn, { field: 'name', header: 'Name', align: 'right', fit: true, width: 'w-1/4' }),
    ])

    expect(wrapper.find('tbody td div').classes()).toContain('text-right')
    expect(wrapper.find('tbody td').classes()).toContain('whitespace-nowrap')
    expect(wrapper.find('col').classes()).toContain('w-1/4')
  })

  it('never wraps header labels, sortable or not', () => {
    const wrapper = mountTable({}, [
      h(DtColumn, { field: 'name', header: 'On ART', sortable: true }),
      h(DtColumn, { field: 'cases', header: 'Cases on ART' }),
    ])

    for (const th of wrapper.findAll('thead th')) {
      expect(th.classes()).toContain('whitespace-nowrap')
    }

    expect(wrapper.find('thead th button').classes()).toContain('whitespace-nowrap')
  })

  it('keeps number, percent and date cells on one line, and lets other types wrap', () => {
    const types = ['number', 'percent', 'date', 'minDate', 'maxDate']

    const wrapper = mountTable({}, [
      ...types.map((type) => h(DtColumn, { field: `${type}Value`, header: type, type })),
      h(DtColumn, { field: 'name', header: 'Name', type: 'category' }),
      h(DtColumn, { field: 'region', header: 'Plain' }),
    ])

    const cells = wrapper.findAll('tbody tr')[0].findAll('td')

    expect(cells.slice(0, types.length).map((cell) => cell.classes().includes('whitespace-nowrap'))).toEqual(
      types.map(() => true)
    )
    expect(cells[types.length].classes()).not.toContain('whitespace-nowrap')
    expect(cells[types.length + 1].classes()).not.toContain('whitespace-nowrap')
  })

  it('left-aligns category columns and centres the rest', () => {
    const wrapper = mountTable({}, [
      h(DtColumn, { field: 'name', header: 'Name', type: 'category' }),
      h(DtColumn, { field: 'cases', header: 'Cases', type: 'number' }),
    ])

    const cells = wrapper.findAll('tbody tr')[0].findAll('td div')

    expect(cells[0].classes()).toContain('text-left')
    expect(cells[1].classes()).toContain('text-center')
  })

  it('applies a cellStyle', () => {
    const wrapper = mountTable({}, [
      h(DtColumn, { field: 'cases', header: 'Cases', cellStyle: () => ({ backgroundColor: 'rgb(1, 2, 3)' }) }),
    ])

    expect(wrapper.find('tbody td').attributes('style')).toContain('rgb(1, 2, 3)')
  })

  it('honours mono, and draws row hairlines unless bordered is switched off', () => {
    expect(mountTable({ mono: true }).find('table').classes()).toContain('font-mono')
    expect(mountTable().find('tbody tr').classes()).toContain('border-b')
    expect(mountTable({ bordered: false }).find('tbody tr').classes()).not.toContain('border-b')
  })

  it('marks the sorted header with aria-sort', async () => {
    const wrapper = mountTable({}, [h(DtColumn, { field: 'name', header: 'Name', sortable: true })])

    expect(wrapper.find('thead th').attributes('aria-sort')).toBeUndefined()

    await wrapper.find('thead th button').trigger('click')
    await nextTick()
    expect(wrapper.find('thead th').attributes('aria-sort')).toBe('ascending')

    await wrapper.find('thead th button').trigger('click')
    await nextTick()
    expect(wrapper.find('thead th').attributes('aria-sort')).toBe('descending')
  })

  /*
   * TanStack sorts numeric columns descending on the first click; text
   * columns ascending. Documented rather than overridden.
   */
  it('sorts numeric columns descending first', async () => {
    const wrapper = mountTable({}, [h(DtColumn, { field: 'cases', header: 'Cases', sortable: true })])

    await wrapper.find('thead th button').trigger('click')
    await nextTick()

    expect(wrapper.find('thead th').attributes('aria-sort')).toBe('descending')
  })

  it('omits the header bar when there is nothing to put in it', () => {
    const wrapper = mountTable({ searchable: false })

    expect(wrapper.find('h3').exists()).toBe(false)
    expect(wrapper.find('input[type="search"]').exists()).toBe(false)

    // The first block in the card is the table wrapper, not a header bar.
    expect(wrapper.find('div').element.querySelector(':scope > div').querySelector('table')).not.toBeNull()
  })

  it('shows the header bar for the search box alone', () => {
    const wrapper = mountTable()

    expect(wrapper.find('input[type="search"]').exists()).toBe(true)
    expect(wrapper.find('div').element.querySelector(':scope > div').querySelector('table')).toBeNull()
  })

  it('renders the title slot over the title prop', () => {
    const wrapper = mount(DtTable, {
      props: { data: REGIONS, title: 'Prop title' },
      slots: {
        default: () => [h(DtColumn, { field: 'name', header: 'Name' })],
        title: () => h('h2', 'Slot title'),
      },
    })

    expect(wrapper.text()).toContain('Slot title')
    expect(wrapper.text()).not.toContain('Prop title')
  })

  it('passes helpers to the toolbar slot', () => {
    const wrapper = mount(DtTable, {
      props: { data: REGIONS },
      slots: {
        default: () => [h(DtColumn, { field: 'name', header: 'Name' })],
        toolbar: ({ exportXlsx, clearGrouping, grouping, table }) =>
          h(
            'span',
            typeof exportXlsx === 'function' &&
              typeof clearGrouping === 'function' &&
              Array.isArray(grouping) &&
              typeof table?.getState === 'function'
              ? 'ok'
              : 'missing'
          ),
      },
    })

    expect(wrapper.text()).toContain('ok')
  })
})

describe('exposed api', () => {
  it('exposes the table instance and selection helpers', async () => {
    const wrapper = mount(DtTable, {
      props: { data: REGIONS, rowId: 'id', selectable: true, modelValue: [1] },
      slots: { default: () => [h(DtColumn, { field: 'name', header: 'Name' })] },
    })

    expect(typeof wrapper.vm.table.getState).toBe('function')
    expect(wrapper.vm.getSelectedRows()).toEqual([REGIONS[0]])

    wrapper.vm.resetSelection()
    await nextTick()

    expect(wrapper.vm.getSelectedRows()).toEqual([])
  })
})

describe('overflowVisible', () => {
  const card = (wrapper) => wrapper.find('div')
  const scroller = (wrapper) => wrapper.find('table').element.parentElement

  it('clips the card and scrolls the table by default', () => {
    const wrapper = mountTable()

    expect(card(wrapper).classes()).toContain('overflow-hidden')
    expect(scroller(wrapper).classList).toContain('overflow-x-auto')
  })

  it('removes the clipping and the scroll wrapper when set', () => {
    const wrapper = mountTable({ overflowVisible: true })

    expect(card(wrapper).classes()).not.toContain('overflow-hidden')
    expect(card(wrapper).classes()).toContain('overflow-visible')
    expect(scroller(wrapper).classList).not.toContain('overflow-x-auto')
    expect(scroller(wrapper).classList).toContain('overflow-visible')
  })

  it('reacts to the prop changing after mount', async () => {
    const wrapper = mountTable()

    await wrapper.setProps({ overflowVisible: true })

    expect(card(wrapper).classes()).toContain('overflow-visible')
    expect(scroller(wrapper).classList).toContain('overflow-visible')
  })
})

/*
|--------------------------------------------------------------------------
| Structured Calm look (0.3.0)
|--------------------------------------------------------------------------
*/

describe('card and header band', () => {
  it('is a tokenised card with the shadow type hint', () => {
    const classes = mountTable().find('div').classes()

    expect(classes).toContain('rounded-[var(--dt-radius)]')
    expect(classes).toContain('border-[var(--dt-border)]')
    expect(classes).toContain('bg-white')
    // Without the `shadow:` hint Tailwind reads the value as a colour and the card renders flat.
    expect(classes).toContain('shadow-[shadow:var(--dt-shadow)]')
  })

  it('keeps the table wrapper free of padding', () => {
    const wrapper = mountTable()
    const scroller = wrapper.find('table').element.parentElement

    expect(scroller.className).not.toMatch(/\bp-\d/)
  })

  it('puts the header cells on the band with one hairline and no double rule', () => {
    const wrapper = mountTable({}, [h(DtColumn, { field: 'name', header: 'Name' })])

    expect(wrapper.find('thead tr').classes()).not.toContain('border-b-2')

    const th = wrapper.find('thead th')

    expect(th.classes()).toEqual(
      expect.arrayContaining(['bg-[var(--dt-header-bg)]', 'border-b', 'border-[var(--dt-border)]', 'text-xs', 'font-semibold', 'text-gray-600'])
    )
    expect(th.classes()).toEqual(expect.arrayContaining(['px-3', 'py-2']))
  })

  it('shows the sorted column in ink with an accent arrow, and unsorted ones quietly', async () => {
    const wrapper = mountTable({}, [
      h(DtColumn, { field: 'name', header: 'Name', sortable: true }),
      h(DtColumn, { field: 'region', header: 'Region', sortable: true }),
    ])

    await wrapper.findAll('thead th button')[0].trigger('click')
    await nextTick()

    const [sorted, unsorted] = wrapper.findAll('thead th')

    expect(sorted.classes()).toContain('text-gray-900')
    expect(sorted.find('svg').classes()).toContain('text-[var(--dt-accent)]')
    expect(unsorted.classes()).toContain('text-gray-600')
    expect(unsorted.find('svg').classes()).toContain('text-gray-400')
    expect(unsorted.find('button').classes()).toContain('hover:text-gray-900')
  })
})

describe('rows', () => {
  const mountSelected = () =>
    mount(DtTable, {
      props: { data: REGIONS, rowId: 'id', selectable: true, modelValue: [2] },
      slots: { default: () => [h(DtColumn, { field: 'name', header: 'Name' })] },
    })

  it('hairlines every body row, in the border token', () => {
    const classes = mountTable().find('tbody tr').classes()

    expect(classes).toContain('border-b')
    expect(classes).toContain('border-[var(--dt-border)]')
    expect(mountTable().find('tbody td').classes()).toContain('text-gray-800')
  })

  it('hovers unselected rows, and keeps the selected wash on hover', () => {
    const [first, second] = mountSelected().findAll('tbody tr')

    expect(first.classes()).toContain('hover:bg-[var(--dt-hover)]')
    expect(second.classes()).toContain('bg-[var(--dt-selected)]')
    expect(second.classes().some((name) => name.startsWith('hover:'))).toBe(false)
  })

  it('animates colour only', () => {
    const classes = mountSelected().find('tbody tr').classes()

    expect(classes).toEqual(expect.arrayContaining(['transition-colors', 'duration-150', 'ease-out']))
    expect(classes).not.toContain('transition-all')
  })

  it('hovers nested rows too', async () => {
    const wrapper = mount(DtTable, {
      props: { data: [{ id: 1, name: 'Parent', children: [{ id: 11, name: 'Child' }] }] },
      slots: { default: () => [h(DtColumn, { field: 'name', header: 'Name' })] },
    })

    await wrapper.find('button[aria-label="Expand row"]').trigger('click')

    expect(wrapper.findAll('tbody tr')[1].classes()).toContain('hover:bg-[var(--dt-hover)]')
  })
})

describe('group headings and grouped rows', () => {
  const mountGrouped = (props = {}, data = REGIONS) =>
    mountTable({ groupRowsBy: 'region', sortField: 'region', data, ...props })

  const headingRows = (wrapper) => wrapper.findAll('tbody tr').filter((row) => row.findAll('td').length === 1)

  it('draws a heading on the group face with its own rule', () => {
    const heading = headingRows(mountGrouped())[0]

    expect(heading.classes()).toEqual(
      expect.arrayContaining(['bg-[var(--dt-group-bg)]', 'border-b', 'border-[var(--dt-border)]'])
    )
    expect(heading.classes().some((name) => name.startsWith('hover:'))).toBe(false)
    expect(heading.find('td').classes()).toEqual(
      expect.arrayContaining(['text-xs', 'font-semibold', 'text-gray-900', 'px-3', 'py-1.5'])
    )
    expect(heading.find('span').classes()).toEqual(expect.arrayContaining(['ml-1.5', 'font-medium', 'text-gray-500']))
  })

  it('counts top-level rows per value through the label, whatever the page', () => {
    const wrapper = mountGrouped({ rows: 1, labels: { groupCount: '{count} facilities' } })

    expect(headingRows(wrapper)[0].find('span').text()).toBe('2 facilities')
  })

  it('counts after search and formats the number', async () => {
    const many = Array.from({ length: 1234 }, (_, index) => ({ id: index, name: `Row ${index}`, region: 'NCR' }))
    const wrapper = mountGrouped({ rows: 5, searchDebounce: 0 }, many)

    expect(headingRows(wrapper)[0].find('span').text()).toBe('1,234')

    await wrapper.find('input[type="search"]').setValue('Row 12')
    await new Promise((resolve) => setTimeout(resolve, 5))
    await nextTick()

    expect(headingRows(wrapper)[0].find('span').text()).toBe('45')
  })

  it('does not count nested rows', async () => {
    const wrapper = mountGrouped(
      {},
      [
        { id: 1, name: 'A', region: 'NCR', children: [{ id: 11, name: 'A1', region: 'NCR' }] },
        { id: 2, name: 'B', region: 'NCR' },
      ]
    )

    await wrapper.find('button[aria-label="Expand row"]').trigger('click')

    expect(headingRows(wrapper)[0].find('span').text()).toBe('2')
  })

  it('gives a TanStack group row the group face and the count label', async () => {
    const wrapper = mountTable({ groupBy: { Region: ['region'] }, labels: { groupCount: '{count} rows' } })

    await wrapper.findAll('button').find((button) => button.text() === 'Group by Region').trigger('click')

    const row = wrapper.find('tbody tr')

    expect(row.classes()).toContain('bg-[var(--dt-group-bg)]')
    expect(row.classes()).not.toContain('bg-white')
    expect(row.classes().some((name) => name.startsWith('hover:'))).toBe(false)

    const button = row.find('button')

    expect(button.classes()).toEqual(expect.arrayContaining(['font-semibold', 'text-gray-900']))
    expect(button.text()).toContain('2 rows')
    expect(button.text()).not.toContain('(')
    expect(row.findAll('td')[2].classes()).toEqual(expect.arrayContaining(['px-3', 'py-2']))
  })
})

describe('totals row', () => {
  it('uses cells, not header cells, on a ruled white row', () => {
    const wrapper = mountTable({ totals: true })

    expect(wrapper.find('tfoot th').exists()).toBe(false)
    expect(wrapper.find('tfoot tr').classes()).toEqual(expect.arrayContaining(['border-t', 'border-gray-300', 'bg-white']))

    const cell = wrapper.find('tfoot td')

    expect(cell.classes()).toEqual(expect.arrayContaining(['font-semibold', 'text-gray-900', 'px-3', 'py-2']))
  })

  it('lets the cell carry the colour, and lines digits up', () => {
    const wrapper = mountTable({ totals: true })

    const renderer = wrapper.findAll('tfoot td div')[0]

    expect(renderer.classes()).toContain('tabular-nums')
    expect(renderer.classes()).not.toContain('text-gray-700')
    expect(renderer.classes()).not.toContain('font-semibold')
  })

  it('is absent while loading and when there are no rows', async () => {
    const wrapper = mountTable({ totals: true })

    await wrapper.setProps({ loading: true })
    expect(wrapper.find('tfoot').exists()).toBe(false)

    await wrapper.setProps({ loading: false, data: [] })
    expect(wrapper.find('tfoot').exists()).toBe(false)
  })
})

describe('density', () => {
  const columns = [
    h(DtColumn, { field: 'name', header: 'Name', type: 'category', sortable: true }),
    h(DtColumn, { field: 'cases', header: 'Cases', type: 'number' }),
    h(DtColumn, { field: 'seen', header: 'Seen', type: 'date' }),
  ]

  it('is compact by default: 12px text, px-3 py-2 cells', () => {
    const wrapper = mountTable({ totals: true }, columns)

    expect(wrapper.find('table').classes()).toContain('text-xs')

    wrapper.findAll('tbody td, tfoot td').forEach((cell) => {
      expect(cell.classes()).toEqual(expect.arrayContaining(['px-3', 'py-2']))
    })
  })

  it('comfortable is 13px with py-2.5 cells, and leaves header and group padding alone', () => {
    const wrapper = mountTable({ density: 'comfortable', totals: true, groupRowsBy: 'region', sortField: 'region' }, columns)

    expect(wrapper.find('table').classes()).toContain('text-[13px]')
    expect(wrapper.find('table').classes()).not.toContain('text-xs')

    const dataCells = wrapper.findAll('tbody tr').filter((row) => row.findAll('td').length > 1).flatMap((row) => row.findAll('td'))

    dataCells.forEach((cell) => {
      expect(cell.classes()).toContain('py-2.5')
      expect(cell.classes()).not.toContain('text-xs')
    })

    wrapper.findAll('tfoot td').forEach((cell) => expect(cell.classes()).toContain('py-2.5'))

    // Header cells and group headings keep their padding.
    expect(wrapper.findAll('thead th')[1].classes()).toEqual(expect.arrayContaining(['px-3', 'py-2']))
    expect(wrapper.find('thead th button').classes()).toEqual(expect.arrayContaining(['px-3', 'py-2']))
    expect(wrapper.find('tbody tr td[colspan]').classes()).toContain('py-1.5')
  })

  it('accepts only compact and comfortable', () => {
    const { validator } = DtTable.props.density

    expect(validator('compact')).toBe(true)
    expect(validator('comfortable')).toBe(true)
    expect(validator('cozy')).toBe(false)
  })

  it('aligns digits in numeric and date cells, but not in text or a #body slot', () => {
    const wrapper = mountTable({}, [
      h(DtColumn, { field: 'name', header: 'Name', type: 'category' }),
      h(DtColumn, { field: 'cases', header: 'Cases', type: 'number' }),
      h(DtColumn, { field: 'seen', header: 'Seen', type: 'date' }),
      h(DtColumn, { field: 'id', header: 'Custom', type: 'number' }, { body: ({ value }) => h('b', value) }),
    ])

    const row = wrapper.findAll('tbody tr')[0].findAll('td div')

    expect(row[0].classes()).not.toContain('tabular-nums')
    expect(row[1].classes()).toContain('tabular-nums')
    expect(row[2].classes()).toContain('tabular-nums')
  })

  it('lines digits up on a grouped row\'s aggregated cells', async () => {
    const wrapper = mountTable({ groupBy: { Region: ['region'] } })

    await wrapper.findAll('button').find((button) => button.text() === 'Group by Region').trigger('click')

    expect(wrapper.findAll('tbody tr')[0].findAll('td div').some((cell) => cell.classes().includes('tabular-nums'))).toBe(true)
  })

  it('lets a cellStyle colour show: the cell renderer sets no text colour of its own', () => {
    const wrapper = mountTable({}, [
      h(DtColumn, {
        field: 'cases',
        header: 'Cases',
        type: 'number',
        cellStyle: bands({ cuts: [50], shades: [['#9B272C', '#D03E45'], ['#26873F', '#054A1F']] }),
      }),
    ])

    const cell = wrapper.find('tbody td')

    expect(cell.find('div').classes().some((name) => name.startsWith('text-gray-'))).toBe(false)
    expect(cell.attributes('style')).toContain('color')
  })
})

describe('loading state', () => {
  it('sets aria-busy only while loading', async () => {
    const wrapper = mountTable()

    expect(wrapper.find('table').attributes('aria-busy')).toBeUndefined()

    await wrapper.setProps({ loading: true })

    expect(wrapper.find('table').attributes('aria-busy')).toBe('true')
  })

  it('replaces the rows with still skeleton bars, one per data cell', () => {
    const wrapper = mountTable({ loading: true, rows: 10, selectable: true })

    const rows = wrapper.findAll('tbody tr')

    expect(rows).toHaveLength(5)
    expect(wrapper.text()).not.toContain('Alpha')

    rows.forEach((row) => {
      const cells = row.findAll('td')

      expect(cells).toHaveLength(4)
      expect(cells[0].find('span').exists()).toBe(false)
      expect(cells.slice(1).every((cell) => cell.find('span.h-2\\.5').exists())).toBe(true)
      expect(cells[1].classes()).toContain('p-3')
    })

    expect(wrapper.find('tbody [class*="animate-"]').exists()).toBe(false)
  })

  it('draws no more skeleton rows than the page size', () => {
    expect(mountTable({ loading: true, rows: 2 }).findAll('tbody tr')).toHaveLength(2)
  })

  it('draws the progress line only while loading', async () => {
    const wrapper = mountTable()

    expect(wrapper.find('.dt-progress').exists()).toBe(false)

    await wrapper.setProps({ loading: true })

    expect(wrapper.find('.dt-progress').exists()).toBe(true)
    expect(wrapper.find('.dt-progress').attributes('aria-hidden')).toBe('true')
  })

  it('announces through a status region that is mounted before loading begins', async () => {
    const wrapper = mountTable()

    const status = wrapper.find('[role="status"]')

    expect(status.exists()).toBe(true)
    expect(status.text()).toBe('')
    expect(status.classes()).toContain('sr-only')
    expect(wrapper.find('table').element.contains(status.element)).toBe(false)

    await wrapper.setProps({ loading: true })

    expect(wrapper.find('[role="status"]').element).toBe(status.element)
    expect(status.text()).toBe('Loading...')
  })

  it('shows a #loading slot in one full-width cell instead of the skeleton', () => {
    const wrapper = mount(DtTable, {
      props: { data: REGIONS, loading: true },
      slots: {
        default: () => [h(DtColumn, { field: 'name', header: 'Name' }), h(DtColumn, { field: 'cases', header: 'Cases' })],
        loading: () => h('em', 'Fetching'),
      },
    })

    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
    expect(wrapper.find('tbody td').attributes('colspan')).toBe('2')
    expect(wrapper.find('tbody td em').text()).toBe('Fetching')
    expect(wrapper.find('tbody span.h-2\\.5').exists()).toBe(false)
  })
})

describe('empty state', () => {
  const mountEmpty = (props = {}, slots = {}) =>
    mount(DtTable, {
      props: { data: [], searchDebounce: 0, ...props },
      slots: { default: () => [h(DtColumn, { field: 'name', header: 'Name' })], ...slots },
    })

  it('shows a tile, a title and no hint by default', () => {
    const wrapper = mountEmpty()

    const block = wrapper.find('[data-dt-empty]')

    expect(block.classes()).toEqual(expect.arrayContaining(['px-4', 'py-8', 'text-center']))
    expect(block.find('div').classes()).toEqual(expect.arrayContaining(['size-9', 'rounded-lg', 'bg-gray-100']))
    expect(block.find('div svg').classes()).toEqual(expect.arrayContaining(['size-5']))
    expect(block.findAll('p')).toHaveLength(1)
    expect(block.find('p').text()).toBe('No entries found')
    expect(block.find('p').classes()).toEqual(expect.arrayContaining(['mt-2.5', 'text-sm', 'font-semibold', 'text-gray-900']))
  })

  it('sits outside the scrolling table, so it stays inside the visible card width', () => {
    const wrapper = mountEmpty()

    const block = wrapper.find('[data-dt-empty]')

    expect(block.exists()).toBe(true)
    expect(wrapper.find('table').element.contains(block.element)).toBe(false)
    expect(wrapper.find('.overflow-x-auto').element.contains(block.element)).toBe(false)
    expect(wrapper.findAll('tbody tr')).toHaveLength(0)
    expect(wrapper.find('thead').exists()).toBe(true)
  })

  it('is not shown while loading or when there are rows', () => {
    expect(mountEmpty({ loading: true }).find('[data-dt-empty]').exists()).toBe(false)
    expect(mountTable().find('[data-dt-empty]').exists()).toBe(false)
  })

  it('has no hairline of its own even when bordered', () => {
    expect(mountEmpty({ bordered: true }).find('[data-dt-empty]').classes()).not.toContain('border-b')
  })

  it('shows the hint when one is set', () => {
    const wrapper = mountEmpty({ labels: { emptyHint: 'Try another region.' } })

    const hint = wrapper.findAll('[data-dt-empty] p')[1]

    expect(hint.text()).toBe('Try another region.')
    expect(hint.classes()).toEqual(expect.arrayContaining(['mt-0.5', 'text-[13px]', 'text-gray-600']))
  })

  it('names the search while one is active, and hands the #empty slot its query and clearSearch', async () => {
    let slotProps

    const wrapper = mount(DtTable, {
      props: { data: REGIONS, searchDebounce: 0 },
      slots: {
        default: () => [h(DtColumn, { field: 'name', header: 'Name' })],
        empty: (props) => {
          slotProps = props

          return h('button', { type: 'button', class: 'clear' }, 'Clear search')
        },
      },
    })

    await wrapper.find('input[type="search"]').setValue('  zzz ')
    await new Promise((resolve) => setTimeout(resolve, 5))
    await nextTick()

    expect(wrapper.find('[data-dt-empty] p').text()).toBe('No entries match "zzz"')
    expect(slotProps.query).toBe('zzz')
    expect(wrapper.find('[data-dt-empty] .mt-1\\.5 button.clear').exists()).toBe(true)

    slotProps.clearSearch()
    await nextTick()

    expect(wrapper.find('input[type="search"]').element.value).toBe('')
    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
  })

  it('does not render the slot area when no #empty slot is given', () => {
    expect(mountEmpty().find('tbody .mt-1\\.5').exists()).toBe(false)
  })
})

describe('cellTitle', () => {
  it('sets the body cell title from the value and the row', () => {
    const wrapper = mountTable({}, [
      h(DtColumn, { field: 'cases', header: 'Cases', cellTitle: (value, row) => `${row.name}: ${value}` }),
      h(DtColumn, { field: 'name', header: 'Name' }),
    ])

    expect(wrapper.findAll('tbody tr')[0].findAll('td')[0].attributes('title')).toBe('Alpha: 100')
    expect(wrapper.findAll('tbody tr')[0].findAll('td')[1].attributes('title')).toBeUndefined()
  })

  it('leaves the title off when the function returns undefined', () => {
    const wrapper = mountTable({}, [h(DtColumn, { field: 'cases', header: 'Cases', cellTitle: () => undefined })])

    expect(wrapper.find('tbody td').attributes('title')).toBeUndefined()
  })

  it('reads the band label from bands()', () => {
    const rate = bands({ cuts: [50], shades: [['#9B272C', '#D03E45'], ['#26873F', '#054A1F']], labels: ['Behind', 'Met'] })

    const wrapper = mountTable({}, [
      h(DtColumn, { field: 'cases', header: 'Cases', cellStyle: rate, cellTitle: (value) => rate.band(value)?.label }),
    ])

    expect(wrapper.findAll('tbody td').map((cell) => cell.attributes('title'))).toEqual(['Met', 'Met', 'Behind'])
  })
})
