<script setup>
import { ref, onMounted, watch } from 'vue'
import ScaleLine from 'ol/control/ScaleLine.js'
import OverviewMap from 'ol/control/OverviewMap.js'

const scaleControl = ref(true)
const overviewControl = ref(true)
const mousePositionControl = ref(true)

const updateControls = () => {
  // 不再清空控件，也不再直接 add/remove 控件
  // 控件的 add/remove 由各自组件内部管理
  // 这里只负责通知 mitt 事件
}

// 监听 mousePositionControl 变化，通知 MousePosition.vue 控制显示/隐藏
import mitt from 'mitt'
const emitter = mitt()
window.__mousePositionEmitter__ = emitter

const scaleLineEmitter = mitt()
window.__scaleLineEmitter__ = scaleLineEmitter

const overviewMapEmitter = mitt()
window.__overviewMapEmitter__ = overviewMapEmitter

watch(mousePositionControl, (val) => {
  emitter.emit('mousePositionSwitch', val)
})
watch(scaleControl, (val) => {
  scaleLineEmitter.emit('scaleLineSwitch', val)
})
watch(overviewControl, (val) => {
  overviewMapEmitter.emit('overviewMapSwitch', val)
})

onMounted(() => {
  updateControls()
})
</script>

<template>
  <div class="control-panel">
    <div class="switches">
      <el-switch v-model="scaleControl" @change="updateControls" /> 比例尺
      <el-switch v-model="overviewControl" @change="updateControls" class="ml-2" /> 鹰眼
      <el-switch v-model="mousePositionControl" class="ml-2" /> 鼠标位置
    </div>
  </div>
</template>

<style scoped>
.switches {
  margin-bottom: 0;
  display: flex;
  flex-direction: row;
  gap: 10px; /* 缩小间距 */
  align-items: center;
  font-size: 13px; /* 缩小字体 */
}
.ml-2 {
  margin-left: 10px; /* 缩小间距 */
}
.control-panel {
  /* 缩小整体尺寸 */
  padding: 4px 10px;
  min-width: 120px;
  min-height: 32px;
  background: rgba(255,255,255,0.95);
  border-radius: 7px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  position: fixed;
  right: 40px;
  bottom: 70px; /* 向上微调，原来40px */
  z-index: 3002;
  pointer-events: auto;
}
.mousPos {
  position: absolute;
  top: 8px;
  right: 8px;
  color: red;
}
</style>
