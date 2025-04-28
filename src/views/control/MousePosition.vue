<script setup>
import MousePosition from 'ol/control/MousePosition.js'
import { toStringHDMS } from 'ol/coordinate.js'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Map from '../Map.vue'

const mousePosRef = ref(null)

const createMousePosition = map =>
{
  // 创建鼠标位置控件，显示经纬度（小数点后5位）
  const control = new MousePosition({
    className: 'mousPos',
    projection: 'EPSG:4326',
    coordinateFormat: coord => {
      if (!coord) return ''
      return `经度: ${coord[0].toFixed(5)} , 纬度: ${coord[1].toFixed(5)}`
    }
  })
  map.addControl(control)
}

const updateMousePos = e => {
  const el = mousePosRef.value
  if (!el) return
  el.style.left = ''
  el.style.top = ''
  el.style.right = '20px'
  el.style.bottom = '20px'
}

onMounted(() => {
  window.addEventListener('mousemove', updateMousePos)
})
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', updateMousePos)
})
</script>

<template>
  <Map @created="createMousePosition"></Map>
  <div ref="mousePosRef" class="mousPos"></div>
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
