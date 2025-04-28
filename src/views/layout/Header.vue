<script setup>
import logo from '@/assets/favicon.ico'

const title = '点击跳转到氪小化的github查看项目源码'
const buttons = [
  { text: '跳转', url: 'https://openlayers.org/en/latest/apidoc/' }
]

const onClick = button =>
{
  window.open(button.url)
}
</script>

<template>
  <header class="header">
    <div class="title">
      <img class="logo" :src="logo" alt="暂无图片"/>
      <span>{{title}}</span>
    </div>
    <div class="title">
      <el-button v-for="button in buttons"
        :key="button.text"
        type="primary"
        text
        @click="onClick(button)"
      >{{ button.text }}
      </el-button>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  height: 36px; /* 缩小高度 */
  min-height: 36px;
  max-height: 36px;
  background: #333333;
  padding: 0 16px;
  pointer-events: auto;
  width: 100vw;
  box-sizing: border-box;
}
.logo {height: 22px; margin-right: 5px;}
.title {
  display: flex;
  flex-direction: row;
  align-items: center;
  height: 100%;
  font-size: 16px; /* 缩小字号 */
  flex: 1 1 0;
  min-width: 0;
}
.el-button.is-text:not(.is-disabled):focus, .el-button.is-text:not(.is-disabled):hover {
  background-color: #4e4e4e;
}
</style>