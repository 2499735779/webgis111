<script setup>
import ScaleLine from 'ol/control/ScaleLine.js'
import Map from '../Map.vue'

let olmap = null
let scale = null
const createScale = map =>
{
  olmap = map
  onScaleChange()
}

const onScaleChange = type =>
{
  if (!olmap)
    return

  // 移除旧比例尺
  scale && olmap.removeControl(scale)
  // 创建新比例尺，指定 target
  scale = new ScaleLine({
    bar: type === 'bar',
    target: document.getElementById('scale-container') // 关键：指定自定义容器
  })
  olmap.addControl(scale)
}
</script>

<template>
  <Map @created="createScale"></Map>
  <div id="scale-container" class="scale-custom"></div>
  <div class="control">
    <el-button @click="onScaleChange('line')">比例尺线</el-button>
    <el-button @click="onScaleChange('bar')">比例尺条</el-button>
  </div>
</template>

<style>
.control {
  position: absolute;
  left: 200px;
  top: 0;           /* 顶部对齐，浮于menu之上 */
  width: 200px;
  z-index: 1101;    /* 比menu更高，确保浮于其上 */
  pointer-events: auto;
  background: rgba(255,255,255,0.8);
  padding: 4px 0;
  border-radius: 4px;
}
.scale-custom {
  position: absolute;
  left: 200px;      /* 菜单宽度 */
  top: 0;           /* 顶部对齐，浮于menu之上 */
  width: 200px;
  z-index: 1200;    /* 更高，确保比例尺控件浮于menu之上 */
  background: rgba(255,255,255,0.8);
  border-radius: 4px;
  padding: 2px 8px;
  pointer-events: none;
}
</style>
