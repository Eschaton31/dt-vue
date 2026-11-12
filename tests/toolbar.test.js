import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { h, nextTick } from 'vue'

import DtColumn from '../src/DtColumn.vue'
import DtTable from '../src/DtTable.vue'
import DtTooltip from '../src/DtTooltip.vue'

const ROWS = [
  { id: 1, name: 'Alpha', region: 'NCR', cases: 100 },
  { id: 2, name: 'Bravo', region: 'NCR', cases: 200 },
  { id: 3, name: 'Charlie', region: 'VII', cases: 30 },
]

const mounted = []

function mountTable(props = {}, slots = {}) {
  const wrapper = mount(DtTable, {
    props: { data: ROWS, locale: 'en-US', ...props },
    slots: {
      default: () => [
        h(DtColumn, { field: 'name', header: 'Name' }),
        h(DtColumn, { field: 'region', header: 'Region' }),
      ],
      ...slots,
    },
    attachTo: document.body,
  })

  mounted.push(wrapper)

  return wrapper
}

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.useRealTimers()
})

const GROUP_BY = { Region: ['region'], Name: ['name'] }

const exportButton = (wrapper) => wrapper.find('button[aria-label="Export to Excel"]')

describe('header bar layout', () => {
  it('is one wrapping row with the title on the left', () => {
    const wrapper = mountTable({ title: 'Facilities' })

    const bar = wrapper.find('h3').element.closest('div.flex')

    expect(bar.className).toContain('flex-wrap')
    expect(bar.className).toContain('items-center')
    expect(bar.className).toContain('justify-between')
    expect(bar.firstElementChild.querySelector('h3').textContent.trim()).toBe('Facilities')
  })

  it('wraps the right-hand group and gives the search the full width on a phone', () => {
    const wrapper = mountTable({ title: 'Facilities', exportable: true })

    const group = wrapper.find('input[type="search"]').element.closest('.flex-wrap')

    ;['flex', 'w-full', 'flex-wrap', 'items-center', 'gap-2', 'sm:w-auto'].forEach((name) => {
      expect(group.classList.contains(name)).toBe(true)
    })
    expect(group.classList.contains('shrink-0')).toBe(false)
  })

  it('orders search, group-by toggles, verbs, then the #toolbar slot', () => {
    const wrapper = mountTable(
      { groupBy: GROUP_BY, exportable: true },
      { toolbar: () => h('button', { class: 'slotted', type: 'button' }, 'Slotted') }
    )

    const group = wrapper.find('input[type="search"]').element.closest('.flex-wrap')
    const kinds = [...group.children].map((child) => {
      if (child.querySelector('input[type="search"]')) {
        return 'search'
      }

      if (child.classList.contains('slotted')) {
        return 'slot'
      }

      if (child.getAttribute('aria-pressed') !== null) {
        return 'toggle'
      }

      return child.querySelector('button')?.getAttribute('aria-label') ?? 'other'
    })

    expect(kinds).toEqual(['search', 'toggle', 'toggle', 'Export to Excel', 'slot'])
  })

  it('passes the toolbar slot its props, unchanged', () => {
    let received

    mountTable({}, {
      toolbar: (props) => {
        received = props

        return null
      },
    })

    expect(Object.keys(received).sort()).toEqual(['clearGrouping', 'exportXlsx', 'grouping', 'setGrouping', 'table'])
  })

  it('renders for a #toolbar slot or a #title slot alone', () => {
    expect(mountTable({ searchable: false }, { toolbar: () => h('i', 'x') }).find('i').exists()).toBe(true)
    expect(mountTable({ searchable: false }, { title: () => h('h2', 'Slot') }).find('h2').exists()).toBe(true)
  })

  it('has no search row under the header any more', () => {
    const wrapper = mountTable({ title: 'Facilities' })

    expect(wrapper.findAll('input[type="search"]')).toHaveLength(1)
    expect(wrapper.find('input[type="search"]').element.closest('.px-4.pt-4')).toBeNull()
  })
})

