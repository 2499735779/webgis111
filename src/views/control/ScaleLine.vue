<template>
  <!-- 此组件不渲染内容，控件由 OpenLayers 注入 -->
</template>

<script setup>
import ScaleLine from 'ol/control/ScaleLine.js'
import { ref, onMounted, onBeforeUnmount } from 'vue'

let control = null
let mapInstance = null
const visible = ref(true)

// 监听 switch.vue 的开关事件
onMounted(() => {
  mapInstance = window.map
  if (!mapInstance) {
    window.addEventListener('map-created', (e) => {
      mapInstance = e.detail
      setupScaleLine()
    }, { once: true })
  } else {
    setupScaleLine()
  }

  // 监听开关事件
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
  if (control) {
    mapInstance.removeControl(control)
    control = null
  }
  control = new ScaleLine({
    // 不要自定义 className，使用 OpenLayers 默认
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
/* 只做微调，不要用 position: fixed */
.ol-scale-line {
  z-index: 3000 !important;
  background: rgba(255,255,255,0.95);
  border-radius: 4px;
  padding: 2px 8px;
  margin: 0 20px 20px 0; /* 右下角微调 */
  font-size: 14px;
  min-width: 80px;
  pointer-events: none;
}
</style>
