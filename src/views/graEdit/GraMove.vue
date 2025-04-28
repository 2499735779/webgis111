<script setup>

import Map from '../Map.vue'
import GeoJSON from 'ol/format/GeoJSON.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import {Fill, Stroke, Circle, Text, Style} from 'ol/style.js'
import {Modify} from 'ol/interaction.js'
import {
  never,
  platformModifierKeyOnly,
  primaryAction,
} from 'ol/events/condition.js'

let selMap = null
const style = new Style({
  image: new Circle({radius: 10, fill: new Fill({color: 'red'}), stroke: new Stroke({color: 'yellow'})}),
  text: new Text({font: '12px Calibri,sans-serif', fill: new Fill({color: '#000'}),
    stroke: new Stroke({
      color: '#fff',
      width: 3
    })
  })
})

const vectorLayer = new VectorLayer({
  source: new VectorSource({
    url: 'data/地名.json',
    format: new GeoJSON(),
  }),
  style: (feature) =>
  {
    style.getText().setText(feature.getProperties().mc)
    return style
  }
})

const modify = new Modify({
  source: vectorLayer.getSource(),
  condition: (event) =>
  {
    return primaryAction(event) && !platformModifierKeyOnly(event)
  },
  deleteCondition: never,
  insertVertexCondition: never
})

const changeInteraction = () =>
{
  if (modify !== null)
  {
    selMap.removeInteraction(modify)
    selMap.addInteraction(modify)
  }
}

const onGraMoveCreate = map =>
{
  selMap = map
  // 将图层添加到地图上
  map.addLayer(vectorLayer)
  changeInteraction()
}
</script>

<template>
  <Map @created="onGraMoveCreate"></Map>
</template>

<style>
</style>
