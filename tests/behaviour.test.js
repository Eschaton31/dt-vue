import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'

import DtColumn from '../src/DtColumn.vue'
import DtTable from '../src/DtTable.vue'

const ROWS = [
  { id: 1, name: 'Alpha', cases: 1234 },
  { id: 2, name: 'Bravo', cases: 99 },
  { id: 3, name: 'Charlie', cases: 50 },
]

const NESTED = [
  {
    id: 1,
    name: 'Alpha',
    children: [
      { id: 11, name: 'Alpha child' },
      { id: 12, name: 'Alpha other child' },
    ],
  },
  { id: 2, name: 'Bravo' },
]

const nameColumn = () => h(DtColumn, { field: 'name', header: 'Name', type: 'category' })
const casesColumn = () => h(DtColumn, { field: 'cases', header: 'Cases', type: 'number' })

function mountTable(props = {}, columns = [nameColumn(), casesColumn()]) {
  return mount(DtTable, {
    props: { data: ROWS, locale: 'en-US', ...props },
    slots: { default: () => columns },
    attachTo: document.body,
  })
}

const flushDebounce = async (ms = 5) => {
  await new Promise((resolve) => setTimeout(resolve, ms))
  await nextTick()
}

describe('nested rows', () => {
  /*
   * The expander used to require row-id, so nested rows rendered with no
   * way to expand them.
   */
  it('renders an expander without row-id', () => {
    const wrapper = mount(DtTable, {
      props: { data: NESTED },
      slots: { default: () => [nameColumn()] },
    })

    expect(wrapper.find('button[aria-label="Expand row"]').exists()).toBe(true)
  })

  it('expands on click', async () => {
    const wrapper = mount(DtTable, {
      props: { data: NESTED },
      slots: { default: () => [nameColumn()] },
    })

    expect(wrapper.findAll('tbody tr')).toHaveLength(2)

    await wrapper.find('button[aria-label="Expand row"]').trigger('click')

    expect(wrapper.findAll('tbody tr')).toHaveLength(4)
  })

  it('can be switched off', () => {
    const wrapper = mount(DtTable, {
      props: { data: NESTED, expandable: false },
      slots: { default: () => [nameColumn()] },
    })

    expect(wrapper.find('button[aria-label="Expand row"]').exists()).toBe(false)
  })
})

describe('selection v-model', () => {
  it('applies an incoming selection on mount', () => {
    const wrapper = mountTable({ selectable: true, rowId: 'id', modelValue: [2] })

    const checked = wrapper.findAll('tbody input[type="checkbox"]').map((input) => input.element.checked)

    expect(checked).toEqual([false, true, false])
  })

  it('applies a selection set from outside after mount', async () => {
    const wrapper = mountTable({ selectable: true, rowId: 'id', modelValue: [] })

    await wrapper.setProps({ modelValue: [1, 3] })

    const checked = wrapper.findAll('tbody input[type="checkbox"]').map((input) => input.element.checked)

    expect(checked).toEqual([true, false, true])
  })

  it('emits the selection when a row is clicked', async () => {
    const wrapper = mountTable({ selectable: true, rowId: 'id', modelValue: [] })

    await wrapper.findAll('tbody tr')[0].findAll('td')[1].trigger('click')

    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([[1]])
  })

  it('emits whole rows when there is no row-id', async () => {
    const wrapper = mountTable({ selectable: true, modelValue: [] })

    await wrapper.findAll('tbody tr')[1].findAll('td')[1].trigger('click')

    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([[ROWS[1]]])
  })

  it('does not clobber an initial selection with an empty array', () => {
    const wrapper = mountTable({ selectable: true, rowId: 'id', modelValue: [2] })

    const emitted = wrapper.emitted('update:modelValue') ?? []

    expect(emitted.every(([value]) => value.length > 0)).toBe(true)
  })

  it('does not loop between the two directions', async () => {
    const wrapper = mountTable({ selectable: true, rowId: 'id', modelValue: [] })

    await wrapper.findAll('tbody tr')[0].findAll('td')[1].trigger('click')
    await nextTick()

    expect(wrapper.emitted('update:modelValue')).toHaveLength(1)
  })
})

