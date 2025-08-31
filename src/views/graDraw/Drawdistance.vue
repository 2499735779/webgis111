<script setup>
import { ref, onMounted, onBeforeUnmount, watch, nextTick } from 'vue'
import Draw from 'ol/interaction/Draw.js'
import { getLength } from 'ol/sphere.js'
import { Style, Stroke, Circle as CircleStyle, Fill } from 'ol/style.js'
import Overlay from 'ol/Overlay.js'
import LineString from 'ol/geom/LineString.js'
import Feature from 'ol/Feature.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import mitt from 'mitt'

// 确保全局事件总线存在
if (!window.__distanceEmitter__) {
  window.__distanceEmitter__ = mitt();
}

const drawActive = ref(false)
let olmap = null
let draw = null
let lastLineFeature = null
let distanceOverlay = null
let deleteOverlay = null
let startCoord = null
let drawLayer = null // 用于存储测距线图层
const cursorTip = ref('')
const emit = defineEmits(['mounted'])

// 监听来自 switch.vue 的控制事件
window.__distanceEmitter__.on('distanceControlSwitch', (value) => {
  drawActive.value = value;
  
  // 激活时添加特殊类，用于控制鼠标样式
  if (value) {
    if (olmap && olmap.getTargetElement()) {
      olmap.getTargetElement().classList.add('measure-active');
    }
    document.body.classList.add('measure-mode');
  } else {
    if (olmap && olmap.getTargetElement()) {
      olmap.getTargetElement().classList.remove('measure-active');
    }
    document.body.classList.remove('measure-mode');
  }
});

const getMainMap = () => window.map

const setCursor = (cursor) => {
  nextTick(() => {
    if (olmap && olmap.getTargetElement()) {
      olmap.getTargetElement().style.cursor = cursor;
      
      // 确保测距激活时鼠标指针始终是十字形
      if (drawActive.value) {
        olmap.getTargetElement().style.cursor = 'crosshair';
        olmap.getTargetElement().classList.add('measure-active');
        document.body.classList.add('measure-mode');
      }
    }
  })
}

const showCursorTip = (tip) => {
  cursorTip.value = tip
}
const hideCursorTip = () => {
  cursorTip.value = ''
}

// 删除测距线及覆盖物
const deleteLine = () => {
  if (lastLineFeature && drawLayer) {
    drawLayer.getSource().removeFeature(lastLineFeature)
    lastLineFeature = null
  }
  if (distanceOverlay && olmap) {
    olmap.removeOverlay(distanceOverlay)
    distanceOverlay = null
  }
  if (deleteOverlay && olmap) {
    olmap.removeOverlay(deleteOverlay)
    deleteOverlay = null
  }
}

// 头像测距：点击两个用户头像进行测距（禁用个人信息弹窗）
let avatarClickCount = 0
let avatarStartCoord = null
const handleUserMarkerClick = (coord) => {
  if (!drawActive.value) return
  // 禁用个人信息弹窗
  window.__drawdistance_disable_userinfo__ = true
  if (avatarClickCount === 0) {
    avatarStartCoord = coord
    showCursorTip('请输入尾点（可再次点击用户头像）')
    avatarClickCount = 1
    setCursor('crosshair')
  } else if (avatarClickCount === 1) {
    // 画线
    if (avatarStartCoord && coord && drawLayer) {
      if (lastLineFeature) drawLayer.getSource().removeFeature(lastLineFeature)
      const geom = new LineString([avatarStartCoord, coord])
      lastLineFeature = new Feature(geom)
      lastLineFeature.setStyle(new Style({
        stroke: new Stroke({ color: '#a67c52', width: 4 })
      }))
      drawLayer.getSource().addFeature(lastLineFeature)
      const length = getLength(geom)
      showDistanceOverlay(coord, length, [avatarStartCoord, coord])
      showDeleteOverlay([avatarStartCoord, coord])
      setCursor('default')
      hideCursorTip()
      avatarClickCount = 0
      avatarStartCoord = null
      // 关键：延迟关闭测距状态，确保地图弹窗不会在本次点击后立即弹出
      setTimeout(() => {
        drawActive.value = false
        window.__drawdistance_disable_userinfo__ = false
        // 新增：通知switch组件测距已完成
        if (window.__distanceEmitter__) {
          window.__distanceEmitter__.emit('distanceCompleted', false);
        }
        
        // 重置鼠标样式和状态
        if (olmap && olmap.getTargetElement()) {
          olmap.getTargetElement().classList.remove('measure-active');
        }
        document.body.classList.remove('measure-mode');
      }, 300)
    }
  }
}

