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

// 全局挂载标记，防止重复挂载
if (!window.__overviewMapMounted__) {
  window.__overviewMapMounted__ = false
}

function removeAllOverviewMapControls(map) {
  if (!map) return
  map.getControls().getArray().forEach(ctrl => {
    if (
      ctrl instanceof OverviewMap ||
      (ctrl.constructor && ctrl.constructor.name === 'OverviewMap')
    ) {
      map.removeControl(ctrl)
    }
  })
}

function getCurrentBaseLayer() {
  if (!mapInstance) return null
  return mapInstance.getLayers().getArray().find(l => l.getVisible() && l.get('title'))
}

function setupOverviewMap() {
  if (!mapInstance) return
  removeAllOverviewMapControls(mapInstance)
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
  if (window.__overviewMapMounted__) return
  mapInstance = window.map
  if (!mapInstance) {
    window.addEventListener('map-created', (e) => {
      mapInstance = e.detail
      setupOverviewMap()
      window.__overviewMapMounted__ = true
    }, { once: true })
  } else {
    setupOverviewMap()
    window.__overviewMapMounted__ = true
  }

  if (window.__overviewMapEmitter__) {
    window.__overviewMapEmitter__.on('overviewMapSwitch', (val) => {
      visible.value = val
      if (control && control.element) {
        control.element.style.display = val ? '' : 'none'
      }
    })
  }

  window.addEventListener('refresh-basemap', () => {
    setupOverviewMap()
  })
})

onBeforeUnmount(() => {
  // 不再移除控件，始终只挂载一次
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
