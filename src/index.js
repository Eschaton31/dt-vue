import DtColumn from './DtColumn.vue'
import DtTable from './DtTable.vue'
import './styles.css'

export { DtColumn, DtTable }

export { DEFAULT_HEATMAP_SCALE, heatmap } from './lib/heatmap.js'
export { createFormatter } from './lib/format.js'

export default {
  /**
   * Optional global registration:
   *
   *   app.use(DtVue)
   *   app.use(DtVue, { prefix: 'X' })  // <XDtTable>
   */
  install(app, { prefix = '' } = {}) {
    app.component(`${prefix}DtTable`, DtTable)
    app.component(`${prefix}DtColumn`, DtColumn)
  },
}
