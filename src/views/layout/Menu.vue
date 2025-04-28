<script setup>
import { ref } from 'vue';
import { useRouter } from 'vue-router';

const router = useRouter();
const activeMenu = ref('OverviewMap');

const onMenuSelect = (menu) => {
  activeMenu.value = menu;
  router.push({ name: menu });
};
</script>

<template>
  <aside class="menu">
    <el-menu :default-active="activeMenu" @select="onMenuSelect">
      <el-menu-item index="StatMap">统计地图</el-menu-item>
      <el-menu-item index="HeatMap">热力图</el-menu-item>
      <el-menu-item index="ColorTileMap">彩色瓦片图</el-menu-item>
      <el-menu-item index="ColorMap">彩色地图</el-menu-item>
      <el-menu-item index="TextLabel">文本标注</el-menu-item>
      <el-menu-item index="PopupLabel">弹窗标注</el-menu-item>
      <el-menu-item index="ClusterLabel">点聚合标注</el-menu-item>
      <el-menu-item index="GraSelect">图形选择</el-menu-item>
      <el-menu-item index="GraRotate">图形旋转</el-menu-item>
      <el-menu-item index="GraMove">图形移动</el-menu-item>
      <el-menu-item index="DrawPolygon">绘制多边形</el-menu-item>
    </el-menu>
  </aside>
</template>

<style scoped>
.menu {
  width: 200px;
  height: 100%;
  background-color: #f5f5f5;
  border-right: 1px solid #dcdcdc;
  pointer-events: auto;
  min-height: 0;
  box-sizing: border-box;
  opacity: 0.85; /* 设置菜单透明度，0为全透明，1为不透明 */
}
</style>