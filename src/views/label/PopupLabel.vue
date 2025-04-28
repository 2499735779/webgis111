<script setup>

import Map from '../Map.vue'
import GeoJSON from 'ol/format/GeoJSON.js'
import VectorLayer from 'ol/layer/Vector.js'
import VectorSource from 'ol/source/Vector.js'
import {Fill, Stroke, Circle, Text, Style} from 'ol/style.js'
import Overlay from 'ol/Overlay.js'
import { ref } from 'vue'

const overlayDlg = ref(null)
const popupCloser = ref(null)
const popupContent = ref(null)

const style = new Style({
  fill: new Fill({color: 'rgba(168, 172, 38, 0.6)'}),
  stroke: new Stroke({color: '#319FD3', width: 1}),
  image: new Circle({radius: 5, fill: new Fill({color: 'red'}), stroke: new Stroke({color: 'yellow'})})
})
let popup = null
const onPopupLabelCreate = map =>
{
  popup = new Overlay({
    element: overlayDlg.value,                             // 将自己写的 html 内容添加到覆盖层，html 内容略
    positioning: 'bottom-center',                          // 覆盖层位置
    autoPan: true,                                         // 是否自动平移，当点击时对话框超出屏幕边距，会自动平移地图使其可见
    autoPanMargin: 20,                                     // 设置自动平移边距
    offset: [0, -20]                                       // 覆盖层偏移起点的位置
  })

  const vectorLayer = new VectorLayer({
    source: new VectorSource({
      url: 'data/地名.json',
      format: new GeoJSON(),
    }),
    style
  })
  // 将图层添加到地图上
  map.addLayer(vectorLayer)
  map.on('singleclick', (evt) =>
  {
    // 获取点击的标注
    let feature = map.forEachFeatureAtPixel(evt.pixel, (feature) =>
    {
      return feature
    })
    if (!feature && !feature.getProperties().mc)
      return
    popupContent.value.innerHTML = feature.getProperties().mc
    popup.setPosition(feature.getGeometry().getCoordinates())

    // 添加popup到地图上
    map.addOverlay(popup)
  })
}

const onClose = () =>
{
  popup.setPosition(undefined)
  popupCloser.value.blur()
  return false
}
</script>

<template>
  <Map @created="onPopupLabelCreate"></Map>
  <div ref="overlayDlg" class="popup">
    <a href="#" ref="popupCloser" class="popup-closer" @click="onClose()"></a>
    <div ref="popupContent"></div>
  </div>
</template>

<style>
  .popup {
    background-color: white;
    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
    padding: 15px;
    border-radius: 10px;
    border: 1px solid #cccccc;
    min-width: 280px;
    color: black;
  }
  .popup-closer {
    text-decoration: none;
    position: absolute;
    top: 2px;
    right: 8px;
  }
  .popup-closer:after {
    content: "✖";
  }
</style>
