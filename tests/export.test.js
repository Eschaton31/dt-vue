import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'

import DtColumn from '../src/DtColumn.vue'
import DtTable from '../src/DtTable.vue'

const sheets = []

vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: (rows) => {
      sheets.push(rows)
      return { rows }
    },
    book_new: () => ({ sheets: [] }),
    book_append_sheet: (workbook, worksheet, name) => workbook.sheets.push({ worksheet, name }),
  },
  writeFile: vi.fn(),
}))

const DATA = [
  { id: 1, name: 'Alpha', cases: 1234, seen: '2026-01-05T00:00:00Z', secret: 'hide me' },
  { id: 2, name: 'Bravo', cases: 99, seen: '2026-02-05T00:00:00Z', secret: 'hide me too' },
]

function mountTable(props = {}) {
  return mount(DtTable, {
    props: { data: DATA, locale: 'en-US', title: 'My Report', ...props },
    slots: {
      default: () => [
        h(DtColumn, { field: 'name', header: 'Facility', type: 'category' }),
        h(DtColumn, { field: 'cases', header: 'Cases', type: 'number' }),
        h(DtColumn, { field: 'seen', header: 'Last seen', type: 'date' }),
        h(DtColumn, { field: 'secret', header: 'Secret', exportable: false }),
      ],
    },
  })
}

describe('xlsx export', () => {
  beforeEach(() => {
    sheets.length = 0
  })

  it('writes column headers, not field names', async () => {
    await mountTable().vm.exportXlsx()

    expect(sheets[0][0]).toEqual(['Facility', 'Cases', 'Last seen'])
  })

  it('omits columns marked exportable="false"', async () => {
    await mountTable().vm.exportXlsx()

    expect(sheets[0][0]).not.toContain('Secret')
    expect(sheets[0][1]).not.toContain('hide me')
  })

  it('writes numbers and dates as real values, not strings', async () => {
    await mountTable().vm.exportXlsx()

    const [, firstRow] = sheets[0]

    expect(firstRow[1]).toBe(1234)
    expect(firstRow[2]).toBeInstanceOf(Date)
  })

  /*
   * The export used to serialise the raw `data` prop, so what came out had
   * nothing to do with what the user had filtered down to.
   */
  it('respects the active search', async () => {
    const wrapper = mountTable({ searchDebounce: 0 })

    await wrapper.find('input[type="search"]').setValue('Bravo')
    await new Promise((resolve) => setTimeout(resolve, 5))
    await nextTick()

    await wrapper.vm.exportXlsx()

    expect(sheets[0]).toHaveLength(2)
    expect(sheets[0][1][0]).toBe('Bravo')
  })

  it('respects the active sort', async () => {
    const wrapper = mountTable({ sortField: 'cases', sortOrder: 1 })

    await wrapper.vm.exportXlsx()

    expect(sheets[0].slice(1).map((row) => row[0])).toEqual(['Bravo', 'Alpha'])
  })

  it('includes nested rows under their parent', async () => {
    const wrapper = mount(DtTable, {
      props: {
        data: [{ id: 1, name: 'Alpha', children: [{ id: 11, name: 'Alpha child' }] }, { id: 2, name: 'Bravo' }],
      },
      slots: { default: () => [h(DtColumn, { field: 'name', header: 'Name' })] },
    })

    await wrapper.vm.exportXlsx()

    expect(sheets[0].slice(1).map((row) => row[0])).toEqual(['Alpha', 'Alpha child', 'Bravo'])
  })
})