// 负责测距交互
const enableDraw = () => {
  if (!olmap) return
  
  if (olmap.getTargetElement && !olmap.getTargetElement()) {
    olmap = getMainMap();
    if (!olmap) return;
  }
  
  if (draw) olmap.removeInteraction(draw)
  draw = new Draw({
    type: 'LineString',
    style: new Style({
      stroke: new Stroke({ color: '#a67c52', width: 4 }),
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: '#f5e1a4' }),
        stroke: new Stroke({ color: '#a67c52', width: 3 })
      })
    }),
    maxPoints: 2
  })
  
  try {
    // 强制调用一次确保地图元素有正确的CSS类
    if (olmap.getTargetElement) {
      const mapEl = olmap.getTargetElement();
      if (mapEl) {
        mapEl.classList.add('measure-active');
      }
    }
    
    document.body.classList.add('measure-mode');
    olmap.addInteraction(draw);
  } catch (err) {
    return;
  }
  
  // 测距模式下强制设置鼠标样式为十字
  setCursor('crosshair');
  showCursorTip('请确定首点');

  // 鼠标移动时，跟随显示提示
  const moveHandler = (evt) => {
    if (!drawActive.value) return
    const mapTarget = olmap.getTargetElement()
    const tipEl = document.getElementById('drawdistance-cursor-tip')
    if (tipEl && mapTarget && evt.pixel) {
      const rect = mapTarget.getBoundingClientRect()
      tipEl.style.left = rect.left + evt.pixel[0] + 18 + 'px'
      tipEl.style.top = rect.top + evt.pixel[1] + 18 + 'px'
    }
  }
  olmap.on('pointermove', moveHandler)

  draw.on('drawstart', (evt) => {
    showCursorTip('请输入尾点')
    if (lastLineFeature && drawLayer) {
      drawLayer.getSource().removeFeature(lastLineFeature)
      lastLineFeature = null
    }
    if (distanceOverlay) {
      olmap.removeOverlay(distanceOverlay)
      distanceOverlay = null
    }
    if (deleteOverlay) {
      olmap.removeOverlay(deleteOverlay)
      deleteOverlay = null
    }
    startCoord = evt.feature.getGeometry().getFirstCoordinate()
  })
  draw.on('drawend', (evt) => {
    // 画线并显示
    const geom = evt.feature.getGeometry()
    const coords = geom.getCoordinates()
    if (coords.length === 2) {
      if (lastLineFeature && drawLayer) {
        drawLayer.getSource().removeFeature(lastLineFeature)
      }
      lastLineFeature = new Feature(new LineString(coords))
      lastLineFeature.setStyle(new Style({
        stroke: new Stroke({ color: '#a67c52', width: 4 })
      }))
      drawLayer.getSource().addFeature(lastLineFeature)
      const length = getLength(geom)
      showDistanceOverlay(coords[1], length, coords)
      showDeleteOverlay(coords)
    }
    setCursor('default')
    hideCursorTip()
    olmap.removeInteraction(draw)
    olmap.un('pointermove', moveHandler)
    drawActive.value = false
    avatarClickCount = 0
    avatarStartCoord = null

    // 通知switch组件测距已完成
    if (window.__distanceEmitter__) {
      window.__distanceEmitter__.emit('distanceCompleted', false);
    }
    
    // 移除测距状态
    if (olmap && olmap.getTargetElement()) {
      olmap.getTargetElement().classList.remove('measure-active');
    }
    document.body.classList.remove('measure-mode');
    
    setTimeout(() => { window.__drawdistance_disable_userinfo__ = false }, 200)
  })
}

const showDistanceOverlay = (coord, length, coords) => {
  if (distanceOverlay) olmap.removeOverlay(distanceOverlay)
  const el = document.createElement('div')
  el.className = 'distance-label'
  el.innerText = `距离: ${(length / 1000).toFixed(3)} km`

  // 计算中点
  const midX = (coords[0][0] + coords[1][0]) / 2
  const midY = (coords[0][1] + coords[1][1]) / 2
  
  // 修改：增加垂直偏移距离，让标签离线段更远
  const offset = 50  // 原来是30，现在增加到50
  
  // 设置标签位置在线段中点上方
  distanceOverlay = new Overlay({
    element: el,
    position: [midX, midY],
    positioning: 'center-center',
    offset: [0, -offset]  // 向上偏移更多距离
  })
  olmap.addOverlay(distanceOverlay)
}

