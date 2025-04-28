<script setup>

import Map from '../Map.vue'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import Feature from 'ol/Feature'
import Point from 'ol/geom/Point'
import LineString from 'ol/geom/LineString'
import Polygon from 'ol/geom/Polygon'
import {Fill, Stroke, Circle, Text, Style} from 'ol/style'

const pointCoor = [12758547.100771412, 3562860.422651869]
const lineCoor = [[12758407.315499168, 3562866.9013162893], [12758547.100771412, 3562860.422651869]]
const polygonCoor = [[[12758547.100771412, 3562860.422651869],
  [12758705.180311766, 3562983.36923097],
  [12758782.721245607, 3562864.645241012],
  [12758547.100771412, 3562860.422651869]]]

const style = new Style({
  fill: new Fill({color: 'rgba(255, 255, 255, 0.4)'}),
  stroke: new Stroke({color: '#319FD3', width: 3}),
  image: new Circle({radius: 20, fill: new Fill({color: 'red'}), stroke: new Stroke({color: 'yellow'})}),
  text: new Text({text: '标注', font: '16px Calibri,sans-serif', fill: new Fill({color: '#000'}), stroke: new Stroke({color: '#fff', width: 3})
  })
})

const pointFeature = new Feature(new Point(pointCoor))
const lineFeature = new Feature(new LineString(lineCoor))
const polygonFeature = new Feature(new Polygon(polygonCoor))
const vectorLayer = new VectorLayer({
  source: new VectorSource({
    features: [pointFeature, lineFeature, polygonFeature]
  }),
  style
})

const onCustomStyleCreate = map =>
{
  // 将图层添加到地图上
  map.addLayer(vectorLayer)
}
</script>

<template>
  <Map @created="onCustomStyleCreate"></Map>
</template>

<style>
</style>
