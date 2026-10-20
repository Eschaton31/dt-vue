<script setup>
import DtColumn from '../../src/DtColumn.vue'
import DtTable from '../../src/DtTable.vue'

defineProps({
  data: { type: Array, default: () => [] },
  showEmail: { type: Boolean, default: true },
  extra: { type: Array, default: () => [] },
})
</script>

<template>
  <DtTable :data="data">
    <DtColumn field="name" header="Name" sortable type="category" />

    <DtColumn v-if="showEmail" field="email" header="Email" />

    <DtColumn field="cases" header="Cases" type="number" />

    <DtColumn v-for="column in extra" :key="column" :field="column" :header="column" />
  </DtTable>
</template>
