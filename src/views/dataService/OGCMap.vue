<script setup>
import { ref } from 'vue'

import TileLayer from 'ol/layer/Tile.js'
import VectorLayer from 'ol/layer/Vector.js'
import TileWMS from 'ol/source/TileWMS.js'
import WMTS from 'ol/source/WMTS.js'
import VectorSource from 'ol/source/Vector.js'
import WMTSTileGrid from 'ol/tilegrid/WMTS.js'
import {bbox as bboxStrategy} from 'ol/loadingstrategy.js'
import GeoJSON from 'ol/format/GeoJSON.js'
import { get as getProj } from 'ol/proj'
import { getWidth } from 'ol/extent'

import Map from '../Map.vue'

// 1-创建图层，接入WMS服务
const createLyrWMS = () =>
{
  // 提示跨越时使用代理使用服务代理地址
  const url = '/local/geoserver/nurc/wms'
  // const url = 'http://localhost:8080/geoserver/nurc/wms'
  return new TileLayer({
    properties: {
      name: 'wms',
      title: 'WMS服务',
      locate: [-11853698.36373101, 4522979.57274383, 4],
    },
    visible:false,
    source: new TileWMS({
      url: url,
      params: {'LAYERS': 'nurc:Img_Sample'},
      projection: 'EPSG:4326',
      ratio: 1,
      serverType: 'geoserver'
    }),
  })
}

// 2-创建图层，接入WMTS服务
const createLyrWMTS = () =>
{
  // 1-构造分辨率序列
  const size = getWidth(getProj('EPSG:4326').getExtent()) / 256
  const resolutions = []
  const matrixIds = []
  for (let i = 0; i < 19; i++)
  {
    resolutions.push(size / Math.pow(2, i))
    matrixIds.push(i)
  }

  // 2-创建切片规则对象
  const tileGrid = new WMTSTileGrid({
    origin: [-180, 90],
    resolutions: resolutions,
    matrixIds: matrixIds
  })

  // 3-创建瓦片图层和wmts数据源
  return new TileLayer({
    properties: {
      name: 'wmts',
      title: 'WMTS服务',
    },
    visible:false,
    source: new WMTS({
      url: `http://t{0-7}.tianditu.gov.cn/vec_c/wmts?tk=${cxApp.tianKey}`,
      projection: 'EPSG:4326',
      tileGrid: tileGrid,
      crossOrigin: '*',
      format: 'image/png',
      layer: 'vec',
      matrixSet: 'c',
      style: 'default'
    })
  })
}

// 3-创建图层，接入WMS服务
const createLyrWFS = () =>
{
  const url = '/local/geoserver/sf/ows'
  return new VectorLayer({
    properties: {
      name: 'wfs',
      title: 'WFS服务',
      locate: [-11534858.696299767, 5493787.393992992, 7],
    },
    visible:false,
    source: new VectorSource({
      format: new GeoJSON(),
      url: extent =>
      {
        return (
          url + '?service=WFS&' +
          'version=1.0.0&request=GetFeature&typename=sf:roads&' +
          'outputFormat=application/json&srsname=EPSG:3857&' +
          'bbox=' +
          extent.join(',') +
          ',EPSG:3857'
        )
      },
      strategy: bboxStrategy,
    }),
    style: {
      'stroke-width': 2,
      'stroke-color': 'red',
      'fill-color': 'rgba(100,100,100,0.25)',
    }
  })
}

let olmap = null
let layers = []
const checks = ref([])
const onMapCreate = map =>
{
  olmap = map
  map.addLayer(createLyrWMS())
  map.addLayer(createLyrWMTS())
  map.addLayer(createLyrWFS())

  layers = map.getLayers().getArray().map(layer =>
  {
    layer.getVisible() && checks.value.push(layer.get('name'))
    return {
      name: layer.get('name'),
      title: layer.get('title'),
      locate: layer.get('locate'),
      layer
    }
  })
}

// 图层开关控制
const onCheckChange = () =>
{
  if (!olmap)
    return
  
  let lastLocate = null
  layers.forEach(layer =>
  {
    layer.layer.setVisible(checks.value.includes(layer.name))
    if (layer.name === checks.value[checks.value.length - 1])
      lastLocate = layer.locate
  })

  if (lastLocate)
  {
    olmap.getView().setZoom(lastLocate[2])
    olmap.getView().setCenter([lastLocate[0], lastLocate[1]])
  }
}
</script>

<template>
  <Map @created="onMapCreate"></Map>
  <el-card class="control">
    <el-checkbox-group v-model="checks" @change="onCheckChange">
      <el-checkbox v-for="layer in layers" :key="layer.name" :label="layer.name">{{layer.title}}</el-checkbox>
    </el-checkbox-group>
  </el-card>
</template>

<style>
.control {position: absolute;right:5px;top:10px;width: 400px;}
</style>