<script setup>

import Map from '../Map.vue'
import GeoJSON from 'ol/format/GeoJSON.js'
import Select from 'ol/interaction/Select.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import {Fill, Stroke, Circle, Text, Style} from 'ol/style.js'
import {click} from 'ol/events/condition.js'
import { ElNotification } from 'element-plus'


let selMap = null

const selectStyle = () =>
{
  return new Style({
    fill: new Fill({
      color: 'red',
    }),
    stroke: new Stroke({
      color: 'rgba(255, 255, 255, 0.7)',
      width: 2,
    }),
    image: new Circle({radius: 5, fill: new Fill({color: '#319FD3'}), stroke: new Stroke({color: '#319FD3'})})
  })
}

const selectClick = new Select({
  condition: click,
  style: selectStyle,
})

const addInteraction = () =>
{
  selMap.addInteraction(selectClick)
  selectClick.on('select', (e) =>
  {
    ElNotification({
      title: '资源信息',
      type: 'success',
      showClose: false,
      message: e.target.getFeatures().getArray()[0].getProperties().type || e.target.getFeatures().getArray()[0].getProperties().mc
    })
  })
}

const onGraSelectCreate = map =>
{
  selMap = map

  const style = new Style({
    fill: new Fill({color: 'rgba(168, 172, 38, 0.6)'}),
    stroke: new Stroke({color: '#319FD3', width: 1}),
    image: new Circle({radius: 5, fill: new Fill({color: 'red'}), stroke: new Stroke({color: 'yellow'})})
  })

  const vectorLayer = new VectorLayer({
    source: new VectorSource({
      url: 'data/地名.json',
      format: new GeoJSON(),
    }),
    style
  })

  // 将图层添加到地图上
  map.addLayer(vectorLayer)
  addInteraction()
}
</script>

<template>
  <Map @created="onGraSelectCreate"></Map>
</template>

<style>
</style>
