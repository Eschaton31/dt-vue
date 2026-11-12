import { Comment, Fragment, Text, camelize, isVNode } from 'vue'

import DtColumn from '../DtColumn.vue'

/*
|--------------------------------------------------------------------------
| Reading <DtColumn> out of the default slot
|--------------------------------------------------------------------------
|
| Columns are read from the slot's vnodes rather than registering themselves
| through provide/inject. Registration made column order depend on mount
| order, so a column re-mounted by v-if jumped to the end of the table.
| Reading vnodes gives declaration order by construction, and the column
| components never need to be instantiated at all.
|
*/

/** Boolean props on DtColumn, mapped to the default used when absent. */
const BOOLEAN_PROPS = {
  sortable: false,
  fit: false,
  exportable: true,
}

/**
 * Runtime defaults. Mirrors defineProps in DtColumn.vue, which is not applied
 * here because the component is never instantiated.
 */
const COLUMN_DEFAULTS = {
  field: null,
  header: '',
  type: 'string',
  align: null,
  width: null,
  decimals: null,
  cellStyle: null,
  cellTitle: null,
}

function isColumnVNode(vnode) {
  return vnode.type === DtColumn || vnode.type?.name === 'DtColumn'
}

/**
 * Flatten a slot's children into a list of component vnodes.
 *
 * v-for produces a Fragment holding an array, v-if produces a Comment
 * placeholder when false, and templates can leave stray whitespace Text
 * nodes behind. None of those are columns.
 *
 * @param {unknown} children
 * @return {import('vue').VNode[]}
 */
export function flattenVNodes(children) {
  const result = []

  const walk = (nodes) => {
    for (const node of nodes ?? []) {
      if (Array.isArray(node)) {
        walk(node)
        continue
      }

      if (!isVNode(node) || node.type === Comment || node.type === Text) {
        continue
      }

      if (node.type === Fragment) {
        walk(node.children)
        continue
      }

      result.push(node)
    }
  }

  walk(Array.isArray(children) ? children : [children])

  return result
}

/**
 * Apply camelCasing, boolean coercion and defaults to raw vnode props.
 *
 * @param {Record<string, unknown> | null} raw
 * @return {typeof COLUMN_DEFAULTS & { sortable: boolean, fit: boolean, exportable: boolean }}
 */
export function normalizeColumnProps(raw) {
  const props = { ...COLUMN_DEFAULTS }

  for (const [key, value] of Object.entries(raw ?? {})) {
    props[camelize(key)] = value
  }

  /*
   * `<DtColumn sortable />` arrives as the empty string, `:sortable="false"`
   * as a real boolean, and an omitted prop as undefined.
   */
  for (const [key, fallback] of Object.entries(BOOLEAN_PROPS)) {
    const value = props[key]

    props[key] = value === undefined || value === null ? fallback : value === '' || value === true
  }

  if (!props.header) {
    props.header = props.field
  }

  return props
}

/**
 * Slots of a column vnode. Only present when the consumer wrote a
 * <template #body>; anything else (text, arrays) is not a usable slot object.
 *
 * @param {import('vue').VNode} vnode
 * @return {Record<string, Function>}
 */
function columnSlots(vnode) {
  const children = vnode.children

  if (!children || typeof children !== 'object' || Array.isArray(children)) {
    return {}
  }

  return children
}

/**
 * Turn the table's default slot into an ordered column descriptor list.
 *
 * Must be called from inside a computed or a render function so that any
 * reactive state the slot reads (a v-if toggle, a dynamic :header) is
 * tracked and the columns recompute.
 *
 * @param {Function | undefined} slot
 * @return {{ props: ReturnType<typeof normalizeColumnProps>, slots: Record<string, Function> }[]}
 */
export function readColumnsFromSlot(slot) {
  if (typeof slot !== 'function') {
    return []
  }

  return flattenVNodes(slot())
    .filter(isColumnVNode)
    .map((vnode) => ({
      props: normalizeColumnProps(vnode.props),
      slots: columnSlots(vnode),
    }))
}

/**
 * Warn about duplicate fields, which would otherwise surface as a confusing
 * duplicate-column-id error from TanStack.
 *
 * @param {{ props: { field: string } }[]} columns
 */
export function warnOnDuplicateFields(columns) {
  const seen = new Set()

  for (const { props } of columns) {
    if (seen.has(props.field)) {
      console.warn(
        `dt-vue: duplicate column field "${props.field}". Give one of them a unique field, or the columns will collide.`
      )
    }

    seen.add(props.field)
  }
}
