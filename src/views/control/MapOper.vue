<script setup>

import Map from '../Map.vue'

let view = null
let zoom = null
let center = null
let rotation = null
const createControl = map =>
{
  view = map.getView()

  // 记录初始状态
  zoom = view.getZoom()
  center = view.getCenter()
  rotation = view.getRotation()
}

// 缩放控制
const onZoom = isZoomIn =>
{
  if (!view)
    return
  
  // 获取当前级别
  const curZoom = view.getZoom()

  // 放大增加一级，缩小减小一级
  view.setZoom(isZoomIn ? curZoom + 1 : curZoom - 1)
}

// 移动到武汉
const onMoveWh = () =>
{
  if (!view)
    return
  
  view.setCenter([114.31667, 30.51667])
  view.setZoom(12)
}

// 复位
const onRestore = () =>
{
  if (!view)
    return
  
  view.setZoom(zoom)
  view.setCenter(center)
  view.setRotation(rotation)
}
</script>

<template>
  <Map @created="createControl"></Map>
  <div class="control">
    <el-button @click="onZoom(true)">放大一级</el-button>
    <el-button @click="onZoom(false)">缩小一级</el-button>
    <el-button @click="onMoveWh('bar')">移动到武汉</el-button>
    <el-button @click="onRestore('bar')">复位</el-button>
  </div>
</template>

<style>
.control {position: absolute;left:80px;top:10px;}
</style>
