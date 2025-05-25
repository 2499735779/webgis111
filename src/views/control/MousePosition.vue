<template>
  <!-- 此组件不渲染任何内容，控件由 OpenLayers 注入 -->
</template>

<script setup>
import MousePosition from 'ol/control/MousePosition.js'
import { ref, onMounted, onBeforeUnmount } from 'vue'

let control = null
let mapInstance = null
const visible = ref(true)

// 全局挂载标记，防止重复挂载
if (!window.__mousePositionMounted__) {
  window.__mousePositionMounted__ = false
}

function removeAllMousePositionControls(map) {
  if (!map) return
  // 移除所有 MousePosition 控件，避免重叠
  map.getControls().getArray().forEach(ctrl => {
    // 兼容热重载和多实例情况
    if (
      ctrl instanceof MousePosition ||
      (ctrl.constructor && ctrl.constructor.name === 'MousePosition')
    ) {
      map.removeControl(ctrl)
    }
  })
}

onMounted(() => {
  // 如果已挂载过，直接返回，避免重复
  if (window.__mousePositionMounted__) return
  // 获取全局 map 实例
  mapInstance = window.map
  if (!mapInstance) {
    // 地图未初始化，等待地图创建事件
    window.addEventListener('map-created', (e) => {
      mapInstance = e.detail
      removeAllMousePositionControls(mapInstance)
      setupMousePosition()
      window.__mousePositionMounted__ = true
    }, { once: true })
  } else {
    removeAllMousePositionControls(mapInstance)
    setupMousePosition()
    window.__mousePositionMounted__ = true
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
  // 再次确保无重叠
  removeAllMousePositionControls(mapInstance)
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
    render: function(mapEvent) {
      // 调用原始render逻辑
      const result = MousePosition.prototype.render.call(this, mapEvent)
      // 强制所有子节点opacity为1
      const element = this.element
      if (element) {
        element.style.color = '#000'
        element.style.opacity = '1'
        function setOpacityAll(node) {
          if (node && node.style) node.style.opacity = '1'
          if (node && node.childNodes) {
            node.childNodes.forEach(setOpacityAll)
          }
        }
        setOpacityAll(element)
      }
      return result
    }
  })
  mapInstance.addControl(control)
  // 初始显示状态
  if (!visible.value && control.element) {
    control.element.style.display = 'none'
  }
}

onBeforeUnmount(() => {
  // 不再移除控件，始终只挂载一次
  // 如果你希望彻底移除控件，可以在此处 window.__mousePositionMounted__ = false
})
</script>

<style>
.mousPos,
.mousPos * {
  color: #000000 !important;
  opacity: 1 !important;
}
.mousPos {
  /* 放回右下角并禁止点击 */
  position: fixed;
  right: 20px;
  bottom: 20px;
  left: auto;
  top: auto;
  transform: none;
  z-index: 3000;
  pointer-events: none; /* 禁止点击 */
  background: rgba(255,255,255,0.8);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 14px;
  min-width: 80px;
}
</style>