describe('search', () => {
  it('marks the input so the stylesheet can hide the browser clear button', () => {
    expect(mountTable().find('input[type="search"]').classes()).toContain('dt-search')
  })

  it('is a search input with an icon, a width and the label as placeholder and name', () => {
    const wrapper = mountTable({ labels: { search: 'Find a facility' } })

    const input = wrapper.find('input[type="search"]')

    expect(input.attributes('placeholder')).toBe('Find a facility')
    expect(input.attributes('aria-label')).toBe('Find a facility')
    expect(input.classes()).toEqual(
      expect.arrayContaining(['h-8', 'w-full', 'rounded-lg', 'border', 'border-gray-300', 'bg-white', 'text-[13px]', 'pl-8', 'pr-2.5'])
    )
    expect(input.classes().some((name) => name.startsWith('shadow'))).toBe(false)
    expect(input.classes()).toEqual(
      expect.arrayContaining([
        'focus:border-[var(--dt-focus-border)]',
        'focus:ring-2',
        'focus:ring-[var(--dt-focus-ring)]',
      ])
    )

    const wrapperDiv = input.element.parentElement

    expect(wrapperDiv.classList.contains('relative')).toBe(true)
    expect(wrapperDiv.classList.contains('w-full')).toBe(true)
    expect(wrapperDiv.classList.contains('sm:w-60')).toBe(true)

    const icon = wrapperDiv.querySelector('svg')

    expect(icon.getAttribute('aria-hidden')).toBe('true')
    expect(icon.classList.contains('absolute')).toBe(true)
    expect(icon.classList.contains('left-2.5')).toBe(true)
    expect(icon.classList.contains('text-gray-400')).toBe(true)
  })

  it('defaults to the word Search', () => {
    expect(mountTable().find('input[type="search"]').attributes('placeholder')).toBe('Search')
  })

  it('filters after the debounce, as before', async () => {
    const wrapper = mountTable({ searchDebounce: 0 })

    await wrapper.find('input[type="search"]').setValue('alp')
    await new Promise((resolve) => setTimeout(resolve, 5))
    await nextTick()

    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
  })

  it('is absent when searchable is false', () => {
    expect(mountTable({ searchable: false }).find('input[type="search"]').exists()).toBe(false)
  })
})

describe('export verb', () => {
  it('is a ghost icon button named by its aria-label, with no visible text', () => {
    const button = exportButton(mountTable({ exportable: true }))

    expect(button.exists()).toBe(true)
    expect(button.text()).toBe('')
    expect(button.find('svg').attributes('aria-hidden')).toBe('true')
    expect(button.classes()).toEqual(
      expect.arrayContaining([
        'size-7',
        'rounded-lg',
        'text-gray-500',
        'hover:bg-gray-100',
        'hover:text-gray-900',
        'focus-visible:bg-gray-100',
        'focus-visible:text-gray-900',
        'focus-visible:ring-2',
        'focus-visible:ring-[var(--dt-focus-ring)]',
        'transition-colors',
        'duration-150',
        'ease-out',
      ])
    )
    expect(button.find('svg').classes()).toContain('size-4')
  })

  it('takes its name and tooltip from labels.export', () => {
    const wrapper = mountTable({ exportable: true, labels: { export: 'Download' } })

    expect(wrapper.find('button[aria-label="Download"]').exists()).toBe(true)
    expect(wrapper.findComponent(DtTooltip).props('text')).toBe('Download')
  })

  it('is absent unless exportable', () => {
    expect(exportButton(mountTable()).exists()).toBe(false)
  })
})

