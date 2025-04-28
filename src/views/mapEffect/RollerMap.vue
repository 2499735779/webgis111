<script setup>
import XYZ from 'ol/source/XYZ'
import TileLayer from 'ol/layer/Tile'
import { getRenderPixel } from 'ol/render'
import { ref } from 'vue'
import Map from '../Map.vue'

let selMap = null
const swipe = ref()
// 创建顶层图层
const layer = new TileLayer({
  source: new XYZ({
    projection: 'EPSG:4326',
    url: 'http://t{0-7}.tianditu.gov.cn/img_c/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=img&STYLE=default&TILEMATRIXSET=c&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=b387b606afd9c346236f767123461927',
  })
})

// 注册地图渲染时的触发事件
layer.on('prerender', e =>
{
  const ctx = e.context
  // 根据分隔条的进度值和地图的尺寸，获取待分割宽度
  const mapSize = selMap.getSize()
  const width = mapSize[0] * (Number(swipe.value.value) / 100)
  const tl = getRenderPixel(e, [width, 0])
  const tr = getRenderPixel(e, [mapSize[0], 0])
  const bl = getRenderPixel(e, [width, mapSize[1]])
  const br = getRenderPixel(e, mapSize)
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(tl[0], tl[1])
  ctx.lineTo(bl[0], bl[1])
  ctx.lineTo(br[0], br[1])
  ctx.lineTo(tr[0], tr[1])
  ctx.closePath()
  ctx.clip()
})
// 注册地图渲染完成后的触发事件
layer.on('postrender', e => e.context.restore())
const onRollerMapCreate = map =>
{
  selMap = map
  map.addLayer(layer)
  map.getView().setCenter([12758500.812471667, 3562517.6293946854])
  map.getView().setZoom(16.632)
}
const handleInput = () => selMap.render()
</script>

<template>
  <Map @created="onRollerMapCreate"></Map>
  <input type="range" ref="swipe" class="swipe" @input="handleInput" />
</template>

<style>
  .swipe {position: absolute;top: 10px;width: 96%;margin: 0 2%;}
</style>
