# dt-vue

A declarative Vue 3 data table built on [TanStack Table](https://tanstack.com/table) and styled with Tailwind
utilities. Columns are written as components, not config objects:

```vue
<DtTable :data="facilities" title="Facilities" exportable totals>
  <DtColumn field="name" header="Facility" type="category" sortable width="w-1/3" />
  <DtColumn field="region" header="Region" type="category" sortable />
  <DtColumn field="cases" header="Cases" type="number" sortable />
</DtTable>
```

Sorting, debounced global search, pagination, grouping with aggregates, a totals row, nested rows,
shift/drag range selection and Excel export are built in.

> **Status: 0.x, pre-release.** The API is still moving. See [Roadmap](#roadmap).

## Install

```bash
npm i dt-vue @tanstack/vue-table @heroicons/vue
```

`xlsx` is an **optional** peer — install it only if you want Excel export. It is loaded with a dynamic
import, so apps that never export do not pay for it in their bundle.

```bash
npm i xlsx   # only for export
```

## Setup

**1. Import the tokens stylesheet once** (app entry point):

```js
import 'dt-vue/styles.css'
```

**2. Add the package to your Tailwind content paths**, otherwise the component's utility classes are purged
and the table renders unstyled:

```js
// tailwind.config.js (Tailwind v3)
export default {
  content: ['./src/**/*.{vue,js}', './node_modules/dt-vue/dist/**/*.js'],
}
```

```css
/* Tailwind v4 */
@source "../node_modules/dt-vue/dist";
```

**3. Import the components** where you need them, or register globally:

```js
import DtVue from 'dt-vue'

app.use(DtVue)
```

## Theming

Only brand colours are tokenised; neutrals use stock Tailwind greys. Override any token on `:root`, or on an
ancestor element to scope a theme to part of the page:

```css
:root {
  --dt-accent: #7c3aed;
  --dt-accent-strong: #5b21b6;
  --dt-accent-fg: #ffffff;
  --dt-accent-wash: rgb(124 58 237 / 0.1);
  --dt-focus-border: #c4b5fd;
  --dt-focus-ring: rgb(196 181 253 / 0.4);
  --dt-action: #4f46e5;
  --dt-action-fg: #ffffff;
}
```

## Column types

`type` drives alignment, formatting, sorting, group aggregation and what gets written to the export.

| Type       | Alignment | Renders as    | Aggregates to | Totals row | Exports as |
| ---------- | --------- | ------------- | ------------- | ---------- | ---------- |
| `string`   | center    | raw value     | —             | —          | text       |
| `category` | left      | raw value     | shared value  | —          | text       |
| `number`   | center    | `1,234`       | sum           | sum        | number     |
| `percent`  | center    | `92.40%`      | mean          | —          | number     |
| `date`     | center    | `Jan 5, 2026` | —             | —          | date       |
| `minDate`  | center    | `Jan 5, 2026` | earliest      | earliest   | date       |
| `maxDate`  | center    | `Jan 5, 2026` | latest        | latest     | date       |

All formatting goes through `Intl`; there is no date library. Control it with `locale`, `dateFormat` and
`numberFormat` on the table, and `decimals` on a `percent` column.

### Column props

| Prop         | Type       | Default   | Description                                          |
| ------------ | ---------- | --------- | ---------------------------------------------------- |
| `field`      | `String`   | required  | Key on the row object.                               |
| `header`     | `String`   | `field`   | Column heading.                                      |
| `type`       | `String`   | `string`  | See the table above.                                 |
| `sortable`   | `Boolean`  | `false`   | Allow sorting by clicking the header.                |
| `align`      | `String`   | by type   | `left` \| `center` \| `right`.                       |
| `fit`        | `Boolean`  | `false`   | Shrink the column to its content.                    |
| `width`      | `String`   | `null`    | Tailwind width class, e.g. `w-1/3`, `w-[180px]`.     |
| `decimals`   | `Number`   | `2`       | Fraction digits for `percent`.                       |
| `cellStyle`  | `Function` | `null`    | `(value, rowData) => styleObject`.                   |
| `exportable` | `Boolean`  | `true`    | Include this column in the export.                   |

### Custom cells

```vue
<DtColumn field="status" header="Status">
  <template #body="{ data, value, row, column, table }">
    <StatusBadge :status="value" />
  </template>
</DtColumn>
```

Clicks on interactive content inside a cell (`a`, `button`, `input`, …) do not toggle row selection. Add
`data-dt-no-select` to opt a custom element out too.

### Conditional cell shading

```vue
<script setup>
import { heatmap } from 'dt-vue'

const rate = heatmap({ min: 0, max: 100 })
</script>

<template>
  <DtColumn field="rate" header="Accomplishment" type="percent" :cell-style="rate" />
</template>
```

`heatmap({ colors, min, max, property })` returns a `cellStyle` function. The default ten-step scale runs red
through amber to green; pass your own `colors` array for anything else.

## Table props

| Prop             | Type                 | Default                 | Description                                                      |
| ---------------- | -------------------- | ----------------------- | ---------------------------------------------------------------- |
| `data`           | `Array`              | `[]`                    | Row objects.                                                     |
| `title`          | `String`             | `''`                    | Heading, and the default export filename.                        |
| `locale`         | `String`             | runtime locale          | Applied to every number and date.                                |
| `dateFormat`     | `Object\|Function`   | medium date             | `Intl.DateTimeFormatOptions`, or `(date) => string`.             |
| `numberFormat`   | `Object`             | `{}`                    | `Intl.NumberFormatOptions` for `number` columns.                 |
| `labels`         | `Object`             | English                 | Override any UI string.                                          |
| `totals`         | `Boolean`            | `false`                 | Totals row for numeric and min/max date columns.                 |
| `bordered`       | `Boolean`            | `false`                 | Thin border under every row.                                     |
| `mono`           | `Boolean`            | `false`                 | Monospace table text.                                            |
| `loading`        | `Boolean`            | `false`                 | Loading placeholder row.                                         |
| `rows`           | `Number`             | `10`                    | Page size. Reactive.                                             |
| `pageSizes`      | `Array`              | `[10,25,50,75,100]`     | Page-size options.                                               |
| `searchable`     | `Boolean`            | `true`                  | Show the global search box.                                      |
| `searchDebounce` | `Number`             | `200`                   | Milliseconds before filtering.                                   |
| `sortField`      | `String`             | `null`                  | Externally controlled sort column.                               |
| `sortOrder`      | `Number`             | `1`                     | `1` ascending, `-1` descending.                                  |
| `groupBy`        | `Object`             | `null`                  | `{ Label: ['col'] }` — renders a "Group by Label" button.        |
| `groupRowsBy`    | `String`             | `null`                  | Visual-only heading row whenever this field changes.             |
| `subRows`        | `String\|Function`   | `'children'`            | Where nested rows live.                                          |
| `expandable`     | `Boolean`            | `true`                  | Expander column when the data nests. Set `false` to hide it.     |
| `rowId`          | `String`             | `null`                  | Row identity; also what `v-model` holds.                         |
| `selectable`     | `Boolean`            | `false`                 | Checkbox column, click, shift-click and drag selection.          |
| `exportable`     | `Boolean`            | `false`                 | Show the built-in Export button.                                 |
| `exportFilename` | `String`             | `title`                 | Export filename, without extension.                              |
| `sheetName`      | `String`             | `'Data'`                | Worksheet name.                                                  |

### Selection

`v-model` is two-way. It holds `row[rowId]` values when `rowId` is set, otherwise whole row objects, and a
selection assigned from outside is applied back to the table — so rows can be pre-selected.

```vue
<DtTable v-model="selected" :data="rows" row-id="id" selectable>
```

Only top-level rows are selectable; nested rows are not.

### Slots

| Slot      | Props                                                        | Purpose                      |
| --------- | ------------------------------------------------------------ | ---------------------------- |
| `title`   | —                                                            | Replace the heading.         |
| `toolbar` | `table`, `exportXlsx`, `grouping`, `setGrouping`, `clearGrouping` | Buttons in the header bar. |
| `empty`   | —                                                            | Empty state.                 |
| `loading` | —                                                            | Loading state.               |

### Events

| Event          | Payload | When                                 |
| -------------- | ------- | ------------------------------------ |
| `export-error` | `Error` | Export failed, e.g. `xlsx` missing.  |

### Exposed methods

```js
tableRef.value.table // the underlying TanStack table instance
await tableRef.value.exportXlsx()
tableRef.value.resetSelection()
tableRef.value.getSelectedRows()
```

### Export contents

The export reflects what the user is looking at: the active search, sort order, grouping order and column
visibility all apply, and columns marked `:exportable="false"` are left out. Pagination and expand/collapse
state do not apply, so the file always holds the full result set including nested rows. Numbers and dates are
written as real numbers and dates so Excel can total and reformat them.

## TypeScript

Declarations ship with the package — no `@types` install needed. Both components are generic over the row
type, so `#body` slot props and `cellStyle` are inferred:

```vue
<script setup lang="ts">
import { DtColumn, DtTable } from 'dt-vue'
import type { DtTableExposed } from 'dt-vue'

interface Facility { id: number; name: string; cases: number }

const rows = ref<Facility[]>([])
const table = ref<DtTableExposed<Facility>>()
</script>
```

Installing the plugin also registers `DtTable` and `DtColumn` in Vue's `GlobalComponents`, so they resolve in
templates without an import.

## Behaviour notes

- **Sort direction on first click** follows TanStack: numeric columns sort descending first, text columns
  ascending first.
- **Pagination resets to page 1** when the search text, the `data` prop or the grouping changes — and only
  then. (TanStack's `autoResetPageIndex` is switched off deliberately: under the Vue adapter its queued reset
  is flushed by the next `setOptions`, which lands straight after an ordinary page change and snaps the user
  back to page 1.)

## Known limitations

- A `v-model` array mutated in place (`selected.value.push(x)`) is not picked up; assign a new array.
- Columns must be direct children of `<DtTable>`; they are read from the slot's vnodes, so columns wrapped
  inside another component are not discovered.
- No column virtualization — use pagination for large datasets.

## Development

```bash
npm install
npm run dev            # playground at /dev
npm run test:types     # vue-tsc against the published declarations
npm run test:coverage
npm run check          # tests + types + build
npm run build
```

`npm audit` reports advisories against `xlsx`, which is a dev dependency here for the playground and is
optional for consumers.

## License

MIT
