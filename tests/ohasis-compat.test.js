/*
 * Verifies the compatibility shim that lets the OHASIS pages keep their old
 * <TanstackTable> / <TanstackColumn> API while running on dt-vue.
 *
 * It imports the real shim out of the sibling checkout rather than a copy, so
 * it cannot drift. Skipped when that checkout is not present.
 */
import { mount } from '@vue/test-utils'
import { existsSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'

const OHASIS = 'C:/laragon/www/ohasis/resources/js/components/charts'

const available = existsSync(`${OHASIS}/TanstackTable.vue`)

const describeIf = available ? describe : describe.skip

const DATA = [
  { id: 1, name: 'Alpha', cases: 1234, rate: 95, region: 'NCR' },
  { id: 2, name: 'Bravo', cases: 99, rate: 5, region: 'VII' },
]

const load = async () => ({
  Table: (await import(/* @vite-ignore */ `${OHASIS}/TanstackTable.vue`)).default,
  Column: (await import(/* @vite-ignore */ `${OHASIS}/TanstackColumn.vue`)).default,
})

const headers = (wrapper) => wrapper.findAll('thead th span').map((node) => node.text())

describeIf('OHASIS compatibility shim', () => {
  it('renders the legacy :columns object', async () => {
    const { Table } = await load()

    const wrapper = mount(Table, {
      props: { data: DATA, columns: { name: 'category', cases: 'number' } },
    })

    expect(headers(wrapper)).toEqual(['name', 'cases'])
    expect(wrapper.find('tbody').text()).toContain('1,234')
  })

  it('keeps legacy columns sortable', async () => {
    const { Table } = await load()

    const wrapper = mount(Table, { props: { data: DATA, columns: { cases: 'number' } } })

    expect(wrapper.find('thead th').classes()).toContain('cursor-pointer')
  })

  it('maps accomplishment to a shaded percent column', async () => {
    const { Table } = await load()

    const wrapper = mount(Table, { props: { data: DATA, columns: { rate: 'accomplishment' } } })

    const cells = wrapper.findAll('tbody td')

    expect(cells[0].text()).toBe('95.00%')
    expect(cells[0].attributes('style')).toContain('background-color')
    // 95% lands in the top bucket, 5% in the bottom one.
    expect(cells[0].attributes('style')).not.toBe(cells[1].attributes('style'))
  })

  /*
   * The shim puts <slot /> inside DtTable's own default slot, so these vnodes
   * reach the column reader through an extra Fragment.
   */
  it('renders <TanstackColumn> children declared by the page', async () => {
    const { Table, Column } = await load()

    const wrapper = mount(Table, {
      props: { data: DATA },
      slots: {
        default: () => [
          h(Column, { field: 'name', header: 'Facility' }),
          h(Column, { field: 'region', header: 'Region' }),
        ],
      },
    })

    expect(headers(wrapper)).toEqual(['Facility', 'Region'])
  })

  it('supports a #body slot on a shim column', async () => {
    const { Table, Column } = await load()

    const wrapper = mount(Table, {
      props: { data: DATA },
      slots: {
        default: () => [h(Column, { field: 'name', header: 'Name' }, { body: ({ data }) => h('b', data.name) })],
      },
    })

    expect(wrapper.find('tbody td b').text()).toBe('Alpha')
  })

  it('renders legacy columns before slot columns', async () => {
    const { Table, Column } = await load()

    const wrapper = mount(Table, {
      props: { data: DATA, columns: { cases: 'number' } },
      slots: { default: () => [h(Column, { field: 'name', header: 'Name' })] },
    })

    expect(headers(wrapper)).toEqual(['cases', 'Name'])
  })

  it('shows Export for actions and Fetch for fetch', async () => {
    const { Table } = await load()

    const wrapper = mount(Table, {
      props: { data: DATA, columns: { name: 'category' }, actions: true, fetch: true, title: 'Report' },
    })

    const labels = wrapper.findAll('button').map((button) => button.text())

    expect(labels).toContain('Export')
    expect(labels).toContain('Fetch')
  })

  it('emits fetch from the Fetch button', async () => {
    const { Table } = await load()

    const wrapper = mount(Table, {
      props: { data: DATA, columns: { name: 'category' }, actions: true, fetch: true },
    })

    await wrapper.findAll('button').find((button) => button.text() === 'Fetch').trigger('click')

    expect(wrapper.emitted('fetch')).toHaveLength(1)
  })

  it('hides Fetch when actions is off', async () => {
    const { Table } = await load()

    const wrapper = mount(Table, {
      props: { data: DATA, columns: { name: 'category' }, fetch: true },
    })

    expect(wrapper.findAll('button').map((button) => button.text())).not.toContain('Fetch')
  })

  it('renders the #menu slot', async () => {
    const { Table } = await load()

    const wrapper = mount(Table, {
      props: { data: DATA, columns: { name: 'category' }, actions: true },
      slots: { menu: () => h('button', 'Custom menu') },
    })

    expect(wrapper.findAll('button').map((button) => button.text())).toContain('Custom menu')
  })

  it('renders the #title slot', async () => {
    const { Table } = await load()

    const wrapper = mount(Table, {
      props: { data: DATA, columns: { name: 'category' }, title: 'Prop' },
      slots: { title: () => h('h2', 'Slot heading') },
    })

    expect(wrapper.text()).toContain('Slot heading')
  })

  it('exposes downloadXl, table and the selection helpers', async () => {
    const { Table } = await load()

    const wrapper = mount(Table, {
      props: { data: DATA, columns: { name: 'category' }, rowId: 'id', selectable: true, modelValue: [1] },
    })

    expect(typeof wrapper.vm.downloadXl).toBe('function')
    expect(typeof wrapper.vm.table.getState).toBe('function')
    expect(wrapper.vm.getSelectedRows()).toEqual([DATA[0]])

    wrapper.vm.resetSelection()
    await nextTick()

    expect(wrapper.vm.getSelectedRows()).toEqual([])
  })

  it('passes selection back through v-model', async () => {
    const { Table } = await load()

    const wrapper = mount(Table, {
      props: { data: DATA, columns: { name: 'category' }, rowId: 'id', selectable: true, modelValue: [] },
      attachTo: document.body,
    })

    await wrapper.findAll('tbody tr')[1].findAll('td')[1].trigger('click')

    expect(wrapper.emitted('update:modelValue').at(-1)).toEqual([[2]])
  })

  it('reacts to a column list that changes at runtime', async () => {
    const { Table } = await load()

    const wrapper = mount(Table, { props: { data: DATA, columns: { name: 'category' } } })

    expect(headers(wrapper)).toEqual(['name'])

    await wrapper.setProps({ columns: { name: 'category', cases: 'number' } })

    expect(headers(wrapper)).toEqual(['name', 'cases'])
  })

  it('paginates past page one', async () => {
    const { Table } = await load()

    const many = Array.from({ length: 12 }, (_, index) => ({ id: index, name: `Row ${index}` }))

    const wrapper = mount(Table, { props: { data: many, columns: { name: 'category' }, rows: 1 } })

    await wrapper.find('nav button[aria-label="Next page"]').trigger('click')
    await nextTick()

    expect(wrapper.find('tbody').text()).toContain('Row 1')
  })

})

/*
 * The tests above drive the shim with render-function slots, which is not how
 * OHASIS uses it. These drive it through a compiled template, the way a real
 * page does.
 */
describeIf('OHASIS shim, used from a page template', () => {
  const load = async () => (await import('./fixtures/OhasisPage.vue')).default

  it('renders legacy and declared columns together, in order', async () => {
    const Page = await load()

    const wrapper = mount(Page, { props: { data: DATA, columns: { rate: 'accomplishment' } } })

    expect(headers(wrapper)).toEqual(['rate', 'Facility', 'Region', 'Cases'])
  })

  it('renders a #body slot through two levels of forwarding', async () => {
    const Page = await load()

    const wrapper = mount(Page, { props: { data: DATA } })

    expect(wrapper.find('tbody td strong').text()).toBe('Alpha')
  })

  it('keeps v-if column position across a toggle', async () => {
    const Page = await load()

    const wrapper = mount(Page, { props: { data: DATA } })
    expect(headers(wrapper)).toEqual(['Facility', 'Region', 'Cases'])

    await wrapper.setProps({ showRegion: false })
    expect(headers(wrapper)).toEqual(['Facility', 'Cases'])

    await wrapper.setProps({ showRegion: true })
    expect(headers(wrapper)).toEqual(['Facility', 'Region', 'Cases'])
  })

  it('renders the header bar, totals and the menu slot', async () => {
    const Page = await load()

    const wrapper = mount(Page, { props: { data: DATA } })
    const labels = wrapper.findAll('button').map((button) => button.text())

    expect(labels).toContain('Export')
    expect(labels).toContain('Fetch')
    expect(labels).toContain('Menu action')
    expect(wrapper.find('tfoot').text()).toContain('1,333')
  })

  it('bubbles fetch up to the page', async () => {
    const Page = await load()

    const wrapper = mount(Page, { props: { data: DATA } })

    await wrapper.findAll('button').find((button) => button.text() === 'Fetch').trigger('click')

    expect(wrapper.emitted('fetch')).toHaveLength(1)
  })

  it('mounts without Vue warnings', async () => {
    const Page = await load()

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    mount(Page, { props: { data: DATA, columns: { rate: 'accomplishment' } } })

    const vueWarnings = warn.mock.calls.map(([first]) => String(first)).filter((text) => text.includes('[Vue warn]'))

    warn.mockRestore()

    expect(vueWarnings).toEqual([])
  })
})
