<script setup>
import MousePosition from 'ol/control/MousePosition.js'
import { ref, onMounted, onBeforeUnmount } from 'vue'
import Map from '../Map.vue'

const mousePosRef = ref(null)

const createMousePosition = map =>
{
  // 创建鼠标位置控件，显示经纬度（小数点后5位，自动判别方向，且为EPSG:4326经纬度）
  const control = new MousePosition({
    className: 'mousPos',
    projection: 'EPSG:4326',
    coordinateFormat: coord => {
      if (!coord) return ''
      // EPSG:4326 格式为 [经度, 纬度]
      const lng = Number(coord[0])
      const lat = Number(coord[1])
      const latDir = lat >= 0 ? '北纬' : '南纬'
      const lngDir = lng >= 0 ? '东经' : '西经'
      // 保证只显示5位小数
      return `${latDir}：${Math.abs(lat).toFixed(5)}  ${lngDir}：${Math.abs(lng).toFixed(5)}`
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
