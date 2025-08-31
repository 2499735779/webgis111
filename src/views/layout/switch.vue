<script setup>
import { ref, onMounted, watch } from 'vue'
import ScaleLine from 'ol/control/ScaleLine.js'
import OverviewMap from 'ol/control/OverviewMap.js'
import mitt from 'mitt'

const scaleControl = ref(true)
const overviewControl = ref(true)
const mousePositionControl = ref(true)
// 测距控制开关
const distanceControl = ref(false)

// 创建全局事件总线，用于测距功能
if (!window.__distanceEmitter__) {
  window.__distanceEmitter__ = mitt();
  console.log('[Switch] 创建了全局事件总线');
}

// 监听 mousePositionControl 变化，通知 MousePosition.vue 控制显示/隐藏
if (!window.__mousePositionEmitter__) {
  window.__mousePositionEmitter__ = mitt();
}

if (!window.__scaleLineEmitter__) {
  window.__scaleLineEmitter__ = mitt();
}

if (!window.__overviewMapEmitter__) {
  window.__overviewMapEmitter__ = mitt();
}

watch(mousePositionControl, (val) => {
  window.__mousePositionEmitter__.emit('mousePositionSwitch', val)
})
watch(scaleControl, (val) => {
  window.__scaleLineEmitter__.emit('scaleLineSwitch', val)
})
watch(overviewControl, (val) => {
  window.__overviewMapEmitter__.emit('overviewMapSwitch', val)
})

// 监听测距控制开关
watch(distanceControl, (val) => {
  console.log('[Switch] 测距开关状态变更:', val);
  window.__distanceEmitter__.emit('distanceControlSwitch', val);
  
  // 如果有map对象，确保测距工具激活时添加特殊CSS类
  if (window.map && window.map.getTargetElement()) {
    if (val) {
      window.map.getTargetElement().classList.add('measure-active');
      document.body.classList.add('measure-mode');
    } else {
      window.map.getTargetElement().classList.remove('measure-active');
      document.body.classList.remove('measure-mode');
    }
  }
})

// 监听测距完成事件，自动关闭测距开关
if (window.__distanceEmitter__) {
  window.__distanceEmitter__.on('distanceCompleted', () => {
    distanceControl.value = false;
    
    // 确保移除测距CSS类
    if (window.map && window.map.getTargetElement()) {
      window.map.getTargetElement().classList.remove('measure-active');
      document.body.classList.remove('measure-mode');
    }
  });
}

onMounted(() => {
  // 确保在组件挂载后添加一个全局样式，强制设置测距模式的鼠标样式
  const style = document.createElement('style');
  style.textContent = `
    .measure-active, .measure-active * {
      cursor: crosshair !important;
    }
    
    body.measure-mode .ol-viewport, 
    body.measure-mode .ol-viewport * {
      cursor: crosshair !important;
    }
  `;
  document.head.appendChild(style);
})
</script>

<template>
  <div class="control-panel cuphead-control-panel">
    <div class="cuphead-title-bar">
      <span class="cuphead-control-title">地图控件</span>
    </div>
    <div class="switches cuphead-switches">
      <div class="switch-item">
        <el-switch
          v-model="scaleControl"
          class="cuphead-switch"
          :active-color="'#a67c52'"
          :inactive-color="'#e7cfa2'"
        />
        <span class="switch-label">比例尺</span>
      </div>
      
      <div class="switch-item">
        <el-switch
          v-model="overviewControl"
          class="cuphead-switch"
          :active-color="'#a67c52'"
          :inactive-color="'#e7cfa2'"
        />
        <span class="switch-label">鹰眼</span>
      </div>
      
      <div class="switch-item">
        <el-switch
          v-model="mousePositionControl"
          class="cuphead-switch"
          :active-color="'#a67c52'"
          :inactive-color="'#e7cfa2'"
        />
        <span class="switch-label">鼠标位置</span>
      </div>

      <!-- 测距开关 -->
      <div class="switch-item">
        <el-switch
          v-model="distanceControl"
          class="cuphead-switch distance-switch"
          :active-color="'#a67c52'"
          :inactive-color="'#e7cfa2'"
        />
        <span class="switch-label">测距工具</span>
      </div>
    </div>
  </div>
</template>

<style>
/* 移除 scoped 属性，使样式全局生效 */
@font-face {
  font-family: 'JiangxiZhuokai';
  src: url('/fonts/jiangxi-zhoukai/jiangxizhuokai-Regular.woff2') format('woff2'),
       url('/fonts/jiangxi-zhoukai/jiangxizhuokai-Regular.woff') format('woff');
  font-display: swap;
}

.cuphead-control-panel {
  background: rgba(255,255,255,0.6) !important; 
  border-radius: 20px !important;
  box-shadow: 
    0 4px 16px rgba(0,0,0,0.15),
    0 0 0 2px #a67c52,
    0 0 0 4px rgba(255,255,255,0.5) inset !important;
  position: fixed;
  right: 40px;
  bottom: 100px;
  z-index: 3002;
  pointer-events: auto;
  font-family: 'JiangxiZhuokai', cursive, sans-serif !important;
  overflow: hidden;
  padding: 0;
  width: 200px;
}

/* 顶部标题栏 */
.cuphead-title-bar {
  width: 100%;
  height: 36px;
  background: linear-gradient(90deg, #fffbe6 0%, #f5e1a4 100%) !important;
  border-bottom: 2px solid #a67c52;
  border-radius: 20px 20px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  box-shadow: 0 2px 4px rgba(166,124,82,0.1);
}

.cuphead-control-title {
  font-family: 'JiangxiZhuokai', cursive, sans-serif !important;
  font-size: 20px;
  font-weight: bold;
  color: #7c4a1e;
  text-align: center;
  text-shadow: 1px 1px 0 #fffbe6;
  letter-spacing: 2px;
}

.cuphead-switches {
  padding: 12px 16px 10px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: linear-gradient(135deg, #fffbe6 0%, #f5e1a4 100%) !important;
  border-radius: 0 0 20px 20px;
}

.switch-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  box-shadow: 0 2px 5px rgba(166, 124, 82, 0.1);
  transition: background 0.2s;
}

.switch-item:hover {
  background: rgba(255, 255, 255, 0.5);
}

.switch-label {
  font-family: 'JiangxiZhuokai', cursive, sans-serif !important;
  font-size: 16px;
  font-weight: bold;
  color: #7c4a1e;
  text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.7);
  margin-left: 10px;
  flex: 1;
}

/* Element Plus 开关样式 */
.cuphead-switch .el-switch__core {
  border-color: #a67c52 !important;
  background-color: #e7cfa2 !important;
}

.cuphead-switch.is-checked .el-switch__core {
  border-color: #7c4a1e !important;
  background-color: #a67c52 !important;
}

.cuphead-switch .el-switch__core .el-switch__action {
  background: #fff !important;
}

.cuphead-switch.is-checked .el-switch__core .el-switch__action {
  background: #fffbe6 !important;
}

.el-switch {
  --el-switch-on-color: #a67c52 !important;
  --el-switch-off-color: #e7cfa2 !important;
}

/* 测距开关特殊样式 */
.distance-switch {
  position: relative;
}
</style>


