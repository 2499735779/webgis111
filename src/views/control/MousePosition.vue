<template>
  <!-- 此组件不渲染任何内容，控件由 OpenLayers 注入 -->
</template>

<script setup>
import MousePosition from 'ol/control/MousePosition.js'
import { ref, onMounted, onBeforeUnmount } from 'vue'

let control = null
let mapInstance = null
const visible = ref(true)

function log(...args) {
  console.log('[MousePosition]', ...args)
}

// 监听 switch.vue 的开关事件
onMounted(() => {
  log('组件挂载，尝试获取 window.map:', window.map)
  // 获取全局 map 实例
  mapInstance = window.map
  if (!mapInstance) {
    log('window.map 未初始化，监听 map-created 事件')
    // 地图未初始化，等待地图创建事件
    window.addEventListener('map-created', (e) => {
      mapInstance = e.detail
      log('收到 map-created 事件，mapInstance:', mapInstance)
      setupMousePosition()
    }, { once: true })
  } else {
    log('window.map 已存在，直接 setupMousePosition')
    setupMousePosition()
  }

  // 监听开关事件
  if (window.__mousePositionEmitter__) {
    log('监听 mousePositionSwitch 事件')
    window.__mousePositionEmitter__.on('mousePositionSwitch', (val) => {
      log('收到 mousePositionSwitch 事件，visible:', val)
      visible.value = val
      if (control && control.element) {
        control.element.style.display = val ? '' : 'none'
      }
    })
  } else {
    log('window.__mousePositionEmitter__ 不存在')
  }
})

function setupMousePosition() {
  log('setupMousePosition 被调用，mapInstance:', mapInstance)
  if (!mapInstance) {
    log('mapInstance 不存在，返回')
    return
  }
  // 避免重复添加控件
  if (control) {
    log('已有 control，先移除')
    mapInstance.removeControl(control)
    control = null
  }
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
    // 关键：指定 target 为 null，确保控件被自动插入到地图容器
    target: null
  })
  mapInstance.addControl(control)
  log('已 addControl 到 mapInstance', control)
  // 检查控件 DOM 是否已插入
  setTimeout(() => {
    const el = document.querySelector('.mousPos')
    log('控件DOM:', el)
  }, 500)
  // 初始显示状态
  if (!visible.value && control.element) {
    control.element.style.display = 'none'
    log('初始状态为隐藏')
  }
}

onBeforeUnmount(() => {
  log('组件卸载')
  if (mapInstance && control) {
    mapInstance.removeControl(control)
    control = null
    log('已移除 control')
  }
})
</script>

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
