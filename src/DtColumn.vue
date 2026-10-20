<script setup>
/*
 * Configuration-only component.
 *
 * DtColumn is never mounted. DtTable reads these elements straight out of
 * its default slot's vnodes, which keeps the rendered column order identical
 * to the declared order even when columns are added or removed with
 * v-if / v-for.
 *
 * The props below are therefore declarative documentation: they drive editor
 * autocomplete and type hints, but runtime defaults are applied by
 * `normalizeColumnProps` in lib/columns.js. Keep the two in sync.
 */
defineOptions({
  name: 'DtColumn',
})

defineProps({
  // Key on the row object that this column reads.
  field: {
    type: String,
    required: true,
  },

  // Column heading. Defaults to `field`.
  header: {
    type: String,
    default: '',
  },

  sortable: {
    type: Boolean,
    default: false,
  },

  /*
   * One of: string | category | number | percent | date | minDate | maxDate
   *
   * Drives alignment, formatting, sorting, group aggregation and the type
   * written to the export.
   */
  type: {
    type: String,
    default: 'string',
  },

  // left | center | right. Defaults by type.
  align: {
    type: String,
    default: null,
  },

  // Shrink the column to its content.
  fit: {
    type: Boolean,
    default: false,
  },

  /*
   * Tailwind width class, e.g.
   *
   * w-1/4
   * w-1/3
   * w-2/5
   * w-[180px]
   */
  width: {
    type: String,
    default: null,
  },

  // Fraction digits for type="percent". Defaults to 2.
  decimals: {
    type: Number,
    default: null,
  },

  /*
   * Conditional cell styling: (value, rowData) => style object | undefined.
   *
   * Use the exported `heatmap()` helper for a value-shaded column:
   *
   * :cell-style="heatmap({ min: 0, max: 100 })"
   */
  cellStyle: {
    type: Function,
    default: null,
  },

  // Include this column in the Excel export.
  exportable: {
    type: Boolean,
    default: true,
  },
})
</script>

<template>
  <!-- Configuration-only component: never rendered. -->
</template>
