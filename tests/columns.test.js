import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import DtColumn from '../src/DtColumn.vue'
import DtTable from '../src/DtTable.vue'
import { normalizeColumnProps, readColumnsFromSlot } from '../src/lib/columns.js'

const DATA = [
  { id: 1, name: 'Alpha', email: 'a@example.org', cases: 10 },
  { id: 2, name: 'Bravo', email: 'b@example.org', cases: 20 },
]

function headers(wrapper) {
  return wrapper.findAll('thead th span').map((node) => node.text())
}

describe('normalizeColumnProps', () => {
  it('camelises kebab-case vnode props', () => {
    expect(normalizeColumnProps({ field: 'a', 'cell-style': 'x' }).cellStyle).toBe('x')
  })

  it('coerces shorthand booleans, which arrive as the empty string', () => {
    const props = normalizeColumnProps({ field: 'a', sortable: '', fit: '' })

    expect(props.sortable).toBe(true)
    expect(props.fit).toBe(true)
  })

  it('leaves explicit false alone', () => {
    expect(normalizeColumnProps({ field: 'a', sortable: false }).sortable).toBe(false)
  })

  it('defaults exportable to true but honours an explicit false', () => {
    expect(normalizeColumnProps({ field: 'a' }).exportable).toBe(true)
    expect(normalizeColumnProps({ field: 'a', exportable: false }).exportable).toBe(false)
  })

  it('applies defaults the uninstantiated component cannot', () => {
    const props = normalizeColumnProps({ field: 'a' })

    expect(props.type).toBe('string')
    expect(props.sortable).toBe(false)
    expect(props.width).toBeNull()
  })

  it('falls back to the field for a missing header', () => {
    expect(normalizeColumnProps({ field: 'cases' }).header).toBe('cases')
  })
})

describe('readColumnsFromSlot', () => {
  it('returns an empty list when there is no slot', () => {
    expect(readColumnsFromSlot(undefined)).toEqual([])
  })

  it('flattens fragments and skips comments and non-column nodes', () => {
    const slot = () => [
      h(DtColumn, { field: 'a' }),
      [h(DtColumn, { field: 'b' }), h(DtColumn, { field: 'c' })],
      h('div', 'not a column'),
    ]

    expect(readColumnsFromSlot(slot).map((column) => column.props.field)).toEqual(['a', 'b', 'c'])
  })

  it('captures the #body slot', () => {
    const slot = () => [h(DtColumn, { field: 'a' }, { body: () => 'x' })]

    expect(typeof readColumnsFromSlot(slot)[0].slots.body).toBe('function')
  })
})

describe('DtTable column order', () => {
  let warn

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    const vueWarnings = warn.mock.calls.map(([first]) => String(first)).filter((text) => text.includes('[Vue warn]'))

    warn.mockRestore()

    // Render-function consumers must not see the "slot invoked outside of
    // the render function" false positive either.
    expect(vueWarnings).toEqual([])
  })

  it('renders columns in declaration order', () => {
    const wrapper = mount(DtTable, {
      props: { data: DATA },
      slots: {
        default: () => [
          h(DtColumn, { field: 'name', header: 'Name' }),
          h(DtColumn, { field: 'email', header: 'Email' }),
          h(DtColumn, { field: 'cases', header: 'Cases' }),
        ],
      },
    })

    expect(headers(wrapper)).toEqual(['Name', 'Email', 'Cases'])
  })

  /*
   * The regression that motivated dropping provide/inject registration:
   * a column removed and re-added by v-if used to re-register at the end.
   */
  it('keeps position when a column is toggled off and back on', async () => {
    const showEmail = ref(true)

    const Host = defineComponent({
      setup() {
        return () =>
          h(DtTable, { data: DATA }, {
            default: () => [
              h(DtColumn, { field: 'name', header: 'Name' }),
              showEmail.value ? h(DtColumn, { field: 'email', header: 'Email' }) : null,
              h(DtColumn, { field: 'cases', header: 'Cases' }),
            ],
          })
      },
    })

    const wrapper = mount(Host)
    expect(headers(wrapper)).toEqual(['Name', 'Email', 'Cases'])

    showEmail.value = false
    await nextTick()
    expect(headers(wrapper)).toEqual(['Name', 'Cases'])

    showEmail.value = true
    await nextTick()
    expect(headers(wrapper)).toEqual(['Name', 'Email', 'Cases'])
  })

  it('tracks reactive column props', async () => {
    const header = ref('Cases')

    const Host = defineComponent({
      setup() {
        return () =>
          h(DtTable, { data: DATA }, {
            default: () => [h(DtColumn, { field: 'cases', header: header.value })],
          })
      },
    })

    const wrapper = mount(Host)
    expect(headers(wrapper)).toEqual(['Cases'])

    header.value = 'Total cases'
    await nextTick()
    expect(headers(wrapper)).toEqual(['Total cases'])
  })

  it('renders a #body slot with the row context', () => {
    const wrapper = mount(DtTable, {
      props: { data: [{ name: 'Alpha' }] },
      slots: {
        default: () => [h(DtColumn, { field: 'name', header: 'Name' }, { body: ({ value }) => h('b', `~${value}~`) })],
      },
    })

    expect(wrapper.find('tbody td b').text()).toBe('~Alpha~')
  })
})

describe('DtTable duplicate fields', () => {
  it('warns about a duplicate field', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    mount(DtTable, {
      props: { data: DATA },
      slots: {
        default: () => [h(DtColumn, { field: 'name' }), h(DtColumn, { field: 'name' })],
      },
    })

    expect(warn.mock.calls.some(([text]) => String(text).includes('duplicate column field "name"'))).toBe(true)

    warn.mockRestore()
  })
})
