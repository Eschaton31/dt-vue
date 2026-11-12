<script setup>
import { computed, ref } from 'vue'

import DtColumn from '../src/DtColumn.vue'
import DtTable from '../src/DtTable.vue'
import { bands } from '../src/lib/heatmap.js'
import '../src/styles.css'

/*
 * Playground for the 0.3.0 recipe. Every control below drives a prop, so each
 * state in the visual review (rows, loading, empty, both densities, both
 * pagers, grouped, selected, neutral and sky) is one or two clicks away.
 * The data is synthetic.
 */

// State: Rows shows data, Loading sets `loading`, Empty passes no rows (type in the search box for the search variant).
const state = ref('rows')

const density = ref('compact')

const pagination = ref('step')

// Neutral is the shipped default; OHASIS sky overrides the tokens on the wrapper below.
const theme = ref('sky')

const groupRowsBy = ref(false)

const locale = ref('en-US')

// Pre-selected on mount, which only works because v-model is two-way.
const selected = ref([3])

const REGIONS = ['NCR', 'Region I', 'Region III', 'Region IV-A', 'Region VII', 'Region XI']
const TYPES = ['Hospital', 'Social hygiene clinic', 'Rural health unit']

// 150 facilities, sorted by region so groupRowsBy has equal values side by side.
const facilities = Array.from({ length: 150 }, (_, index) => ({
  id: index + 1,
  name: `Facility ${String(index + 1).padStart(3, '0')}`,
  region: REGIONS[Math.floor(index / 25)],
  type: TYPES[index % TYPES.length],
  onArt: 40 + ((index * 937) % 2600),
  rate: (index * 37) % 101,
  lastSeen: new Date(Date.UTC(2026, index % 12, 1 + (index % 27))).toISOString().slice(0, 10),
}))

// One row nests, to show the expander.
facilities[0].children = [
  { id: 1001, name: 'Facility 001, satellite A', region: 'NCR', type: 'Hospital', onArt: 120, rate: 71 },
  { id: 1002, name: 'Facility 001, satellite B', region: 'NCR', type: 'Hospital', onArt: 96, rate: 44 },
]

const rows = computed(() => (state.value === 'empty' ? [] : facilities))

// DV1's graded bands: far behind, behind, near target, met; two shades each.
const rate = bands({
  cuts: [50, 80, 95],
  shades: [
    ['#9B272C', '#D03E45'],
    ['#F6B321', '#FED78B'],
    ['#C3F6C5', '#77D585'],
    ['#26873F', '#054A1F'],
  ],
  labels: ['Far behind', 'Behind', 'Near target', 'Met'],
})

// DV1 sets the band text at weight 600: same cellStyle hook, one extra style key.
const rateStyle = (value, row) => {
  const style = rate(value, row)

  return style ? { ...style, fontWeight: 600 } : style
}

const controls = [
  {
    label: 'State',
    model: state,
    options: [
      ['rows', 'Rows'],
      ['loading', 'Loading'],
      ['empty', 'Empty'],
    ],
  },
  {
    label: 'Density',
    model: density,
    options: [
      ['compact', 'Compact'],
      ['comfortable', 'Comfortable'],
    ],
  },
  {
    label: 'Pager',
    model: pagination,
    options: [
      ['step', 'Range and step'],
      ['numbers', 'Numbered'],
    ],
  },
  {
    label: 'Theme',
    model: theme,
    options: [
      ['neutral', 'Neutral'],
      ['sky', 'OHASIS sky'],
    ],
  },
]
</script>

<template>
  <div :class="['min-h-screen p-4 sm:p-8', theme === 'sky' ? 'theme-sky' : '']">
    <div class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div v-for="control in controls" :key="control.label" class="flex items-center gap-2 text-sm text-gray-700">
          {{ control.label }}

          <span
            :aria-label="control.label"
            class="inline-flex overflow-hidden rounded-lg border border-gray-300"
            role="group">
            <button
              v-for="[value, text] in control.options"
              :key="value"
              :aria-pressed="control.model.value === value"
              :class="[
                'h-7 px-2.5 text-xs font-semibold',
                control.model.value === value ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 hover:bg-gray-50',
              ]"
              type="button"
              @click="control.model.value = value">
              {{ text }}
            </button>
          </span>
        </div>

        <label class="flex items-center gap-2 text-sm text-gray-700">
          <input v-model="groupRowsBy" class="rounded" type="checkbox" />
          Group rows by region
        </label>

        <label class="flex items-center gap-2 text-sm text-gray-700">
          Locale
          <select v-model="locale" class="rounded border-gray-300 text-sm">
            <option value="en-US">en-US</option>
            <option value="en-GB">en-GB</option>
            <option value="de-DE">de-DE</option>
            <option value="fil-PH">fil-PH</option>
          </select>
        </label>

        <button class="rounded border border-gray-300 bg-white px-3 py-1 text-sm" type="button" @click="selected = []">
          Clear selection from outside
        </button>
      </div>

      <DtTable
        v-model="selected"
        :data="rows"
        :density="density"
        :group-by="{ Region: ['region'], Type: ['type'] }"
        :group-rows-by="groupRowsBy ? 'region' : null"
        :labels="{
          emptyHint: 'Check the spelling, or search by region.',
          groupCount: '{count} facilities',
          export: 'Export to Excel',
        }"
        :loading="state === 'loading'"
        :locale="locale"
        :page-sizes="[10, 25, 50, 100]"
        :pagination="pagination"
        :rows="10"
        :sort-field="groupRowsBy ? 'region' : null"
        exportable
        row-id="id"
        selectable
        title="Treatment by facility"
        totals>
        <DtColumn field="name" header="Facility" sortable type="category" width="w-1/3" />
        <DtColumn field="region" fit header="Region" sortable type="category" />
        <DtColumn field="type" fit header="Type" type="category" />
        <DtColumn field="onArt" header="On ART" sortable type="number" />
        <DtColumn
          :cell-style="rateStyle"
          :cell-title="(value) => rate.band(value)?.label"
          :decimals="0"
          field="rate"
          header="Suppression rate"
          sortable
          type="percent" />
        <DtColumn field="lastSeen" header="Last seen" sortable type="date" />

        <template #empty="{ query, clearSearch }">
          <button
            v-if="query"
            class="text-[13px] font-semibold text-blue-700 underline underline-offset-4"
            type="button"
            @click="clearSearch()">
            Clear search
          </button>
        </template>
      </DtTable>

      <pre class="rounded bg-white p-3 text-xs text-gray-600">selected: {{ selected }}</pre>
    </div>
  </div>
</template>

<style>
/* OHASIS's override, scoped to this wrapper: sky replaces the neutral defaults. */
.theme-sky {
  --dt-accent: #4786eb;
  --dt-accent-strong: #2d60b3;
  --dt-selected: #f0f6ff;
  --dt-hover: #f0f6ff;
  --dt-focus-border: #629dfc;
  --dt-focus-ring: rgb(71 134 235 / 0.2);
  --dt-group-bg: #f9fafb;
  --dt-header-bg: #f9fafb;
}
</style>
