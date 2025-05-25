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

const drawActive = ref(false)
let olmap = null
let draw = null
let lastLineFeature = null
let distanceOverlay = null
let deleteOverlay = null
let startCoord = null
let drawLayer = null // 用于存储测距线图层
const cursorTip = ref('')

const getMainMap = () => window.map

const setCursor = (cursor) => {
  nextTick(() => {
    if (olmap && olmap.getTargetElement()) {
      olmap.getTargetElement().style.cursor = cursor
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
        stroke: new Stroke({ color: '#409eff', width: 3 })
      }))
      drawLayer.getSource().addFeature(lastLineFeature)
      const length = getLength(geom)
      showDistanceOverlay(coord, length)
      showDeleteOverlay([avatarStartCoord, coord])
      setCursor('default')
      hideCursorTip()
      avatarClickCount = 0
      avatarStartCoord = null
      // 关键：延迟关闭测距状态，确保地图弹窗不会在本次点击后立即弹出
      setTimeout(() => {
        drawActive.value = false
        window.__drawdistance_disable_userinfo__ = false
      }, 300)
    }
  }
}

// 只负责测距交互，不再移除/恢复地图控件
const enableDraw = () => {
  if (!olmap) return
  if (draw) olmap.removeInteraction(draw)
  draw = new Draw({
    type: 'LineString',
    style: new Style({
      stroke: new Stroke({ color: '#409eff', width: 3 }),
      image: new CircleStyle({
        radius: 5,
        fill: new Fill({ color: '#409eff' }),
        stroke: new Stroke({ color: '#fff', width: 2 })
      })
    }),
    maxPoints: 2
  })
  olmap.addInteraction(draw)
  setCursor('crosshair')
  showCursorTip('请确定首点')

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
        stroke: new Stroke({ color: '#409eff', width: 3 })
      }))
      drawLayer.getSource().addFeature(lastLineFeature)
      const length = getLength(geom)
      showDistanceOverlay(coords[1], length)
      showDeleteOverlay(coords)
    }
    setCursor('default')
    hideCursorTip()
    olmap.removeInteraction(draw)
    olmap.un('pointermove', moveHandler)
    drawActive.value = false
    avatarClickCount = 0
    avatarStartCoord = null
    setTimeout(() => { window.__drawdistance_disable_userinfo__ = false }, 200)
  })
}

const showDistanceOverlay = (coord, length) => {
  if (distanceOverlay) olmap.removeOverlay(distanceOverlay)
  const el = document.createElement('div')
  el.className = 'distance-label'
  el.innerText = `距离: ${(length / 1000).toFixed(3)} km`
  distanceOverlay = new Overlay({
    element: el,
    position: coord,
    positioning: 'bottom-center'
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
    <button class="delete-btn" style="background:transparent;border:none;cursor:pointer;">
      <svg width="22" height="22" viewBox="0 0 1024 1024" fill="#f56c6c"><path d="M320 896c0 35.2 28.8 64 64 64h256c35.2 0 64-28.8 64-64V320H320v576zM432 416h64v384h-64V416zm160 0h64v384h-64V416zM832 192h-160V128c0-35.2-28.8-64-64-64h-128c-35.2 0-64 28.8-64 64v64H192c-17.6 0-32 14.4-32 32v32c0 17.6 14.4 32 32 32h640c17.6 0 32-14.4 32-32v-32c0-17.6-14.4-32-32-32zM432 128h160v64H432V128z"/></svg>
    </button>
  `
  el.querySelector('.delete-btn').onclick = (e) => {
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
      // 复制 onMounted 里的初始化逻辑到这里
      if (!olmap.getSource) {
        drawLayer = new VectorLayer({
          source: new VectorSource()
        })
        olmap.addLayer(drawLayer)
        olmap.getSource = () => drawLayer.getSource()
      } else {
        drawLayer = olmap.getLayers().getArray().find(l => l instanceof VectorLayer)
      }
      olmap.getViewport().addEventListener('click', (e) => {
        if (!drawActive.value) return
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
      console.log('[Drawdistance] 初始化完成(延迟)')
    }, { once: true })
    return
  }
  // 保证有一个 vector source 用于画线
  if (!olmap.getSource) {
    drawLayer = new VectorLayer({
      source: new VectorSource()
    })
    olmap.addLayer(drawLayer)
    olmap.getSource = () => drawLayer.getSource()
    console.log('[Drawdistance] 新增vectorLayer并挂载getSource')
  } else {
    // 如果已经有 getSource，找到 vectorLayer
    drawLayer = olmap.getLayers().getArray().find(l => l instanceof VectorLayer)
  }
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
  console.log('[Drawdistance] 初始化完成')
})

watch(drawActive, (val) => {
  console.log('[Drawdistance] drawActive changed:', val)
  // 激活时立即赋值，关闭时立即清除
  if (val) {
    window.__drawdistance_disable_userinfo__ = true
    nextTick(() => {
      const panel = document.querySelector('.distance-switch-panel')
      if (panel) panel.style.pointerEvents = 'auto'
    })
    avatarClickCount = 0
    avatarStartCoord = null
    enableDraw()
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
  }
})

onBeforeUnmount(() => {
  if (draw && olmap) olmap.removeInteraction(draw)
  setCursor('default')
  hideCursorTip()
  if (distanceOverlay && olmap) olmap.removeOverlay(distanceOverlay)
  if (deleteOverlay && olmap) olmap.removeOverlay(deleteOverlay)
  if (lastLineFeature && drawLayer) drawLayer.getSource().removeFeature(lastLineFeature)
  window.__drawdistance_disable_userinfo__ = false
  console.log('[Drawdistance] onBeforeUnmount')
})
</script>

<template>
  <div class="distance-switch-panel" style="pointer-events:auto;">
    <el-switch v-model="drawActive" active-text="测距" inactive-text="" />
    <div
      v-if="drawActive && cursorTip"
      id="drawdistance-cursor-tip"
      class="drawdistance-cursor-tip"
    >{{ cursorTip }}</div>
  </div>
</template>

<style scoped>
.distance-switch-panel {
  position: fixed;
  right: 40px;
  bottom: 110px;
  z-index: 1202;
  background: rgba(255,255,255,0.95);
  border-radius: 7px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  padding: 4px 8px; /* 缩小内边距 */
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 8px; /* 缩小间距 */
  pointer-events: auto;
  min-width: 90px;  /* 缩小最小宽度 */
  min-height: 32px;
}
.distance-label {
  background: #409eff;
  color: #fff;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 13px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  white-space: nowrap;
}
.drawdistance-cursor-tip {
  position: fixed;
  pointer-events: none;
  left: 0;
  top: 0;
  background: #409eff;
  color: #fff;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 13px;
  z-index: 99999;
  white-space: nowrap;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  transform: none;
}
.delete-btn-overlay {
  background: transparent;
  border: none;
  z-index: 99999;
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
}
.delete-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  margin: 0;
  outline: none;
}
.delete-btn svg {
  display: block;
}
</style>
