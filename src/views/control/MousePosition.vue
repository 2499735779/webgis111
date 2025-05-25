<template>
  <!-- 此组件不渲染任何内容，控件由 OpenLayers 注入 -->
</template>

<script setup>
import MousePosition from 'ol/control/MousePosition.js'
import { ref, onMounted, onBeforeUnmount } from 'vue'

let control = null
let mapInstance = null
const visible = ref(true)

// 监听 switch.vue 的开关事件
onMounted(() => {
  // 获取全局 map 实例
  mapInstance = window.map
  if (!mapInstance) {
    // 地图未初始化，等待地图创建事件
    window.addEventListener('map-created', (e) => {
      mapInstance = e.detail
      setupMousePosition()
    }, { once: true })
  } else {
    setupMousePosition()
  }

  // 监听开关事件
  if (window.__mousePositionEmitter__) {
    window.__mousePositionEmitter__.on('mousePositionSwitch', (val) => {
      visible.value = val
      if (control && control.element) {
        control.element.style.display = val ? '' : 'none'
      }
    })
  }
})

function setupMousePosition() {
  if (!mapInstance) return
  // 移除所有已存在的 MousePosition 控件，避免重复
  mapInstance.getControls().getArray().forEach(ctrl => {
    if (ctrl instanceof MousePosition) mapInstance.removeControl(ctrl)
  })
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
    },
    target: null,
    // 关键：自定义render，强制颜色
    render: function(mapEvent) {
      const element = this.element;
      if (element) {
        element.style.color = '#222';
        element.style.opacity = '1';
        // 递归设置所有子元素
        Array.from(element.querySelectorAll('*')).forEach(el => {
          el.style.color = '#222';
          el.style.opacity = '1';
        });
      }
      // 调用原始render逻辑
      return MousePosition.prototype.render.call(this, mapEvent);
    }
  })
  mapInstance.addControl(control)
  // 初始显示状态
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
.mousPos,
.mousPos * {
  color: #222 !important;
  opacity: 1 !important;
}
.mousPos {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 3000;
  pointer-events: none;
  background: rgba(255,255,255,0.8);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 14px;
  min-width: 80px;
}
</style>