describe('group-by toggles and Clear grouping', () => {
  const toggle = (wrapper, label) => wrapper.findAll('button').find((button) => button.text() === label)

  it('keep their words and carry aria-pressed', async () => {
    const wrapper = mountTable({ groupBy: GROUP_BY })

    expect(toggle(wrapper, 'Group by Region').attributes('aria-pressed')).toBe('false')

    await toggle(wrapper, 'Group by Region').trigger('click')

    expect(toggle(wrapper, 'Group by Region').attributes('aria-pressed')).toBe('true')
    expect(toggle(wrapper, 'Group by Name').attributes('aria-pressed')).toBe('false')
  })

  it('use the rest and pressed recipes', async () => {
    const wrapper = mountTable({ groupBy: GROUP_BY })

    const rest = toggle(wrapper, 'Group by Region').classes()

    expect(rest).toEqual(
      expect.arrayContaining([
        'h-7',
        'rounded-lg',
        'border',
        'px-2.5',
        'text-xs',
        'font-semibold',
        'border-gray-300',
        'bg-white',
        'text-gray-700',
        'hover:bg-gray-50',
        'focus-visible:ring-[var(--dt-focus-ring)]',
      ])
    )

    await toggle(wrapper, 'Group by Region').trigger('click')

    const pressed = toggle(wrapper, 'Group by Region').classes()

    expect(pressed).toEqual(
      expect.arrayContaining([
        'border-[var(--dt-accent)]',
        'bg-[var(--dt-selected)]',
        'text-[var(--dt-accent-strong)]',
      ])
    )
    expect(pressed).not.toContain('border-gray-300')
    expect(pressed.some((name) => name.startsWith('shadow') || name.startsWith('hover:shadow'))).toBe(false)
  })

  it('clear grouping when a pressed toggle is clicked again', async () => {
    const wrapper = mountTable({ groupBy: GROUP_BY })

    await toggle(wrapper, 'Group by Region').trigger('click')
    expect(wrapper.vm.table.getState().grouping).toEqual(['region'])

    await toggle(wrapper, 'Group by Region').trigger('click')

    expect(wrapper.vm.table.getState().grouping).toEqual([])
    expect(toggle(wrapper, 'Group by Region').attributes('aria-pressed')).toBe('false')
    expect(wrapper.find('button[aria-label="Clear grouping"]').exists()).toBe(false)
  })

  it('switch from one grouping to another with one click', async () => {
    const wrapper = mountTable({ groupBy: GROUP_BY })

    await toggle(wrapper, 'Group by Region').trigger('click')
    await toggle(wrapper, 'Group by Name').trigger('click')

    expect(wrapper.vm.table.getState().grouping).toEqual(['name'])
  })

  it('show Clear grouping as a ghost icon button only while grouped', async () => {
    const wrapper = mountTable({ groupBy: GROUP_BY, labels: { clearGrouping: 'Ungroup' } })

    expect(wrapper.find('button[aria-label="Ungroup"]').exists()).toBe(false)

    await toggle(wrapper, 'Group by Region').trigger('click')

    const clear = wrapper.find('button[aria-label="Ungroup"]')

    expect(clear.exists()).toBe(true)
    expect(clear.text()).toBe('')
    expect(clear.classes()).toEqual(expect.arrayContaining(['size-7', 'rounded-lg', 'text-gray-500']))
    expect(clear.find('svg').classes()).toContain('size-4')
    expect(wrapper.findAllComponents(DtTooltip).some((tip) => tip.props('text') === 'Ungroup')).toBe(true)
  })

  it('hand focus to the first group-by toggle after Clear grouping', async () => {
    const wrapper = mountTable({ groupBy: GROUP_BY })

    await toggle(wrapper, 'Group by Name').trigger('click')

    const clear = wrapper.find('button[aria-label="Clear grouping"]')

    clear.element.focus()
    expect(document.activeElement).toBe(clear.element)

    await clear.trigger('click')
    await nextTick()

    expect(document.activeElement).toBe(toggle(wrapper, 'Group by Region').element)
  })
})