// 显示垃圾桶按钮
const showDeleteOverlay = (coords) => {
  if (deleteOverlay) olmap.removeOverlay(deleteOverlay)
  // 取中点
  const mid = [
    (coords[0][0] + coords[1][0]) / 2,
    (coords[0][1] + coords[1][1]) / 2
  ]
  const el = document.createElement('div')
  el.className = 'delete-btn-overlay'
  el.title = '删除测距线'
  el.innerHTML = `
    <button class="cuphead-delete-btn" aria-label="删除测距线">
      <svg width="20" height="20" viewBox="0 0 1024 1024" fill="#7c4a1e">
        <path d="M320 896c0 35.2 28.8 64 64 64h256c35.2 0 64-28.8 64-64V320H320v576zM432 416h64v384h-64V416zm160 0h64v384h-64V416zM832 192h-160V128c0-35.2-28.8-64-64-64h-128c-35.2 0-64 28.8-64 64v64H192c-17.6 0-32 14.4-32 32v32c0 17.6 14.4 32 32 32h640c17.6 0 32-14.4 32-32v-32c0-17.6-14.4-32-32-32zM432 128h160v64H432V128z"/>
      </svg>
    </button>
  `
  el.querySelector('.cuphead-delete-btn').onclick = (e) => {
    e.stopPropagation()
    deleteLine()
  }
  deleteOverlay = new Overlay({
    element: el,
    position: mid,
    positioning: 'center-center',
    stopEvent: true
  })
  olmap.addOverlay(deleteOverlay)
}

onMounted(() => {
  olmap = getMainMap()
  if (!olmap) {
    // 地图未初始化，监听 map-created 事件
    window.addEventListener('map-created', (e) => {
      olmap = e.detail
      initializeDrawLayer()
      setupClickHandlers()
      emit('mounted')
    }, { once: true })
    return
  }
  
  initializeDrawLayer()
  setupClickHandlers()
  emit('mounted')
})

// 初始化绘图图层
function initializeDrawLayer() {
  // 保证有一个 vector source 用于画线
  if (!olmap.getSource) {
    drawLayer = new VectorLayer({
      source: new VectorSource()
    })
    olmap.addLayer(drawLayer)
    olmap.getSource = () => drawLayer.getSource()
  } else {
    // 如果已经有 getSource，找到 vectorLayer
    drawLayer = olmap.getLayers().getArray().find(l => l instanceof VectorLayer)
    if (!drawLayer) {
      // 如果没找到，创建一个
      drawLayer = new VectorLayer({
        source: new VectorSource()
      })
      olmap.addLayer(drawLayer)
    }
  }
}

// 设置点击处理函数
function setupClickHandlers() {
  // 监听用户头像点击事件
  olmap.getViewport().addEventListener('click', (e) => {
    if (!drawActive.value) return
    // 激活时全局变量赋值
    window.__drawdistance_disable_userinfo__ = true
    let marker = e.target.closest && e.target.closest('.user-marker')
    if (marker && marker.__ol_position) {
      handleUserMarkerClick(marker.__ol_position)
    } else if (marker && marker.dataset && marker.dataset.olPosition) {
      try {
        const coord = JSON.parse(marker.dataset.olPosition)
        handleUserMarkerClick(coord)
      } catch {}
    }
  })
  
  // 监听普通点击事件，确保测距模式下鼠标样式保持十字形
  olmap.on('click', function(evt) {
    if (drawActive.value) {
      setCursor('crosshair');
    }
  });
}

watch(drawActive, (val) => {
  // 激活时立即赋值，关闭时立即清除
  if (val) {
    window.__drawdistance_disable_userinfo__ = true
    avatarClickCount = 0
    avatarStartCoord = null
    
    // 确保测距工具激活时控件显示
    if (window.__mapControlEmitter__) {
      window.__mapControlEmitter__.emit('setControlsVisible', true);
    }
    
    // 添加测距模式CSS类
    if (olmap && olmap.getTargetElement()) {
      olmap.getTargetElement().classList.add('measure-active');
    }
    document.body.classList.add('measure-mode');
    
    // 确保在下一个事件循环中启用绘图，避免与其他事件冲突
    nextTick(() => {
      enableDraw()
    })
  } else {
    // 只有不是延迟关闭时才清除
    setTimeout(() => {
      if (!drawActive.value) window.__drawdistance_disable_userinfo__ = false
    }, 350)
    setCursor('default')
    hideCursorTip()
    if (draw && olmap) olmap.removeInteraction(draw)
    avatarClickCount = 0
    avatarStartCoord = null
    
    // 移除测距模式CSS类
    if (olmap && olmap.getTargetElement()) {
      olmap.getTargetElement().classList.remove('measure-active');
    }
    document.body.classList.remove('measure-mode');
  }
})

