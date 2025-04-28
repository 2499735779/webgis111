<script setup>
import Image from 'ol/layer/Image'
import XYZ from 'ol/source/XYZ'
import RasterSource from 'ol/source/Raster'
import Map from '../Map.vue'

// 创建普通瓦片图层source
const source = new XYZ({
  projection: 'EPSG:3857',
  crossOrigin: '',    // 必需，否则会因跨域导致渲染失败
  url: 'http://mapcdn.lshida.com/maps/vt?lyrs=m@292000000&hl=zh-CN&gl=cn&src=app&x={x}&y={y}&z={z}&s='
})
// 使用Raster包装瓦片图层source
const makeSource = (source, type) =>
{
  let reverseFunc = null
  const makePixels = (pixelsTemp, callback) =>
  {
    for (let i = 0; i < pixelsTemp.length; i += 4)
    {
      const r = pixelsTemp[i]
      const g = pixelsTemp[i + 1]
      const b = pixelsTemp[i + 2]
      // 运用图像学公式，设置灰度值
      const grey = r * 0.3 + g * 0.59 + b * 0.11
      // 将rgb的值替换为灰度值
      pixelsTemp[i] = grey
      pixelsTemp[i + 1] = grey
      pixelsTemp[i + 2] = grey
      if (callback)
        callback(pixelsTemp, i)
    }
  }
  // 灰色
  if (type === 'gray')
    reverseFunc = pixelsTemp => makePixels(pixelsTemp)
  // 蓝色
  else if (type === 'blue')
  {
    reverseFunc = pixelsTemp => makePixels(pixelsTemp, (pixelsTemp, i) =>
    {
      pixelsTemp[i] = 55 - pixelsTemp[i]
      pixelsTemp[i + 1] = 255 - pixelsTemp[i + 1]
      pixelsTemp[i + 2] = 305 - pixelsTemp[i + 2]
    })
  }
  // 黑色
  else if (type === 'black')
  {
    reverseFunc = pixelsTemp => makePixels(pixelsTemp, (pixelsTemp, i) =>
    {
      pixelsTemp[i] = 255 - pixelsTemp[i]
      pixelsTemp[i + 1] = 255 - pixelsTemp[i + 1]
      pixelsTemp[i + 2] = 255 - pixelsTemp[i + 2]
    })
  }
  if (!reverseFunc)
    return source
  return new RasterSource({
    sources: [source],
    operationType: 'image',
    operation: function(pixels)
    {
      reverseFunc(pixels[0].data)
      return pixels[0]
    },
    threads: 10,
    // 函数库注册
    lib: {reverseFunc, makePixels}
  })
}
const layer = new Image({source: makeSource(source, 'blue')})
const onColorTileMapCreate = map =>
{
  map.addLayer(layer)
  map.getView().setCenter([12758500.812471667, 3562517.6293946854])
  map.getView().setZoom(16.632)
}
</script>

<template>
  <Map defLyrs="[]" @created="onColorTileMapCreate"></Map>
</template>

<style>
</style>
