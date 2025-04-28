<script setup>
import * as echarts from 'echarts'
import { ref, onMounted } from 'vue'

const echartRef = ref()
const props = defineProps({
  feature: { type: Object },
})
onMounted(() =>
{
  const echart = echarts.init(echartRef.value)
  // 可以通过传入的feature属性，进行自定义echart配置参数的构造
  const option =
  {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      }
    },
    xAxis: {
      type: 'category',
      data: ['0-20岁', '20-40岁', '40-60岁', '60岁以上']
    },
    yAxis: {
      show: false,
      type: 'value'
    },
    series: [
      {
        data: Array.from({length: 4}).map(() => Number((Math.max(Math.random() * 1000, 100) + 300).toFixed(0))),
        type: 'bar',
        barWidth: '10'
      }
    ]
  }
  echart.setOption(option)
  echart.resize()
})
</script>

<template>
  <div ref="echartRef" style="height: 100px; width: 100px;"></div>
</template>

<style>
</style>
