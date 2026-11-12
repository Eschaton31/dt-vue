import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { h, nextTick } from 'vue'

import DtColumn from '../src/DtColumn.vue'
import DtTable from '../src/DtTable.vue'

const ROWS = [
  { id: 1, name: 'Bravo', cases: 20 },
  { id: 2, name: 'Alpha', cases: 10 },
  { id: 3, name: 'Charlie', cases: 30 },
]

function mountTable(props = {}) {
  return mount(DtTable, {
    props: { data: ROWS, ...props },
    slots: {
      default: () => [
        h(DtColumn, { field: 'name', header: 'Name', sortable: true, type: 'category' }),
        h(DtColumn, { field: 'cases', header: 'Cases', type: 'number' }),
      ],
    },
  })
}

const firstColumn = (wrapper) => wrapper.findAll('thead th')[0]
const names = (wrapper) => wrapper.findAll('tbody tr').map((row) => row.find('td').text())

describe('keyboard sorting', () => {
  it('makes a sortable header label a real button filling the cell', () => {
    const th = firstColumn(mountTable())
    const button = th.find('button')

    expect(button.exists()).toBe(true)
    expect(button.attributes('type')).toBe('button')
    expect(button.classes()).toEqual(
      expect.arrayContaining([
        'flex',
        'w-full',
        'items-center',
        'gap-1',
        'rounded-lg',
        'px-3',
        'py-2',
        'focus-visible:ring-2',
        'focus-visible:ring-inset',
        'focus-visible:ring-[var(--dt-focus-ring)]',
        'hover:text-gray-900',
      ])
    )
    // The button carries the padding, so the cell has none.
    expect(th.classes()).toContain('p-0')
    expect(th.classes()).not.toContain('px-3')
  })

  it('keeps the label span that centres numeric headers, and the arrow', () => {
    const button = firstColumn(mountTable()).find('button')

    expect(button.find('span').text()).toBe('Name')
    expect(button.find('span').classes()).toContain('flex-1')
    expect(button.find('svg').exists()).toBe(true)
  })

  it('leaves a non-sortable header as plain text, with the padding on the cell', () => {
    const th = mountTable().findAll('thead th')[1]

    expect(th.find('button').exists()).toBe(false)
    expect(th.text()).toBe('Cases')
    expect(th.classes()).toEqual(expect.arrayContaining(['px-3', 'py-2']))
    expect(th.classes()).not.toContain('p-0')
  })

  it('sorts through the cycle on click, with aria-sort on the cell', async () => {
    const wrapper = mountTable()

    expect(firstColumn(wrapper).attributes('aria-sort')).toBeUndefined()

    await firstColumn(wrapper).find('button').trigger('click')
    expect(firstColumn(wrapper).attributes('aria-sort')).toBe('ascending')
    expect(names(wrapper)).toEqual(['Alpha', 'Bravo', 'Charlie'])

    await firstColumn(wrapper).find('button').trigger('click')
    expect(firstColumn(wrapper).attributes('aria-sort')).toBe('descending')
    expect(names(wrapper)).toEqual(['Charlie', 'Bravo', 'Alpha'])

    await firstColumn(wrapper).find('button').trigger('click')
    expect(firstColumn(wrapper).attributes('aria-sort')).toBeUndefined()
  })

  /*
   * A real browser turns Enter or Space on a focused button into a click, so the
   * table needs no key handler of its own; one would sort twice per key press.
   */
  it('has no key handler: a bare keydown does not sort', async () => {
    const wrapper = mountTable()
    const button = firstColumn(wrapper).find('button')

    await button.trigger('keydown', { key: 'Enter' })
    await button.trigger('keydown', { key: ' ' })
    await nextTick()

    expect(firstColumn(wrapper).attributes('aria-sort')).toBeUndefined()
  })

  it('does nothing when the cell outside the button is clicked', async () => {
    const wrapper = mountTable()

    await firstColumn(wrapper).trigger('click')
    await nextTick()

    expect(firstColumn(wrapper).attributes('aria-sort')).toBeUndefined()
  })

  it('makes a column that is only sorted programmatically a button too', () => {
    const wrapper = mount(DtTable, {
      props: { data: ROWS, sortField: 'cases' },
      slots: { default: () => [h(DtColumn, { field: 'cases', header: 'Cases', type: 'number' })] },
    })

    expect(wrapper.find('thead th button').exists()).toBe(true)
    expect(wrapper.find('thead th').attributes('aria-sort')).toBe('ascending')
  })

  it('does not make the selection or expander header a button', () => {
    const wrapper = mount(DtTable, {
      props: { data: [{ id: 1, name: 'A', children: [{ id: 2, name: 'B' }] }], selectable: true, rowId: 'id' },
      slots: { default: () => [h(DtColumn, { field: 'name', header: 'Name' })] },
    })

    const [expander, selection] = wrapper.findAll('thead th')

    expect(expander.find('button').exists()).toBe(false)
    expect(selection.find('button').exists()).toBe(false)
    expect(selection.find('input[type="checkbox"]').exists()).toBe(true)
  })
})
