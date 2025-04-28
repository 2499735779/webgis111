<script setup>
import { ref } from 'vue'
import Map from '../Map.vue'

const checks = ref([])
let olmap = null
let layers = []
const createLayerManage = map =>
{
  olmap = map
  layers = map.getLayers().getArray().map(layer =>
  {
    checks.value.push(layer.get('name'))
    return {
      name: layer.get('name'),
      title: layer.get('title'),
      layer
    }
  })
}

// 图层开关控制
const onCheckChange = () =>
{
  if (!olmap)
    return
  
  layers.forEach(layer =>
  {
    layer.layer.setVisible(checks.value.includes(layer.name))
  })
}
</script>

<template>
  <Map :def-lyrs="['img_c','vec_c']" @created="createLayerManage"></Map>
  <el-card class="control">
    <el-checkbox-group v-model="checks" @change="onCheckChange">
      <el-checkbox v-for="layer in layers" :key="layer.name" :label="layer.name">{{layer.title}}</el-checkbox>
    </el-checkbox-group>
  </el-card>
</template>

<style>
.control {position: absolute;right:5px;top:10px;width: 400px;}
</style>
