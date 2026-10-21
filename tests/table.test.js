import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'

import DtColumn from '../src/DtColumn.vue'
import DtTable from '../src/DtTable.vue'

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
    const wrapper = mountTable({ groupBy: { Region: ['region'] } })

    await wrapper.findAll('button').find((button) => button.text() === 'Group by Region').trigger('click')

    const rows = rowTexts(wrapper)

    expect(rows).toHaveLength(2)
    expect(rows[0]).toContain('NCR')
    expect(rows[0]).toContain('(2)')
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
    await wrapper.findAll('button').find((button) => button.text() === 'Clear grouping').trigger('click')

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

    expect(rows[0]).toBe('NCR')
    expect(rows.filter((text) => text === 'NCR' || text === 'VII')).toHaveLength(2)
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
    const wrapper = mountTable({ totals: true }, [
      h(DtColumn, { field: 'seen', header: 'First', type: 'minDate' }),
      h(DtColumn, { field: 'seen', header: 'Last', type: 'maxDate' }),
    ])

    expect(wrapper.find('tfoot').text()).toContain('Jan 5, 2026')
    expect(wrapper.find('tfoot').text()).toContain('Mar 5, 2026')
  })

  it('is absent unless asked for', () => {
    expect(mountTable().find('tfoot').exists()).toBe(false)
  })
})

describe('pagination', () => {
  const many = Array.from({ length: 12 }, (_, index) => ({ id: index, name: `Row ${index}`, cases: index }))

  const mountPaged = () =>
    mount(DtTable, {
      props: { data: many, rows: 1 },
      slots: { default: () => [h(DtColumn, { field: 'name', header: 'Name' })] },
    })

  const pageButtons = (wrapper) =>
    wrapper
      .findAll('nav button')
      .filter((button) => /^\d+$/.test(button.text()))
      .map((button) => button.text())

  it('shows a windowed page list', () => {
    expect(pageButtons(mountPaged())).toEqual(['1', '2', '3', '4', '5'])
  })

  it('walks forward and back', async () => {
    const wrapper = mountPaged()

    await wrapper.find('nav button[aria-label="Next page"]').trigger('click')
    expect(wrapper.find('tbody').text()).toContain('Row 1')

    await wrapper.find('nav button[aria-label="Previous page"]').trigger('click')
    expect(wrapper.find('tbody').text()).toContain('Row 0')
  })

  it('jumps to the last and first page', async () => {
    const wrapper = mountPaged()

    await wrapper.find('nav button[aria-label="Last page"]').trigger('click')
    expect(wrapper.find('tbody').text()).toContain('Row 11')
    expect(pageButtons(wrapper)).toEqual(['8', '9', '10', '11', '12'])

    await wrapper.find('nav button[aria-label="First page"]').trigger('click')
    expect(wrapper.find('tbody').text()).toContain('Row 0')
  })

  it('jumps to a numbered page', async () => {
    const wrapper = mountPaged()

    await wrapper.findAll('nav button').find((button) => button.text() === '3').trigger('click')

    expect(wrapper.find('tbody').text()).toContain('Row 2')
  })

  it('disables the edges', () => {
    const wrapper = mountPaged()

    expect(wrapper.find('nav button[aria-label="First page"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('nav button[aria-label="Next page"]').attributes('disabled')).toBeUndefined()
  })

  it('reports the visible range', () => {
    expect(mountPaged().text()).toContain('Showing 1-1 of 12 results')
  })

  it('reports no results for an empty table', () => {
    const wrapper = mount(DtTable, {
      props: { data: [] },
      slots: { default: () => [h(DtColumn, { field: 'name', header: 'Name' })] },
    })

    expect(wrapper.text()).toContain('No results')
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
    const wrapper = mountPaged()

    await wrapper.findAll('nav button').find((button) => button.text() === '4').trigger('click')
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

  it('honours mono and bordered', () => {
    expect(mountTable({ mono: true }).find('table').classes()).toContain('font-mono')
    expect(mountTable({ bordered: true }).find('tbody tr').classes()).toContain('border-b')
  })

  it('shows the loading row', () => {
    expect(mountTable({ loading: true }).find('tbody').text()).toContain('Loading...')
  })

  it('shows the empty row', () => {
    const wrapper = mount(DtTable, {
      props: { data: [] },
      slots: { default: () => [h(DtColumn, { field: 'name', header: 'Name' })] },
    })

    expect(wrapper.find('tbody').text()).toContain('No entries found')
  })

  it('marks the sorted header with aria-sort', async () => {
    const wrapper = mountTable({}, [h(DtColumn, { field: 'name', header: 'Name', sortable: true })])

    expect(wrapper.find('thead th').attributes('aria-sort')).toBeUndefined()

    await wrapper.find('thead th').trigger('click')
    await nextTick()
    expect(wrapper.find('thead th').attributes('aria-sort')).toBe('ascending')

    await wrapper.find('thead th').trigger('click')
    await nextTick()
    expect(wrapper.find('thead th').attributes('aria-sort')).toBe('descending')
  })

  /*
   * TanStack sorts numeric columns descending on the first click; text
   * columns ascending. Documented rather than overridden.
   */
  it('sorts numeric columns descending first', async () => {
    const wrapper = mountTable({}, [h(DtColumn, { field: 'cases', header: 'Cases', sortable: true })])

    await wrapper.find('thead th').trigger('click')
    await nextTick()

    expect(wrapper.find('thead th').attributes('aria-sort')).toBe('descending')
  })

  it('omits the header bar when there is nothing to put in it', () => {
    const wrapper = mountTable()

    expect(wrapper.find('h3').exists()).toBe(false)
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
