import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TemplateHost from './fixtures/TemplateHost.vue'

const DATA = [
  { id: 1, name: 'Alpha', email: 'a@example.org', cases: 10, region: 'NCR' },
  { id: 2, name: 'Bravo', email: 'b@example.org', cases: 20, region: 'VII' },
]

function headers(wrapper) {
  return wrapper.findAll('thead th span').map((node) => node.text())
}

describe('template usage (compiled slots)', () => {
  let warn

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  it('reads columns declared in a template', () => {
    const wrapper = mount(TemplateHost, { props: { data: DATA } })

    expect(headers(wrapper)).toEqual(['Name', 'Email', 'Cases'])
  })

  it('keeps v-if column position across a toggle', async () => {
    const wrapper = mount(TemplateHost, { props: { data: DATA } })

    await wrapper.setProps({ showEmail: false })
    expect(headers(wrapper)).toEqual(['Name', 'Cases'])

    await wrapper.setProps({ showEmail: true })
    expect(headers(wrapper)).toEqual(['Name', 'Email', 'Cases'])
  })

  it('appends v-for columns in order', async () => {
    const wrapper = mount(TemplateHost, { props: { data: DATA, extra: ['region'] } })

    expect(headers(wrapper)).toEqual(['Name', 'Email', 'Cases', 'region'])

    await wrapper.setProps({ extra: [] })
    expect(headers(wrapper)).toEqual(['Name', 'Email', 'Cases'])
  })

  it('emits no Vue warnings', () => {
    mount(TemplateHost, { props: { data: DATA } })

    const vueWarnings = warn.mock.calls.map(([first]) => String(first)).filter((text) => text.includes('[Vue warn]'))

    expect(vueWarnings).toEqual([])
  })
})
