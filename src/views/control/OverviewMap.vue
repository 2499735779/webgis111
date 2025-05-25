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
let retryCount = 0

function getCurrentBaseLayer() {
  if (!mapInstance) return null
  // 只返回当前 visible 的底图图层
  return mapInstance.getLayers().getArray().find(l => l.getVisible() && l.get('title'))
}

function setupOverviewMap() {
  if (!mapInstance) return
  if (control) {
    mapInstance.removeControl(control)
    control = null
  }
  const baseLayer = getCurrentBaseLayer()
  if (!baseLayer || typeof baseLayer.getSource !== 'function') {
    if (retryCount < 10) {
      retryCount++
      setTimeout(setupOverviewMap, 300)
    }
    return
  }
  control = new OverviewMap({
    collapsed: false,
    layers: [new TileLayer({ source: baseLayer.getSource() })]
  })
  mapInstance.addControl(control)
  if (!visible.value && control.element) {
    control.element.style.display = 'none'
  }
}

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

  // 监听底图切换事件，重建鹰眼控件
  window.addEventListener('refresh-basemap', () => {
    setupOverviewMap()
  })
})

onBeforeUnmount(() => {
  if (mapInstance && control) {
    mapInstance.removeControl(control)
    control = null
  }
})
</script>

<style>
.ol-overviewmap {
  z-index: 3000 !important;
  background: rgba(255,255,255,0.95);
  border-radius: 4px;
  margin: 0 20px 70px 0;
}
</style>
