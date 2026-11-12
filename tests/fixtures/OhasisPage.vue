<script setup>
/*
 * Mirrors how a real OHASIS page uses the shim: a compiled template, the
 * legacy :columns object, <TanstackColumn> children with a #body slot, and
 * the actions / fetch / #menu header.
 */
import Column from '../../../ohasis/resources/js/components/tables/TanstackColumn.vue'
import Table from '../../../ohasis/resources/js/components/tables/TanstackTable.vue'

defineProps({
  data: { type: Array, default: () => [] },
  columns: { type: Object, default: () => ({}) },
  showRegion: { type: Boolean, default: true },
})

defineEmits(['fetch'])
</script>

<template>
  <Table :columns="columns" :data="data" :rows="10" actions bordered fetch title="Facilities" totals @fetch="$emit('fetch')">
    <Column align="left" field="name" header="Facility" sortable>
      <template #body="{ data: row }">
        <strong>{{ row.name }}</strong>
      </template>
    </Column>

    <Column v-if="showRegion" field="region" header="Region" sortable />

    <Column field="cases" header="Cases" type="number" sortable />

    <template #menu>
      <button type="button">Menu action</button>
    </template>
  </Table>
</template>
