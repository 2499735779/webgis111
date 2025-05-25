<template>
  <!-- 此组件不渲染内容，控件由 OpenLayers 注入 -->
</template>

<script setup>
import OverviewMap from 'ol/control/OverviewMap.js'
import TileLayer from 'ol/layer/Tile.js'
import { ref, onMounted, onBeforeUnmount } from 'vue'

let control = null
let mapInstance = null
const visible = ref(true)

onMounted(() => {
  mapInstance = window.map
  if (!mapInstance) {
    window.addEventListener('map-created', (e) => {
      mapInstance = e.detail
      setupOverviewMap()
    }, { once: true })
  } else {
    setupOverviewMap()
  }

  // 监听开关事件
  if (window.__overviewMapEmitter__) {
    window.__overviewMapEmitter__.on('overviewMapSwitch', (val) => {
      visible.value = val
      if (control && control.element) {
        control.element.style.display = val ? '' : 'none'
      }
    })
  }
})

function setupOverviewMap() {
  if (!mapInstance) return
  if (control) {
    mapInstance.removeControl(control)
    control = null
  }
  // 取第一个底图图层作为鹰眼底图
  const baseLayer = mapInstance.getLayers().item(0)
  control = new OverviewMap({
    collapsed: false,
    className: 'overviewMapPos',
    layers: [new TileLayer({ source: baseLayer.getSource() })]
  })
  mapInstance.addControl(control)
  if (!visible.value && control.element) {
    control.element.style.display = 'none'
  }
}

onBeforeUnmount(() => {
  if (mapInstance && control) {
    mapInstance.removeControl(control)
    control = null
  }
})
</script>

<style>
.overviewMapPos {
  position: fixed !important;
  left: 40px !important;
  bottom: 60px !important;
  z-index: 3000 !important;
  background: rgba(255,255,255,0.8);
  border-radius: 4px;
  pointer-events: none;
}
</style>
