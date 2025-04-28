<script setup>

import Map from '../Map.vue'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import LineString from 'ol/geom/LineString'
import {Stroke, Style} from 'ol/style'

const lineCoor = [[12758417.315499168, 3562866.9013162893], [12758917.315499168, 3562866.9013162893]]

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

const onDrawLineCreate = map =>
{
  // 将图层添加到地图上
  map.addLayer(vectorLayer)
}
</script>

<template>
  <Map @created="onDrawLineCreate"></Map>
</template>

<style>
</style>
