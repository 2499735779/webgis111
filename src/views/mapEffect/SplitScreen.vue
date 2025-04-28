<script setup>
import { Map, View } from 'ol'
import TileLayer from 'ol/layer/Tile'
import XYZ from 'ol/source/XYZ.js'
import { ref, onMounted } from 'vue'

// 设置分屏数量
const splitNum = ref(4)
const refArr = ref([])
const view = new View({projection: 'EPSG:3857', center: [12758500.812471667, 3562517.6293946854], zoom: 16.632})
const mapRef = el => refArr.value.push(el)
const makeMap = (target, index) => new Map({
  target,
  layers: [
    [0, 3].includes(index) ? new TileLayer({
      source: new XYZ({
        projection: 'EPSG:4326',
        url: 'http://t{0-7}.tianditu.gov.cn/img_c/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=c&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=b387b606afd9c346236f767123461927'
      })
    }) : new TileLayer({
      source: new XYZ({
        projection: 'EPSG:4326',
        url: 'http://t{0-7}.tianditu.gov.cn/vec_c/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=c&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=b387b606afd9c346236f767123461927'
      })
    }),
    // new TileLayer({
    //   source: new XYZ({
    //     projection: 'EPSG:4326',
    //     url: 'http://t{0-7}.tianditu.gov.cn/cva_c/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=c&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=b387b606afd9c346236f767123461927'
    //   })
    // })
  ],
  // 共享同一个view
  view: view,
})
onMounted(() => Array.from({length: splitNum.value}).forEach((_, index) => makeMap(refArr.value[index], index)))
</script>

<template>
  <main class="container">
    <section v-for="i in splitNum" :key="i" class="mapContainer" :ref="mapRef"></section>
  </main>
</template>

<style>
  .container {height: 100%; display: flex; flex-wrap: wrap; justify-content:space-around;}
  .mapContainer {min-width: 500px; min-height: 300px; margin: 10px;}
</style>
