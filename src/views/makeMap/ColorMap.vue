<script setup>
import {Fill, Text, Stroke, Style} from 'ol/style'
import VectorSource from 'ol/source/Vector'
import VectorLayer from 'ol/layer/Vector'
import GeoJSONFormat from 'ol/format/GeoJSON'
import Map from '../Map.vue'
import polygonData from '/public/data/polygonData'

const layer = new VectorLayer({source: new VectorSource()})
// 解析geojson数据创建feature集合
const featureList = (new GeoJSONFormat()).readFeatures(polygonData, {dataProjection : 'EPSG:4326', featureProjection : 'EPSG:3857'})
console.log(featureList)
// 创建feature样式
const getStyle = feature =>
{
  // 获取要素中的OBJECTID属性值（实际业务中可以是任意其它属性值）
  const objectid = Number(feature.get('OBJECTID'))
  // 根据OBJECTID值的不同范围，设置不同的颜色
  const color = objectid < 50 ? 'rgba(135,237,145,0.6)' : (objectid < 100 ? 'rgba(102,204,255,0.6)' : (objectid < 200 ? 'rgba(255,228,143,0.6)' : 'rgba(255,153,153,0.6)'))
  return new Style({fill: new Fill({color}), stroke: new Stroke({color: '#ffffff'}), text: new Text({text: String(objectid)})})
}
// 给所有feature设置样式
featureList.forEach(feature => feature.setStyle(getStyle(feature)))
// 将feature添加到layer上
layer.getSource().addFeatures(featureList)
const onColorMapCreate = map =>
{
  map.addLayer(layer)
  map.getView().fit(layer.getSource().getExtent())
}
</script>

<template>
  <Map @created="onColorMapCreate"></Map>
</template>

<style>
</style>
