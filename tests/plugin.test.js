import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createApp, h } from 'vue'

import DtVue, { DEFAULT_HEATMAP_SCALE, DtColumn, DtTable, createFormatter, heatmap } from '../src/index.js'

describe('package entry point', () => {
  it('exports the components and helpers', () => {
    expect(DtTable).toBeTruthy()
    expect(DtColumn.name).toBe('DtColumn')
    expect(typeof heatmap).toBe('function')
    expect(typeof createFormatter).toBe('function')
    expect(Array.isArray(DEFAULT_HEATMAP_SCALE)).toBe(true)
  })

  it('registers both components globally', () => {
    const app = createApp({ render: () => null })

    app.use(DtVue)

    expect(app.component('DtTable')).toBe(DtTable)
    expect(app.component('DtColumn')).toBe(DtColumn)
  })

  it('honours a name prefix', () => {
    const app = createApp({ render: () => null })

    app.use(DtVue, { prefix: 'X' })

    expect(app.component('XDtTable')).toBe(DtTable)
    expect(app.component('DtTable')).toBeUndefined()
  })

  it('renders through the globally registered names', () => {
    const wrapper = mount(
      {
        template: '<DtTable :data="rows"><DtColumn field="name" header="Name" /></DtTable>',
        data: () => ({ rows: [{ name: 'Alpha' }] }),
      },
      { global: { plugins: [DtVue] } }
    )

    expect(wrapper.find('thead th span').text()).toBe('Name')
    expect(wrapper.find('tbody td').text()).toBe('Alpha')
  })

  it('renders a heatmapped column end to end', () => {
    const wrapper = mount(DtTable, {
      props: { data: [{ rate: 100 }] },
      slots: {
        default: () => [h(DtColumn, { field: 'rate', type: 'percent', cellStyle: heatmap() })],
      },
    })

    expect(wrapper.find('tbody td').attributes('style')).toBeTruthy()
    expect(wrapper.find('tbody td').text()).toBe('100.00%')
  })
})
