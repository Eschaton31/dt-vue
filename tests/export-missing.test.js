import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'

import DtColumn from '../src/DtColumn.vue'
import DtTable from '../src/DtTable.vue'

// Stand in for the optional peer not being installed at all.
vi.mock('xlsx', () => {
  throw new Error("Cannot find module 'xlsx'")
})

function mountTable() {
  return mount(DtTable, {
    props: { data: [{ name: 'Alpha' }], exportable: true, title: 'Report' },
    slots: { default: () => [h(DtColumn, { field: 'name', header: 'Name' })] },
  })
}

describe('export without the xlsx peer', () => {
  it('rejects with an actionable message', async () => {
    await expect(mountTable().vm.exportXlsx()).rejects.toThrow(/optional "xlsx" peer dependency/)
  })

  it('emits export-error instead of throwing from the button', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = mountTable()

    await wrapper.findAll('button').find((button) => button.text() === 'Export').trigger('click')
    await nextTick()
    await new Promise((resolve) => setTimeout(resolve, 5))

    expect(wrapper.emitted('export-error')).toHaveLength(1)
    expect(wrapper.emitted('export-error')[0][0]).toBeInstanceOf(Error)

    error.mockRestore()
  })
})
