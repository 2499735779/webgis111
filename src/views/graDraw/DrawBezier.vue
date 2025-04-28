<script setup>

import Map from '../Map.vue'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import {Stroke, Style} from 'ol/style'
import MathBase from './MathBase'

let params =
{
  pntStart: [12758547.100771412, 3562860.422651869],   // 起点
  pntEnd: [12758782.721245607, 3562864.645241012],     // 中点
  points: [[12758705.180311766, 3562943.36923097]],                        // 控制点
  pntCount: 10                                          // 插入平滑点的个数，值越大曲线约平滑
}

let lineCoor = MathBase.getBezierCurveCoors(params)

const style = new Style({
  stroke: new Stroke({color: 'blue', width: 10 })
})

// 创建一个点Feature对象
const lineFeature = new Feature(new LineString(lineCoor))
const vectorLayer = new VectorLayer({
  source: new VectorSource({
    features: [lineFeature]
  }),
  style
})

const onDrawBezierCreate = map =>
{
  // 将图层添加到地图上
  map.addLayer(vectorLayer)
}
</script>

<template>
  <Map @created="onDrawBezierCreate"></Map>
</template>

<style>
</style>
