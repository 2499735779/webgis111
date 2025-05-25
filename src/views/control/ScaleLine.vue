<template>
  <!-- 此组件不渲染内容，控件由 OpenLayers 注入 -->
</template>

<script setup>
import ScaleLine from 'ol/control/ScaleLine.js'
import { ref, onMounted, onBeforeUnmount } from 'vue'

let control = null
let mapInstance = null
const visible = ref(true)

// 全局挂载标记，防止重复挂载
if (!window.__scaleLineMounted__) {
  window.__scaleLineMounted__ = false
}

function removeAllScaleLineControls(map) {
  if (!map) return
  map.getControls().getArray().forEach(ctrl => {
    if (
      ctrl instanceof ScaleLine ||
      (ctrl.constructor && ctrl.constructor.name === 'ScaleLine')
    ) {
      map.removeControl(ctrl)
    }
  })
}

onMounted(() => {
  if (window.__scaleLineMounted__) return
  mapInstance = window.map
  if (!mapInstance) {
    window.addEventListener('map-created', (e) => {
      mapInstance = e.detail
      removeAllScaleLineControls(mapInstance)
      setupScaleLine()
      window.__scaleLineMounted__ = true
    }, { once: true })
  } else {
    removeAllScaleLineControls(mapInstance)
    setupScaleLine()
    window.__scaleLineMounted__ = true
  }

  if (window.__scaleLineEmitter__) {
    window.__scaleLineEmitter__.on('scaleLineSwitch', (val) => {
      visible.value = val
      if (control && control.element) {
        control.element.style.display = val ? '' : 'none'
      }
    })
  }
})

function setupScaleLine() {
  if (!mapInstance) return
  removeAllScaleLineControls(mapInstance)
  control = new ScaleLine({})
  mapInstance.addControl(control)
  if (!visible.value && control.element) {
    control.element.style.display = 'none'
  }
}

onBeforeUnmount(() => {
  // 不再移除控件，始终只挂载一次
})
</script>

<style>
.ol-scale-line {
  z-index: 3000 !important;
  background: rgba(255,255,255,0.95);
  border-radius: 4px;
  padding: 2px 8px;
  margin: 0 20px 20px 0;
  font-size: 14px;
  min-width: 80px;
}
</style>
