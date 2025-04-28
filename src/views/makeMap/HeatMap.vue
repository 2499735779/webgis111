<script setup>
import Heatmap from 'ol/layer/Heatmap'
import VectorSource from 'ol/source/Vector'
import GeoJSONFormat from 'ol/format/GeoJSON'
import Map from '../Map.vue'
import heatData from '/public/data/heatData.js'

const vectorSource = new VectorSource({
  features: (new GeoJSONFormat()).readFeatures(heatData, {dataProjection : 'EPSG:4326', featureProjection : 'EPSG:3857'})
})
const heatMap = new Heatmap({
  source: vectorSource,
  // 热力图聚焦，数值越小越聚焦，越大越散
  blur: 10,
  // 热力图半径，数值越大，点越融合
  radius: 10
})
const onHeatMapCreate = map =>
{
  map.addLayer(heatMap)
  // map.getView().fit(heatMap.getSource().getExtent())
}
</script>

<template>
  <Map @created="onHeatMapCreate"></Map>
</template>

<style>
</style>
