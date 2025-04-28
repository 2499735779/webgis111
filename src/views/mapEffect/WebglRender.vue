<script setup>
import GeoJSON from 'ol/format/GeoJSON'
import Vector from 'ol/source/Vector'
import WebGLPointsLayer from 'ol/layer/WebGLPoints'
import Map from '../Map.vue'

const vectorSource = new Vector({url: 'data/webglData.geojson', format: new GeoJSON(), wrapX: true,})
const style =
{
  symbol: {
    symbolType: 'circle',
    size: ['interpolate', ['linear'], ['get', 'population'], 40000, 8, 2000000, 28,],
    color: ['match', ['get', 'hover'], 1, '#ff3f3f', '#006688'],
    rotateWithView: false,
    offset: [0, 0],
    opacity: ['interpolate', ['linear'], ['get', 'population'], 40000, 0.6, 2000000, 0.92,],
  },
}
const pointsLayer = new WebGLPointsLayer({source: vectorSource, style})
const onWebGlMapCreate = map =>
{
  map.addLayer(pointsLayer)
  map.getView().setCenter([12758500.812471667, 3562517.6293946854])
  map.getView().setZoom(16.632)
}
</script>

<template>
  <Map @created="onWebGlMapCreate"></Map>
</template>

<style>
</style>
