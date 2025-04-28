<script setup>
import Zoom from 'ol/control/Zoom.js'
import ZoomSlider from 'ol/control/ZoomSlider.js'
import ZoomToExtent from 'ol/control/ZoomToExtent.js'

import Map from '../Map.vue'

const createZoom = map =>
{
  // 创建缩放按钮控件
  const zoom = new Zoom()

  // 创建缩放滑块控件
  const zoomSlider = new ZoomSlider()

  // 创建缩放到范围，默认使用view的投影范围
  const zoomToExtent = new ZoomToExtent()

  // 缩放控件添加到地图
  map.addControl(zoom)
  map.addControl(zoomSlider)
  map.addControl(zoomToExtent)
}

</script>

<template>
  <Map @created="createZoom" :defaultControl="[]"></Map>
</template>

<style>
</style>
