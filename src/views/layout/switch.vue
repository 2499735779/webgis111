<script setup>
import { ref, onMounted } from 'vue';
import ScaleLine from 'ol/control/ScaleLine.js';
import OverviewMap from 'ol/control/OverviewMap.js';
import MousePosition from 'ol/control/MousePosition.js';

const scaleControl = ref(true);
const overviewControl = ref(true);
const mousePositionControl = ref(true);

const updateControls = () => {
  const map = window.map;
  if (!map) return;

  map.getControls().clear();

  if (scaleControl.value) map.addControl(new ScaleLine());
  if (overviewControl.value) {
    const baseLayer = map.getLayers().item(0);
    map.addControl(
      new OverviewMap({
        collapsed: false,
        layers: [baseLayer],
      })
    );
  }
  if (mousePositionControl.value) {
    map.addControl(new MousePosition({ className: 'mousPos' }));
  }
};

onMounted(() => {
  updateControls();
});
</script>

<template>
  <div class="control-panel">
    <div class="switches">
      <el-switch v-model="scaleControl" @change="updateControls" /> 比例尺
      <el-switch v-model="overviewControl" @change="updateControls" class="ml-2" /> 鹰眼
      <el-switch v-model="mousePositionControl" @change="updateControls" class="ml-2" /> 鼠标位置
    </div>
  </div>
</template>

<style scoped>
.switches {
  margin-bottom: 0;
  display: flex;
  flex-direction: row;
  gap: 18px;
  align-items: center;
  font-size: 15px;
}
.ml-2 {
  margin-left: 18px;
}
.mousPos {
  position: absolute;
  top: 8px;
  right: 8px;
  color: red;
}
</style>
