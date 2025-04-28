<script setup>
import {Fill, Style} from 'ol/style'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import GeoJSONFormat from 'ol/format/GeoJSON'
import Overlay from 'ol/Overlay'

import { createApp } from 'vue'

import Map from '../Map.vue'
import ComEchart from './ComEchart.vue'
import statData from '/public/data/statData.js'

const layer = new VectorLayer({source: new VectorSource()})
// 解析geojson数据创建feature集合
const featureList = (new GeoJSONFormat()).readFeatures(statData, {dataProjection : 'EPSG:4326', featureProjection : 'EPSG:3857'})
// 给所有feature设置样式
featureList.forEach(feature => feature.setStyle(new Style({fill: new Fill({color: 'rgba(255,153,153,0.6)'})})))
// 将feature添加到layer上
layer.getSource().addFeatures(featureList)
// 创建获取面中心点的函数
const getFeaCenter = fea =>
{
  const extent = fea.getGeometry().getExtent()
  return [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2]
}
const onStatMapCreate = map =>
{
  map.addLayer(layer)
  // 遍历feature创建overlay
  featureList.forEach(feature =>
  {
    // 实例化echart图表组件，并获取渲染后的dom元素，从而创建overlay
    const overlay = new Overlay({element: createApp(ComEchart, {feature}).mount(document.createElement('div')).$el, offset: [-40, -50]})
    map.addOverlay(overlay)
    // 将overlay设置在面要素的中心位置
    overlay.setPosition(getFeaCenter(feature))
  })
  map.getView().fit(layer.getSource().getExtent())
  map.getView().setCenter([12758500.812471667, 3562517.6293946854])
  map.getView().setZoom(16.632)
}
</script>

<template>
  <Map @created="onStatMapCreate"></Map>
</template>

<style>
</style>
