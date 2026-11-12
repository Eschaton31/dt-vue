<script>
// Shared by every pager on the page, so each page-size select gets its own id.
let selectSequence = 0
</script>

<script setup>
/*
 * Internal pager for DtTable. Not exported.
 *
 * `step` shows the Rows select on the left and the range with previous / next
 * on the right. `numbers` shows the Rows select and range on the left and
 * previous, a page window and next on the right.
 */
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/vue/16/solid'
import { computed } from 'vue'

import { GHOST_ICON_BUTTON } from './lib/classes.js'
import { pageWindow } from './lib/pages.js'

const props = defineProps({
  // The TanStack table instance.
  table: { type: Object, required: true },

  mode: {
    type: String,
    default: 'step',
    validator: (value) => ['step', 'numbers'].includes(value),
  },

  pageSizes: { type: Array, default: () => [] },

  // DtTable's label lookup and placeholder splitter.
  t: { type: Function, required: true },
  parts: { type: Function, required: true },

  formatNumber: { type: Function, required: true },
})

const selectId = `dt-pager-size-${++selectSequence}`

const pageSize = computed({
  get() {
    return props.table.getState().pagination.pageSize
  },

  set(value) {
    props.table.setPageSize(Number(value))
  },
})

const pageIndex = computed(() => props.table.getState().pagination.pageIndex)

// The rows the pager walks through: groups (and any expanded children) when grouped.
const total = computed(() => props.table.getPrePaginationRowModel().rows.length)

const rangeParts = computed(() => {
  const size = pageSize.value

  return props.parts('range', {
    from: props.formatNumber(pageIndex.value * size + 1),
    to: props.formatNumber(Math.min((pageIndex.value + 1) * size, total.value)),
    total: props.formatNumber(total.value),
  })
})

const pages = computed(() => pageWindow(pageIndex.value, props.table.getPageCount()))

const pageButton =
  'inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[12.5px] font-semibold tabular-nums transition-colors duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--dt-focus-ring)]'
</script>

<template>
  <nav
    :aria-label="t('pagination')"
    class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[var(--dt-border)] px-3 py-2 text-[12.5px] text-gray-600">
    <!-- Left: Rows select, and in numbers mode the range -->
    <div class="flex items-center gap-2">
      <label :for="selectId">{{ t('rowsPerPage') }}</label>

      <div class="relative">
        <select
          :id="selectId"
          v-model="pageSize"
          class="h-7 w-auto appearance-none rounded-lg border border-gray-300 bg-white pl-2 pr-7 text-[12.5px] font-semibold tabular-nums text-gray-800 focus:border-[var(--dt-focus-border)] focus:outline-none focus:ring-2 focus:ring-[var(--dt-focus-ring)]">
          <option v-for="size in pageSizes" :key="size" :value="size">{{ formatNumber(size) }}</option>
        </select>

        <ChevronDownIcon
          aria-hidden="true"
          class="pointer-events-none absolute right-1.5 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
      </div>

      <span v-if="mode === 'numbers'" class="tabular-nums">
        <template v-for="(part, index) in rangeParts" :key="index">
          <span v-if="part.placeholder === 'from' || part.placeholder === 'to'" class="font-semibold text-gray-900">{{
            part.text
          }}</span>
          <template v-else>{{ part.text }}</template>
        </template>
      </span>
    </div>

    <!-- Right: range (step), previous, page window (numbers), next -->
    <div class="flex items-center gap-0.5">
      <span v-if="mode === 'step'" class="mr-2 tabular-nums">
        <template v-for="(part, index) in rangeParts" :key="index">
          <span v-if="part.placeholder === 'from' || part.placeholder === 'to'" class="font-semibold text-gray-900">{{
            part.text
          }}</span>
          <template v-else>{{ part.text }}</template>
        </template>
      </span>

      <button
        :aria-label="t('previousPage')"
        :class="GHOST_ICON_BUTTON"
        :disabled="!table.getCanPreviousPage()"
        type="button"
        @click="table.previousPage()">
        <ChevronLeftIcon aria-hidden="true" class="size-4" />
      </button>

      <template v-if="mode === 'numbers'">
        <template v-for="(page, index) in pages" :key="page === 'gap' ? `gap-${index}` : page">
          <span v-if="page === 'gap'" aria-hidden="true" class="px-1 text-gray-500">…</span>

          <button
            v-else
            :aria-current="page === pageIndex ? 'page' : undefined"
            :class="[
              pageButton,
              page === pageIndex
                ? 'bg-[var(--dt-selected)] text-[var(--dt-accent-strong)]'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
            ]"
            type="button"
            @click="table.setPageIndex(page)">
            {{ page + 1 }}
          </button>
        </template>
      </template>

      <button
        :aria-label="t('nextPage')"
        :class="GHOST_ICON_BUTTON"
        :disabled="!table.getCanNextPage()"
        type="button"
        @click="table.nextPage()">
        <ChevronRightIcon aria-hidden="true" class="size-4" />
      </button>
    </div>
  </nav>
</template>