onBeforeUnmount(() => {
  // 取消事件监听
  if (window.__distanceEmitter__) {
    window.__distanceEmitter__.off('distanceControlSwitch');
  }
  
  if (draw && olmap) olmap.removeInteraction(draw)
  setCursor('default')
  hideCursorTip()
  if (distanceOverlay && olmap) olmap.removeOverlay(distanceOverlay)
  if (deleteOverlay && olmap) olmap.removeOverlay(deleteOverlay)
  if (lastLineFeature && drawLayer) drawLayer.getSource().removeFeature(lastLineFeature)
  window.__drawdistance_disable_userinfo__ = false
  
  // 移除测距模式CSS类
  if (olmap && olmap.getTargetElement()) {
    olmap.getTargetElement().classList.remove('measure-active');
  }
  document.body.classList.remove('measure-mode');
})
</script>

<template>
  <!-- 显示鼠标提示 -->
  <div
    v-if="drawActive && cursorTip"
    id="drawdistance-cursor-tip"
    class="drawdistance-cursor-tip"
  >{{ cursorTip }}</div>
</template>

<style>
/* 鼠标提示样式 */
.drawdistance-cursor-tip {
  position: fixed !important;
  pointer-events: none !important;
  left: 0 !important;
  top: 0 !important;
  background: linear-gradient(90deg, #f5e1a4 0%, #ffe066 100%) !important;
  color: #7c4a1e !important;
  padding: 8px 16px !important;
  border-radius: 12px !important;
  font-size: 16px !important;
  z-index: 999999 !important;
  white-space: nowrap !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
  transform: none !important;
  font-family: 'JiangxiZhuokai', cursive, sans-serif !important;
  border: 2px solid #a67c52 !important;
  font-weight: bold !important;
  text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.7) !important;
}

/* 测距标签样式 */
.distance-label {
  background: linear-gradient(90deg, #f5e1a4 0%, #ffe066 100%) !important;
  color: #7c4a1e !important;
  padding: 8px 12px !important;
  border-radius: 12px !important;
  font-size: 16px !important;
  box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
  white-space: nowrap !important;
  font-family: 'JiangxiZhuokai', cursive, sans-serif !important;
  border: 2px solid #a67c52 !important;
  font-weight: bold !important;
  text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.7) !important;
  padding: 6px 16px !important;
  min-width: 120px !important;
  text-align: center !important;
  z-index: 999999 !important;
}

/* 删除按钮容器 */
.delete-btn-overlay {
  background: transparent !important;
  border: none !important;
  z-index: 999999 !important;
  pointer-events: auto !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

/* 删除按钮样式 */
.cuphead-delete-btn {
  background: #fffbe6 !important;
  border: 2px solid #a67c52 !important;
  border-radius: 50% !important;
  width: 40px !important;
  height: 40px !important;
  cursor: pointer !important;
  padding: 8px !important;
  margin: 0 !important;
  outline: none !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: all 0.2s !important;
  position: relative !important;
  overflow: hidden !important;
}

/* 删除按钮装饰效果 */
.cuphead-delete-btn::after {
  content: "" !important;
  position: absolute !important;
  left: 0 !important;
  right: 0 !important;
  top: 0 !important;
  bottom: 0 !important;
  background: radial-gradient(circle, transparent 60%, rgba(255, 255, 255, 0.7) 100%) !important;
  opacity: 0 !important;
  transition: opacity 0.2s !important;
}

/* 删除按钮悬停效果 */
.cuphead-delete-btn:hover {
  background: #ffeba0 !important;
  box-shadow: 0 6px 16px rgba(166, 124, 82, 0.4) !important;
  transform: translateY(-2px) scale(1.05) !important;
}

.cuphead-delete-btn:hover::after {
  opacity: 1 !important;
}

/* 删除按钮点击效果 */
.cuphead-delete-btn:active {
  transform: translateY(1px) scale(0.95) !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1) !important;
  background: #f5e1a4 !important;
}

/* 删除按钮图标样式 */
.cuphead-delete-btn svg {
  display: block !important;
  width: 22px !important;
  height: 22px !important;
  fill: #7c4a1e !important;
  transition: fill 0.2s !important;
}

/* 全局测距模式样式 */
.measure-active {
  cursor: crosshair !important;
}

body.measure-mode .ol-viewport {
  cursor: crosshair !important;
}

body.measure-mode .ol-viewport * {
  cursor: crosshair !important;
}

/* 确保测距相关元素在测距模式下可见 */
body.measure-mode .drawdistance-cursor-tip,
body.measure-mode .distance-label,
body.measure-mode .delete-btn-overlay {
  visibility: visible !important;
  opacity: 1 !important;
  z-index: 999999 !important;
  pointer-events: auto !important;
}
</style>

<!-- 添加全局字体样式 -->
<style>
@font-face {
  font-family: 'JiangxiZhuokai';
  src: url('/fonts/jiangxi-zhoukai/jiangxizhuokai-Regular.woff2') format('woff2'),
       url('/fonts/jiangxi-zhoukai/jiangxizhuokai-Regular.woff') format('woff');
  font-display: swap;
}
</style>

