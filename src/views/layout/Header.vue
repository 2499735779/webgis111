<script setup>
import logo from '@/assets/favicon.ico'

const title = '点击跳转到氪小化的github查看项目源码'
const buttons = [
  { text: '跳转', url: 'https://github.com/2499735779/webgis111' }
]

const onClick = button =>
{
  window.open(button.url)
}
</script>

<template>
  <header class="header">
    <div class="header-center">
      <img class="logo" :src="logo" alt="暂无图片"/>
      <span class="header-title">{{title}}</span>
      <el-button
        v-for="button in buttons"
        :key="button.text"
        type="primary"
        text
        class="header-btn"
        @click="onClick(button)"
      >{{ button.text }}</el-button>
    </div>
  </header>
</template>

<style lang="scss" scoped>
.header {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  height: 36px;
  min-height: 36px;
  max-height: 36px;
  background: #333333;
  padding: 0 16px;
  pointer-events: auto;
  width: 100vw;
  box-sizing: border-box;
}
.header-center {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: 16px;
}
.logo {
  height: 22px;
  margin-right: 5px;
}
.header-title {
  color: #fff;
  font-size: 16px;
  margin: 0 10px;
  white-space: nowrap;
}
.header-btn {
  margin-left: 10px;
}
.el-button.is-text:not(.is-disabled):focus, .el-button.is-text:not(.is-disabled):hover {
  background-color: #4e4e4e;
}
</style>