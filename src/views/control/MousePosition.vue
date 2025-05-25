<script setup>
import MousePosition from 'ol/control/MousePosition.js'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Map from '../Map.vue'

const mousePosRef = ref(null)
let control = null
let mapInstance = null
const visible = ref(true)

// 监听 switch.vue 的开关事件
onMounted(() => {
  if (window.__mousePositionEmitter__) {
    window.__mousePositionEmitter__.on('mousePositionSwitch', (val) => {
      visible.value = val
      if (mapInstance && control) {
        control.element.style.display = val ? '' : 'none'
      }
    })
  }
})

const createMousePosition = map => {
  mapInstance = map
  control = new MousePosition({
    className: 'mousPos',
    projection: 'EPSG:4326',
    coordinateFormat: coord => {
      if (!coord) return ''
      const lng = Number(coord[0])
      const lat = Number(coord[1])
      const latDir = lat >= 0 ? '北纬' : '南纬'
      const lngDir = lng >= 0 ? '东经' : '西经'
      return `${latDir}：${Math.abs(lat).toFixed(5)}  ${lngDir}：${Math.abs(lng).toFixed(5)}`
    }
  })
  map.addControl(control)
  // 初始显示状态
  if (!visible.value) {
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

<template>
  <Map @created="createMousePosition"></Map>
  <!-- 控件本身由 OpenLayers 注入到地图容器，无需额外渲染 -->
</template>

<style>
.mousPos {
  position: fixed;
  right: 20px;
  bottom: 20px;
  color: red;
  z-index: 3000;
  pointer-events: none;
  background: rgba(255,255,255,0.8);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 14px;
  min-width: 80px;
}
</style>