describe('row click delegation', () => {
  /*
   * A link inside a #body slot used to both navigate and toggle the row.
   */
  it('ignores clicks on interactive cell content', async () => {
    const wrapper = mountTable({ selectable: true, rowId: 'id', modelValue: [] }, [
      h(DtColumn, { field: 'name', header: 'Name' }, { body: ({ value }) => h('a', { href: '#' }, value) }),
    ])

    await wrapper.find('tbody a').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('still selects when the cell text itself is clicked', async () => {
    const wrapper = mountTable({ selectable: true, rowId: 'id', modelValue: [] })

    await wrapper.findAll('tbody tr')[0].findAll('td')[1].trigger('click')

    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([[1]])
  })

  it('leaves rows alone when the table is not selectable', async () => {
    const wrapper = mountTable()

    await wrapper.findAll('tbody tr')[0].findAll('td')[0].trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
})

describe('global search', () => {
  it('matches the formatted text the user can see', async () => {
    const wrapper = mountTable({ searchDebounce: 0 })

    await wrapper.find('input[type="search"]').setValue('1,234')
    await flushDebounce()

    const names = wrapper.findAll('tbody tr').map((row) => row.findAll('td')[0].text())

    expect(names).toEqual(['Alpha'])
  })

  it('still matches the raw value', async () => {
    const wrapper = mountTable({ searchDebounce: 0 })

    await wrapper.find('input[type="search"]').setValue('1234')
    await flushDebounce()

    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
  })

  it('can be switched off', () => {
    expect(mountTable({ searchable: false }).find('input[type="search"]').exists()).toBe(false)
  })
})

describe('pagination', () => {
  it('reacts to a changed rows prop', async () => {
    const wrapper = mountTable({ rows: 2 })

    expect(wrapper.findAll('tbody tr')).toHaveLength(2)

    await wrapper.setProps({ rows: 3 })

    expect(wrapper.findAll('tbody tr')).toHaveLength(3)
  })

  it('offers the configured page sizes', () => {
    const wrapper = mountTable({ pageSizes: [5, 500] })

    expect(wrapper.findAll('select option').map((option) => option.text())).toEqual(['Show 5', 'Show 500'])
  })
})

describe('external sorting', () => {
  it('sorts by sort-field even when the column is not user-sortable', () => {
    const wrapper = mountTable({ sortField: 'cases', sortOrder: 1 })

    expect(wrapper.findAll('tbody tr').map((row) => row.findAll('td')[0].text())).toEqual([
      'Charlie',
      'Bravo',
      'Alpha',
    ])
  })

  it('honours a descending sort-order', () => {
    const wrapper = mountTable({ sortField: 'cases', sortOrder: -1 })

    expect(wrapper.findAll('tbody tr').map((row) => row.findAll('td')[0].text())).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
    ])
  })
})

describe('labels', () => {
  it('can be overridden', () => {
    const wrapper = mount(DtTable, {
      props: { data: [], labels: { empty: 'Walang laman' } },
      slots: { default: () => [nameColumn()] },
    })

    expect(wrapper.find('tbody').text()).toContain('Walang laman')
  })
})

describe('drag selection cleanup', () => {
  it('removes the document listener when unmounted mid-drag', async () => {
    const wrapper = mountTable({ selectable: true, rowId: 'id', modelValue: [] })

    await wrapper.findAll('tbody tr')[0].trigger('mousedown', { button: 0 })

    const before = document.addEventListener.length

    wrapper.unmount()

    // A mouseup after unmount must not reach a handler touching a dead table.
    expect(() => document.dispatchEvent(new MouseEvent('mouseup'))).not.toThrow()
    expect(before).toBeDefined()
  })
})
