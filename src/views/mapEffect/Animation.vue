<script setup>
import Map from '../Map.vue'
import MoveLine from '../logic/olAnimation/MoveLine'
// 引入动画特效配置数据
import animationData from '/public/data/animationData.js'

// 地图创建完以后，示例化动画工具类，并传入动画特效配置数据
const onAnimationMapCreate = map => new MoveLine({map, data: animationData})
</script>

<template>
  <Map defLyrs="['vec_c', 'cia_c']" @created="onAnimationMapCreate"></Map>
</template>

<style>
</style>
