<script setup>

import Map from '../Map.vue'
import GeoJSON from 'ol/format/GeoJSON.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import {Fill, Stroke, Circle, Text, Style} from 'ol/style.js'

const style = new Style({
  fill: new Fill({color: 'rgba(0, 0, 0, 1)'}),
  stroke: new Stroke({color: '#319FD3', width: 1}),
  image: new Circle({radius: 5, fill: new Fill({color: 'red'}), stroke: new Stroke({color: 'yellow'})}),
  text: new Text({font: '15px Calibri,sans-serif', offsetY: -15, fill: new Fill({color: '#000'}), stroke: new Stroke({color: '#fff', width: 3})})
})

const vectorLayer = new VectorLayer({
  source: new VectorSource({
    url: 'data/地名.json',
    format: new GeoJSON(),
  }),
  style: (feature) =>
  {
    // 给点添加mc标注
    if (feature.getGeometry().getType() === 'Point')
    {
      style.getText().setText(feature.getProperties().mc)
      style.getText().setFill(new Fill({color: 'rgba(0, 0, 0, 1)'}))
    }
    // 线不添加标注
    if (feature.getGeometry().getType() === 'LineString')
      style.getText().setText('')
    // 给面增加type标注
    if (feature.getGeometry().getType() === 'Polygon')
    {
      style.getText().setText(feature.getProperties().type)
      style.getText().setFill(new Fill({color: 'red'}))
    }
    return style
  },
  // 避免压盖
  declutter: true
})

const onMapCreate = map =>
{
  // 将图层添加到地图上
  map.addLayer(vectorLayer)
}
</script>

<template>
  <Map @created="onMapCreate"></Map>
</template>

<style>
</style>
