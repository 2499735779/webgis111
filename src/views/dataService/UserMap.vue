<script setup>
import { ref } from 'vue'
import axios from 'axios'
import Map from '../Map.vue'
import { fromLonLat } from 'ol/proj'

const userId = ref('user_' + Math.floor(Math.random() * 1000000))
const lng = ref('')
const lat = ref('')
const locating = ref(false)
const errorMsg = ref('')
let olmap = null

// 获取当前位置并移动地图中心
const locateAndCenter = () => {
  locating.value = true
  errorMsg.value = ''
  if (!navigator.geolocation) {
    errorMsg.value = '当前浏览器不支持地理位置获取'
    locating.value = false
    return
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      lng.value = pos.coords.longitude
      lat.value = pos.coords.latitude
      locating.value = false
      if (olmap) {
        // 使用 fromLonLat 进行坐标转换
        const proj = olmap.getView().getProjection();
        const coord = proj.getCode() === 'EPSG:3857'
          ? fromLonLat([lng.value, lat.value], proj)
          : [lng.value, lat.value];
        olmap.getView().setCenter(coord)
        olmap.getView().setZoom(17)
      }
    },
    err => {
      errorMsg.value = '定位失败: ' + err.message
      locating.value = false
    }
  )
}

// 上传当前位置
const uploadLocation = async () => {
  if (!lng.value || !lat.value) {
    errorMsg.value = '请先定位'
    return
  }
  await axios.post('/api/user-location', {
    userId: userId.value,
    lng: Number(lng.value),
    lat: Number(lat.value)
  })
  errorMsg.value = '上传成功'
  setTimeout(() => { errorMsg.value = '' }, 1500)
}

// 地图创建回调
const onMapCreated = map => {
  olmap = map
}
</script>

<template>
  <Map @created="onMapCreated"></Map>
</template>
<style scoped>
</style>