describe('DtTooltip', () => {
  const mountTip = () => {
    const wrapper = mount(DtTooltip, {
      props: { text: 'Export to Excel' },
      slots: { default: () => h('button', { type: 'button' }, 'Trigger') },
      attachTo: document.body,
    })

    mounted.push(wrapper)

    return wrapper
  }

  const label = (wrapper) => wrapper.find('span[aria-hidden="true"]')
  const isOpen = (wrapper) => label(wrapper).classes().includes('opacity-100')

  it('is hidden from assistive tech and closed to begin with, but always mounted', () => {
    const wrapper = mountTip()

    expect(label(wrapper).exists()).toBe(true)
    expect(label(wrapper).attributes('aria-hidden')).toBe('true')
    expect(label(wrapper).text()).toBe('Export to Excel')
    expect(label(wrapper).classes()).toContain('opacity-0')
    expect(label(wrapper).classes()).not.toContain('opacity-100')
  })

  it('wraps the trigger directly, so the listeners see its events', () => {
    const wrapper = mountTip()

    expect(wrapper.find('button').element.parentElement).toBe(wrapper.element)
    expect(wrapper.classes()).toEqual(expect.arrayContaining(['relative', 'inline-flex']))
  })

  it('uses the tooltip recipe', () => {
    const classes = label(mountTip()).classes()

    expect(classes).toEqual(
      expect.arrayContaining([
        'bg-gray-900',
        'text-white',
        'text-xs',
        'font-medium',
        'rounded-lg',
        'px-2.5',
        'py-1.5',
        'pointer-events-none',
        'whitespace-nowrap',
        'transition-opacity',
        'motion-reduce:duration-[120ms]',
      ])
    )
  })

  it('opens after the pointer rests for 300ms, not before', async () => {
    vi.useFakeTimers()

    const wrapper = mountTip()

    await wrapper.trigger('pointerenter')
    vi.advanceTimersByTime(299)
    await nextTick()
    expect(isOpen(wrapper)).toBe(false)

    vi.advanceTimersByTime(1)
    await nextTick()
    expect(isOpen(wrapper)).toBe(true)
    expect(label(wrapper).classes()).toContain('duration-200')
  })

  it('fades out a little faster than it fades in', async () => {
    vi.useFakeTimers()

    const wrapper = mountTip()

    await wrapper.trigger('pointerenter')
    vi.advanceTimersByTime(300)
    await wrapper.trigger('pointerleave')

    expect(label(wrapper).classes()).toContain('duration-[140ms]')
  })

  it('closes on pointer leave, and a quick pass never opens it', async () => {
    vi.useFakeTimers()

    const wrapper = mountTip()

    await wrapper.trigger('pointerenter')
    vi.advanceTimersByTime(300)
    await nextTick()
    expect(isOpen(wrapper)).toBe(true)

    await wrapper.trigger('pointerleave')
    expect(isOpen(wrapper)).toBe(false)

    await wrapper.trigger('pointerenter')
    vi.advanceTimersByTime(100)
    await wrapper.trigger('pointerleave')
    vi.advanceTimersByTime(500)
    await nextTick()
    expect(isOpen(wrapper)).toBe(false)
  })

  it('closes on Escape, and ignores other keys', async () => {
    vi.useFakeTimers()

    const wrapper = mountTip()

    await wrapper.trigger('pointerenter')
    vi.advanceTimersByTime(300)
    await nextTick()

    await wrapper.trigger('keydown', { key: 'a' })
    expect(isOpen(wrapper)).toBe(true)

    await wrapper.trigger('keydown', { key: 'Escape' })
    expect(isOpen(wrapper)).toBe(false)
  })

  it('opens at once on keyboard focus, and closes on blur', async () => {
    const wrapper = mountTip()
    const button = wrapper.find('button').element

    button.focus()
    await nextTick()
    expect(isOpen(wrapper)).toBe(true)

    button.blur()
    await nextTick()
    expect(isOpen(wrapper)).toBe(false)
  })

  it('does not open when a mouse click merely focuses the button', async () => {
    const wrapper = mountTip()
    const button = wrapper.find('button').element

    // jsdom treats :focus-visible as :focus, so say what a browser would for a click.
    const matches = button.matches.bind(button)

    button.matches = (selector) => (selector === ':focus-visible' ? false : matches(selector))

    button.focus()
    await nextTick()

    expect(isOpen(wrapper)).toBe(false)
  })

  it('clears a pending open when it unmounts', () => {
    vi.useFakeTimers()

    const wrapper = mountTip()

    wrapper.trigger('pointerenter')
    wrapper.unmount()
    mounted.splice(mounted.indexOf(wrapper), 1)

    expect(vi.getTimerCount()).toBe(0)
  })
})
