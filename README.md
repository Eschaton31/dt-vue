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

> **Status: 0.x, pre-release.** The API is still moving. Coming from 0.2? Read
> [Upgrading from 0.2](#upgrading-from-02) first: 0.3 changes colours, defaults and labels.

## Install

```bash
npm i dt-vue @tanstack/vue-table @heroicons/vue
```

`@heroicons/vue` must be 2.1 or later (the table uses the 16px icon set). `xlsx` is an **optional** peer — install it only if you want Excel export. It is loaded with a dynamic
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

The classes the table uses need **Tailwind 3.4 or later** in your app (`size-7`, `min-w-7`).

**3. Import the components** where you need them, or register globally:

```js
import DtVue from 'dt-vue'

app.use(DtVue)
```

## Theming

The table is coloured by eleven tokens with neutral grey defaults, so it looks finished before any theming. The
card, header band, row washes and group rows all read them. Neutrals that are not part of a theme (body text,
control borders) use stock Tailwind greys. Override any token on `:root`, or on an ancestor element to scope a
theme to part of the page:

```css
:root {
  --dt-accent: #4786eb;
  --dt-accent-strong: #2d60b3;
  --dt-selected: #f0f6ff;
  --dt-hover: #f0f6ff;
  --dt-focus-border: #629dfc;
  --dt-focus-ring: rgb(71 134 235 / 0.2);
}
```

| Token                | Default                         | Used for                                                              |
| -------------------- | ------------------------------- | --------------------------------------------------------------------- |
| `--dt-accent`        | `#374151` (gray-700)            | Sorted column arrow, checkboxes, pressed group-by border, loading line |
| `--dt-accent-strong` | `#111827` (gray-900)            | Text on a wash: the pressed group-by label and the current page       |
| `--dt-focus-border`  | `#9ca3af` (gray-400)            | Search box and Rows select border while focused                       |
| `--dt-focus-ring`    | `rgb(156 163 175 / 0.25)`       | Focus rings on inputs, buttons and headers                            |
| `--dt-selected`      | `#f3f4f6` (gray-100)            | Selected rows, the pressed group-by toggle, the current page          |
| `--dt-hover`         | `#f9fafb` (gray-50)             | Row hover                                                             |
| `--dt-header-bg`     | `#f9fafb` (gray-50)             | The header band                                                       |
| `--dt-border`        | `#e5e7eb` (gray-200)            | Card edge, header rule, row hairlines, pager rule                     |
| `--dt-radius`        | `0.5rem`                        | Card corner radius                                                    |
| `--dt-shadow`        | `0 1px 2px 0 rgb(16 24 40 / 0.05)` | Card shadow, a full `box-shadow` value                           |
| `--dt-group-bg`      | `#f9fafb` (gray-50)             | Group heading rows and grouped rows                                   |

Old to new, if you themed 0.2:

| 0.2 token            | 0.3                                                                           |
| -------------------- | ----------------------------------------------------------------------------- |
| `--dt-accent`        | kept, now a neutral grey by default                                           |
| `--dt-accent-strong` | kept (no longer the current page's fill: that is `--dt-selected`)             |
| `--dt-accent-fg`     | removed: the current page is a wash with `--dt-accent-strong` text, not a fill |
| `--dt-accent-wash`   | removed: split into `--dt-selected`, `--dt-hover` and `--dt-group-bg`         |
| `--dt-action`        | removed: Export is a ghost icon button, not a filled one                      |
| `--dt-action-fg`     | removed with `--dt-action`                                                    |
| `--dt-focus-border`  | kept                                                                          |
| `--dt-focus-ring`    | kept                                                                          |

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
| `cellTitle`  | `Function` | `null`    | `(value, rowData) => string`, the cell's `title`.    |
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

For graded bands with readable text, use `bands()`:

```vue
<script setup>
import { bands } from 'dt-vue'

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
</script>

<template>
  <DtColumn
    field="rate"
    header="Suppression"
    type="percent"
    :cell-style="rate"
    :cell-title="(value) => rate.band(value)?.label" />
</template>
```

`bands({ cuts, shades, labels, min = 0, max = 100, ink, light })` returns a `cellStyle` that gives `{ backgroundColor,
color }`. `n` cuts make `n + 1` bands with two shades each: band `i` covers `[cuts[i - 1] ?? min, cuts[i] ?? max)`,
its lower half takes the first shade and its upper half (the exact midpoint included) the second. Values below `min`
take the very first shade and values at or above `max` the very last. `color` is `light` (white) or `ink` (near-black),
whichever has the higher WCAG contrast on the shade. Blank and non-numeric values are left unstyled. A cut may lie
outside `min`..`max`; clamping wins.

`rate.band(value)` returns `{ index, label, background, color }`, or `null` for a blank value, which is what feeds
`cellTitle`. `bands()` throws a `TypeError` when `shades` is not one longer than `cuts`, a band does not have exactly
two shades, `cuts` do not strictly ascend, or a shade is not a hex colour (three or six digits) or `rgb(r, g, b)`.

## Table props

| Prop              | Type                 | Default                 | Description                                                      |
| ----------------- | -------------------- | ----------------------- | ---------------------------------------------------------------- |
| `data`            | `Array`              | `[]`                    | Row objects.                                                     |
| `title`           | `String`             | `''`                    | Heading, and the default export filename.                        |
| `locale`          | `String`             | runtime locale          | Applied to every number and date.                                |
| `dateFormat`      | `Object\|Function`   | medium date             | `Intl.DateTimeFormatOptions`, or `(date) => string`.             |
| `numberFormat`    | `Object`             | `{}`                    | `Intl.NumberFormatOptions` for `number` columns.                 |
| `labels`          | `Object`             | English                 | Override any UI string.                                          |
| `totals`          | `Boolean`            | `false`                 | Totals row for numeric and min/max date columns; `labels.total` names it. |
| `bordered`        | `Boolean`            | `true`                  | Hairline under every row. `:bordered="false"` removes it.        |
| `density`         | `String`             | `'compact'`             | `'compact'` (12px) or `'comfortable'` (13px, roomier rows).      |
| `pagination`      | `String`             | `'step'`                | `'step'` (range, previous, next) or `'numbers'` (adds pages).    |
| `mono`            | `Boolean`            | `false`                 | Monospace table text.                                            |
| `overflowVisible` | `Boolean`            | `false`                 | No overflow clipping or scroll wrapper. See below.               |
| `loading`         | `Boolean`            | `false`                 | Skeleton rows and a progress line. See below.                    |
| `rows`            | `Number`             | `10`                    | Page size. Reactive.                                             |
| `pageSizes`       | `Array`              | `[10,25,50,75,100]`     | Page-size options.                                               |
| `searchable`      | `Boolean`            | `true`                  | Show the global search box in the header bar.                    |
| `searchDebounce`  | `Number`             | `200`                   | Milliseconds before filtering.                                   |
| `sortField`       | `String`             | `null`                  | Externally controlled sort column.                               |
| `sortOrder`       | `Number`             | `1`                     | `1` ascending, `-1` descending.                                  |
| `groupBy`         | `Object`             | `null`                  | `{ Label: ['col'] }` — renders a "Group by Label" button.        |
| `groupRowsBy`     | `String`             | `null`                  | Visual-only heading row whenever this field changes.             |
| `subRows`         | `String\|Function`   | `'children'`            | Where nested rows live.                                          |
| `expandable`      | `Boolean`            | `true`                  | Expander column when the data nests. Set `false` to hide it.     |
| `rowId`           | `String`             | `null`                  | Row identity; also what `v-model` holds.                         |
| `selectable`      | `Boolean`            | `false`                 | Checkbox column, click, shift-click and drag selection.          |
| `exportable`      | `Boolean`            | `false`                 | Show the built-in Export icon button.                            |
| `exportFilename`  | `String`             | `title`                 | Export filename, without extension.                              |
| `sheetName`       | `String`             | `'Data'`                | Worksheet name.                                                  |

### Toolbar

The header bar is one row that wraps: the title on the left, and on the right the search box, the group-by toggles,
the verbs, then your `#toolbar` slot. It shows whenever there is a `title`, search, `groupBy`, `exportable`, a
`#title` slot or a `#toolbar` slot, so a table with `searchable` on (the default) always has one. On a phone the
search takes the full width and the rest wraps under it.

- **Search** has a leading magnifier icon; its placeholder and accessible name are `labels.search`.
- **Group by** toggles keep their words (`labels.groupBy`) and carry `aria-pressed`. Pressing one that is already on
  clears the grouping.
- **Clear grouping** (an X icon) shows only while grouped. Using it hands focus to the first group-by toggle.
- **Export** (a download icon) shows when `exportable`. Both icon buttons are named by an `aria-label` and show the same
  text in a tooltip after a 300ms hover or at once on keyboard focus.

Anything of your own goes in `#toolbar`; dt-vue's tooltip is internal, so bring your own for those.

### Sorting from the keyboard

A sortable column's heading is a real `<button>`: Tab reaches it and Enter or Space sorts. `aria-sort` stays on the
header cell.

### Pagination

`pagination="step"` (the default) shows a **Rows** select on the left and the range with previous and next buttons on
the right. `pagination="numbers"` keeps the Rows select and puts the range on the left, then shows previous, a window
of page numbers and next. Seven pages or fewer show every number; otherwise the window keeps the first and last page
and the current page plus one either side, widened so the first three or last three pages show when you are among
them (`1 2 3 … 25`, `1 … 9 10 11 … 25`, `1 … 23 24 25`). There are no first and last buttons. The pager is hidden
while `loading` and when there are no rows.

### Loading and empty states

`loading` replaces the rows with still skeleton rows (up to five, or the page size if smaller), draws a 2px accent
line along the card's top edge that sweeps while it loads (it holds still, faint and full width, under
`prefers-reduced-motion`), sets `aria-busy` on the table, and announces `labels.loading` through a visually hidden
status region. A refetch replaces existing rows with skeletons. The `#loading` slot, when given, replaces the skeleton
rows with its content in one full-width cell. The totals row is hidden while loading.

An empty table shows a tile, a title (`labels.empty`, or `labels.emptySearch` while a search is active, with
`{query}`) and, when `labels.emptyHint` is set, a hint. The `#empty` slot renders under them as an action area and
receives `{ query, clearSearch }`:

```vue
<DtTable :data="rows" :labels="{ emptyHint: 'Check the spelling, or search by region.' }">
  <template #empty="{ query, clearSearch }">
    <button v-if="query" type="button" @click="clearSearch()">Clear search</button>
  </template>
</DtTable>
```

### Density

`density="compact"` (the default) is 12px text with `px-3 py-2` cells; `"comfortable"` is 13px with `px-3 py-2.5`. Header
cells and group headings keep their padding in both. Numbers and dates use tabular figures.

### Labels

Pass a partial `labels` object to reword anything. Placeholders in braces are filled in.

| Key             | Default                          | Placeholders                |
| --------------- | -------------------------------- | --------------------------- |
| `search`        | `Search`                         |                             |
| `empty`         | `No entries found`               |                             |
| `emptyHint`     | `''` (no hint)                   |                             |
| `emptySearch`   | `No entries match "{query}"`     | `{query}`                   |
| `loading`       | `Loading...`                     |                             |
| `export`        | `Export to Excel`                |                             |
| `groupBy`       | `Group by {label}`               | `{label}`                   |
| `groupCount`    | `{count}`                        | `{count}`                   |
| `clearGrouping` | `Clear grouping`                 |                             |
| `total`         | `Total`                          |                             |
| `rowsPerPage`   | `Rows`                           |                             |
| `range`         | `{from}–{to} of {total}`         | `{from}`, `{to}`, `{total}` |
| `previousPage`  | `Previous page`                  |                             |
| `nextPage`      | `Next page`                      |                             |
| `pagination`    | `Pagination`                     |                             |
| `expandRow`     | `Expand row`                     |                             |
| `collapseRow`   | `Collapse row`                   |                             |
| `selectAll`     | `Select all rows on this page`   |                             |
| `selectRow`     | `Select row`                     |                             |

`groupCount` follows each group heading and each `groupBy` row, e.g. `'{count} facilities'`. Counts go through the
table's number formatting (`1,234`).

### Dropdowns in cells

By default the card clips its contents and the table scrolls horizontally inside it, which cuts off any
absolutely positioned menu or popover rendered in a cell. Set `overflow-visible` to remove both, so the
menu can extend past the table. The trade-off: a table wider than its container widens the page rather
than scrolling inside the card. Menus that teleport to `body` (or use `position: fixed`) do not need this.

```vue
<DtTable :data="rows" overflow-visible>
```

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
| `toolbar` | `table`, `exportXlsx`, `grouping`, `setGrouping`, `clearGrouping` | After the built-in verbs.    |
| `empty`   | `query`, `clearSearch`                                       | Action area under the empty state's title and hint. |
| `loading` | —                                                            | Replaces the skeleton rows.  |

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

## Upgrading from 0.2

0.3.0 changes the look and a few defaults. In order of how likely they are to bite:

- **Tokens.** `--dt-action`, `--dt-action-fg`, `--dt-accent-fg` and `--dt-accent-wash` are removed, with no aliases.
  The defaults are neutral greys, not teal, so a table you never themed changes colour. New tokens: `--dt-selected`,
  `--dt-hover`, `--dt-header-bg`, `--dt-border`, `--dt-radius`, `--dt-shadow`, `--dt-group-bg`. See [Theming](#theming)
  for the old to new map.
- **`bordered` defaults to `true`.** Pass `:bordered="false"` to keep rows without hairlines.
- **Export and Clear grouping are icon-only.** `labels.export` now defaults to `'Export to Excel'` and is the button's
  name and tooltip, not visible text. Find the button by its `aria-label`, not its text.
- **Search moves into the header bar**, so a table with no title now shows a header bar while `searchable`. The
  `labels.search` default is `'Search'`.
- **The pager.** The default is `pagination="step"`. First and last buttons are gone in both modes, and the pager hides
  while loading or empty.
- **Labels.** Removed: `firstPage`, `lastPage`, `results`, `unitRows`, `unitResults`, `noResults`, `pageSize`. Added:
  `rowsPerPage`, `range`, `groupCount`, `emptyHint`, `emptySearch`, `total`. Page-size options show just the number
  (`'25'`), not `'Show 25'`.
- **`loading` replaces the rows with skeleton rows** instead of adding a message row under them.
- **`#empty` is the action area** under the title and hint, not the whole message. Use `labels.empty` and
  `labels.emptyHint` for the words.
- **The empty state is a `div[data-dt-empty]` after the `<table>`**, no longer a `<tbody>` row, so selectors aimed at
  the empty cell break. The header row stays and `<tbody>` is empty.
- **Grouped rows show a `category` value only when every leaf shares it.** 0.2 repeated the first leaf's value; now a
  column whose leaves differ is blank on the group row. Date-typed columns compare by time value.
- **The group count is `labels.groupCount`** (default `'{count}'`, the number with thousands separators), no longer
  `(n)`. Reword it, for example `'({count})'` or `'{count} facilities'`.
- **Header labels, and number, percent and date cells, no longer wrap** (`whitespace-nowrap`).
- **The totals row labels itself** with `labels.total` (default `'Total'`) in the first non-numeric column that has no
  total of its own.
- **Clicking a pressed group-by toggle clears grouping.**
- **Sortable headings are buttons.** Selectors that clicked the `<th>` should click the `<button>` inside it.
- **Totals cells are `<td>`**, not `<th>`.
- **Peers.** `@heroicons/vue` must be 2.1 or later, and the classes used need Tailwind 3.4 or later in your app
  (`size-7`, `min-w-7`).

New in 0.3.0: `density`, `pagination`, `bands()`, `cellTitle`, the `#empty` slot props, tabular figures and keyboard
sorting.

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
