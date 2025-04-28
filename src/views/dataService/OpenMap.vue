<script setup>
import { ref } from 'vue'

import VectorLayer from 'ol/layer/Vector.js'
import VectorTileLayer from 'ol/layer/VectorTile.js'
import VectorSource from 'ol/source/Vector.js'
import VectorTileSource from 'ol/source/VectorTile.js'
import GeoJSON from 'ol/format/GeoJSON.js'
import KML from 'ol/format/KML.js'
import GPX from 'ol/format/GPX.js'
import MVT from 'ol/format/MVT.js'
import { Circle as CircleStyle, Fill, Stroke, Style } from 'ol/style.js'

import Map from '../Map.vue'


// 1-创建图层，接入WMS服务
const createLyrGeoJSON = () =>
{
  return new VectorLayer({
    properties: {
      name: 'geojson',
      title: 'GeoJSON数据',
      locate: [12758417.315499168, 3562866.9013162893, 16]
    },
    visible:false,
    source: new VectorSource({
      url: 'data/lines.json',
      format: new GeoJSON({
        dataProjection: 'EPSG:4326',
        featureProjection: 'EPSG:3857'
      })
    }),
    style: new Style({
      stroke: new Stroke({
        color: '#3672af',
        width: 1
      })
    })
  })
}

const createLyrKML = () =>
{
  return new VectorLayer({
    properties: {
      name: 'kml',
      title: 'KML数据',
      locate: [12758417.315499168, 3562866.9013162893, 10]
    },
    visible:false,
    source: new VectorSource({
      url: 'data/lines.kml',
      format: new KML(),
    })
  })
}

const createLyrGPX = () =>
{
  const style = {
    'Point': new Style({
      image: new CircleStyle({
        fill: new Fill({
          color: 'rgba(255,255,0,0.4)',
        }),
        radius: 5,
        stroke: new Stroke({
          color: '#ff0',
          width: 1,
        }),
      }),
    }),
    'LineString': new Style({
      stroke: new Stroke({
        color: '#f00',
        width: 3,
      }),
    }),
    'MultiLineString': new Style({
      stroke: new Stroke({
        color: '#0f0',
        width: 3,
      }),
    }),
  }

  return new VectorLayer({
    properties: {
      name: 'gpx',
      title: 'GPX数据',
      locate: [-7916212.305874971, 5228516.283875127, 14]
    },
    visible:false,
    source: new VectorSource({
      url: 'data/fells_loop.gpx',
      format: new GPX(),
    }),
    style: function(feature)
    {
      return style[feature.getGeometry().getType()]
    }
  })
}

const createLyrVecTile = () =>
{
  return new VectorTileLayer({
    properties: {
      name: 'vectortile',
      title: '矢量瓦片数据',
      locate: [864510.0253082548, 5862753.416073311, 10]
    },
    visible:false,
    source: new VectorTileSource({
      format: new MVT(),
      url: 'https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer/tile/{z}/{y}/{x}.pbf',
    })
  })
}

let olmap = null
let layers = []
const checks = ref([])
const onMapCreate = map =>
{
  olmap = map
  map.addLayer(createLyrGeoJSON())
  map.addLayer(createLyrKML())
  map.addLayer(createLyrGPX())
  map.addLayer(createLyrVecTile())

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

