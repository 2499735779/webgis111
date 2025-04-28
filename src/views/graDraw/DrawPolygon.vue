<script setup>

import Map from '../Map.vue'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Polygon from 'ol/geom/Polygon'
import {Fill, Style} from 'ol/style'

const polygonCoor = [[[12758417.315499168, 3562866.9013162893],
  [12758917.315499168, 3562866.9013162893],
  [12758617.315499168, 3563166.9013162893],
  [12758417.315499168, 3562866.9013162893]]]

const style = new Style({
  fill: new Fill({color: 'blue'})
})

// 创建一个点Feature对象
const polygonFeature = new Feature(new Polygon(polygonCoor))
const vectorLayer = new VectorLayer({
  source: new VectorSource({
    features: [polygonFeature]
  }),
  style
})

const onDrawPolygonCreate = map =>
{
  // 将图层添加到地图上
  map.addLayer(vectorLayer)
}
</script>

<template>
  <Map @created="onDrawPolygonCreate"></Map>
</template>

<style>
</style>
