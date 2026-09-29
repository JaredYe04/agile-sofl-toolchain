import * as echarts from '../../../../../node_modules/echarts/index.js'

export function initChart(el: HTMLElement) {
  return echarts.init(el)
}

export type StudioChart = ReturnType<typeof echarts.init>
export type StudioChartOption = Parameters<StudioChart['setOption']>[0]
