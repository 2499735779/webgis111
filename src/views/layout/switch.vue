<script setup>
import { ref, onMounted, watch } from 'vue'
import ScaleLine from 'ol/control/ScaleLine.js'
import OverviewMap from 'ol/control/OverviewMap.js'

const scaleControl = ref(true)
const overviewControl = ref(true)
const mousePositionControl = ref(true)

const updateControls = () => {
  const map = window.map
  if (!map) return

  map.getControls().clear()

  if (scaleControl.value) map.addControl(new ScaleLine())
  if (overviewControl.value) {
    const baseLayer = map.getLayers().item(0)
    map.addControl(
      new OverviewMap({
        collapsed: false,
        layers: [baseLayer],
      })
    )
  }
  // 不再在这里处理 MousePosition 控件的 add/remove
  // MousePosition 控件的挂载和显示/隐藏由 MousePosition.vue 组件内部根据 mousePositionControl 控制
  // 这里只负责开关状态
}

// 监听 mousePositionControl 变化，通知 MousePosition.vue 控制显示/隐藏
import mitt from 'mitt'
const emitter = mitt()
window.__mousePositionEmitter__ = emitter

watch(mousePositionControl, (val) => {
  emitter.emit('mousePositionSwitch', val)
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
  gap: 18px;
  align-items: center;
  font-size: 15px;
}
.ml-2 {
  margin-left: 18px;
}
.mousPos {
  position: absolute;
  top: 8px;
  right: 8px;
  color: red;
}
</style>
