<script setup>

import Map from '../Map.vue'
import GeoJSON from 'ol/format/GeoJSON.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import {Fill, Stroke, Circle, Text, Style} from 'ol/style.js'
import Cluster from 'ol/source/Cluster'

const style = new Style({
  fill: new Fill({color: 'rgba(168, 172, 38, 0.6)'}),
  stroke: new Stroke({color: '#319FD3', width: 1}),
  image: new Circle({radius: 5, fill: new Fill({color: 'red'}), stroke: new Stroke({color: 'yellow'})}),
  text: new Text({font: '12px Calibri,sans-serif', offsetY: -15, fill: new Fill({color: '#000'}), stroke: new Stroke({color: '#fff', width: 3})})
})

// 这里注意，Cluster只支持点feature对象
let source= new VectorSource({
  url: 'data/地名.json',
  format: new GeoJSON(),
})

let cluster = new Cluster({             // 创建聚合标注对象
  distance: 100,                         // 设置聚合标注的距离
  source: source
})

const vectorLayer = new VectorLayer({
  source: cluster,
  style: (feature) =>
  {
    // 给点添加mc标注
    if (feature.getGeometry().getType() === 'Point')
    {
      const feaNum = feature.getProperties().features.length
      style.getText().setText(feaNum === 1 ? feature.getProperties().features[0].getProperties().mc : feaNum.toString())
      style.getText().setFill(new Fill({color: 'green'}))
    }
    return style
  }
})

const onClusterLabelCreate = map =>
{
  // 将图层添加到地图上
  map.addLayer(vectorLayer)
}
</script>

<template>
  <Map @created="onClusterLabelCreate"></Map>
</template>

<style>
</style>
