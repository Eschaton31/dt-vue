<script setup>
import { ref } from 'vue'

import DtColumn from '../src/DtColumn.vue'
import DtTable from '../src/DtTable.vue'
import { heatmap } from '../src/lib/heatmap.js'
import '../src/styles.css'

/*
 * `showEmail` exercises the column-ordering fix: toggling it off and back on
 * must put Email back between Facility and Cases, not at the end.
 */
const showEmail = ref(true)

// Toggling this re-themes the table without touching the component.
const alternateTheme = ref(false)

const locale = ref('en-US')

const extraColumns = ref([
  { field: 'encoded', header: 'Encoded', type: 'minDate' },
  { field: 'released', header: 'Released', type: 'maxDate' },
])

// Pre-selected on mount, which only works because v-model is now two-way.
const selected = ref([2])

const rate = heatmap({ min: 0, max: 100 })

const data = ref([
  {
    id: 1,
    name: 'Alpha Treatment Hub',
    email: 'alpha@example.org',
    region: 'NCR',
    cases: 1284,
    rate: 92.4,
    encoded: '2026-01-04',
    released: '2026-02-11',
    children: [
      { id: 11, name: 'Alpha — Satellite A', email: 'a1@example.org', region: 'NCR', cases: 420, rate: 71.2 },
      { id: 12, name: 'Alpha — Satellite B', email: 'a2@example.org', region: 'NCR', cases: 318, rate: 44.9 },
    ],
  },
  {
    id: 2,
    name: 'Bravo Social Hygiene Clinic',
    email: 'bravo@example.org',
    region: 'Region IV-A',
    cases: 877,
    rate: 61.0,
    encoded: '2026-01-19',
    released: '2026-03-02',
  },
  {
    id: 3,
    name: 'Charlie Primary Care',
    email: 'charlie@example.org',
    region: 'Region VII',
    cases: 2450,
    rate: 18.7,
    encoded: '2025-11-28',
    released: '2026-01-30',
  },
  {
    id: 4,
    name: 'Delta Rural Health Unit',
    email: 'delta@example.org',
    region: 'Region VII',
    cases: 96,
    rate: 5.2,
    encoded: '2026-02-14',
    released: '2026-02-20',
  },
  {
    id: 5,
    name: 'Echo Hospital',
    email: 'echo@example.org',
    region: 'Region IV-A',
    cases: 1510,
    rate: 100,
    encoded: '2025-12-02',
    released: '2026-03-18',
  },
])
</script>

<template>
  <div :class="['min-h-screen p-8', alternateTheme ? 'theme-violet' : '']">
    <div class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center gap-4">
        <label class="flex items-center gap-2 text-sm text-gray-700">
          <input v-model="showEmail" class="rounded" type="checkbox" />
          Email column (toggle twice — it must stay in position 2)
        </label>

        <label class="flex items-center gap-2 text-sm text-gray-700">
          <input v-model="alternateTheme" class="rounded" type="checkbox" />
          Alternate theme (CSS tokens only)
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
        :data="data"
        :group-by="{ Region: ['region'] }"
        :locale="locale"
        :rows="10"
        bordered
        exportable
        row-id="id"
        selectable
        title="Facilities"
        totals>
        <DtColumn field="name" header="Facility" sortable type="category" width="w-1/3" />

        <DtColumn v-if="showEmail" field="email" header="Email" type="category">
          <template #body="{ value }">
            <!-- Clicking this link must not toggle row selection. -->
            <a class="text-blue-600 underline" :href="`mailto:${value}`">{{ value }}</a>
          </template>
        </DtColumn>

        <DtColumn field="region" header="Region" sortable type="category" />
        <DtColumn field="cases" header="Cases" sortable type="number" />
        <DtColumn :cell-style="rate" field="rate" header="Accomplishment" sortable type="percent" />

        <DtColumn
          v-for="column in extraColumns"
          :key="column.field"
          :field="column.field"
          :header="column.header"
          :type="column.type"
          sortable />

        <template #toolbar="{ exportXlsx }">
          <button
            class="inline-flex h-7 items-center rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700"
            type="button"
            @click="exportXlsx()">
            Custom toolbar export
          </button>
        </template>
      </DtTable>

      <pre class="rounded bg-white p-3 text-xs text-gray-600">selected: {{ selected }}</pre>
    </div>
  </div>
</template>

<style>
/* Proves tokens can be overridden from outside the package. */
.theme-violet {
  --dt-accent: #7c3aed;
  --dt-accent-strong: #5b21b6;
  --dt-accent-wash: rgb(124 58 237 / 0.1);
  --dt-focus-border: #c4b5fd;
  --dt-focus-ring: rgb(196 181 253 / 0.4);
  --dt-action: #4f46e5;
}
</style>
