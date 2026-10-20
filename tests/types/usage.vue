<script setup lang="ts">
import { ref } from 'vue'
import { DtColumn, DtTable, heatmap } from 'dt-vue'
import type { DtTableExposed } from 'dt-vue'

interface Facility {
  id: number
  name: string
  region: string
  cases: number
  rate: number
  seen: string
  children?: Facility[]
}

const data = ref<Facility[]>([])
const selected = ref<number[]>([])
const tableRef = ref<DtTableExposed<Facility>>()

const rate = heatmap({ min: 0, max: 100 })

function onExportError(error: Error) {
  console.error(error.message)
}

async function exportNow() {
  await tableRef.value?.exportXlsx()
  tableRef.value?.resetSelection()
}
</script>

<template>
  <DtTable
    ref="tableRef"
    v-model="selected"
    :data="data"
    :group-by="{ Region: ['region'] }"
    :labels="{ empty: 'Nothing here' }"
    :page-sizes="[10, 50]"
    :rows="25"
    :sort-order="-1"
    bordered
    exportable
    locale="en-PH"
    row-id="id"
    selectable
    sort-field="cases"
    title="Facilities"
    totals
    @export-error="onExportError">
    <DtColumn field="name" header="Facility" sortable type="category" width="w-1/3" />
    <DtColumn :decimals="1" :cell-style="rate" field="rate" header="Rate" type="percent" />
    <DtColumn field="seen" header="Last seen" type="date" />
    <DtColumn :exportable="false" field="region" header="Region">
      <template #body="{ data: row, value, row: tanstackRow }">
        <span :title="String(tanstackRow.id)">{{ row.name }} — {{ value }}</span>
      </template>
    </DtColumn>

    <template #title>
      <h2>Custom heading</h2>
    </template>

    <template #toolbar="{ exportXlsx, grouping, clearGrouping }">
      <button type="button" @click="exportXlsx()">Export {{ grouping.length }}</button>
      <button type="button" @click="clearGrouping()">Clear</button>
      <button type="button" @click="exportNow()">Export via ref</button>
    </template>

    <template #empty>Nothing to show</template>
  </DtTable>
</template>
