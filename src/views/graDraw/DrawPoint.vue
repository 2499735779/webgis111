<script setup>

import Map from '../Map.vue'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import {Fill, Stroke, Circle, Style} from 'ol/style'

const pointCoor = [12758417.315499168, 3562866.9013162893]

const style = new Style({
  image: new Circle({
    radius: 10,                             // 半径
    fill: new Fill({color: 'red'}),         // 填充色
    stroke: new Stroke({color: 'yellow'})   // 边框
  })
})

// 创建一个点Feature对象
const pointFeature = new Feature(new Point(pointCoor))
const vectorLayer = new VectorLayer({
  source: new VectorSource({
    features: [pointFeature]
  }),
  style
})

const onDrawPointCreate = map =>
{
  // 将图层添加到地图上
  map.addLayer(vectorLayer)
}
</script>

<template>
  <Map @created="onDrawPointCreate"></Map>
</template>

<style>
</style>
