<template>
  <div class="map-controls-container">
    <!-- 地球图标按钮 -->
    <transition name="fade">
      <div 
        v-if="!controlsVisible" 
        class="earth-icon-container"
        @click="showControls"
      >
        <img 
          src="/earth.png" 
          alt="地图控制" 
          class="earth-icon"
          title="点击显示地图控制面板"
        />
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const controlsVisible = ref(false);
const mapControlEmitter = window.__mapControlEmitter__;
const distanceActive = ref(false);

// 显示控制面板
const showControls = () => {
  controlsVisible.value = true;
  if (mapControlEmitter) {
    mapControlEmitter.emit('setControlsVisible', true);
  }
};

// 隐藏控制面板
const hideControls = () => {
  // 如果测距模式激活，不隐藏控件
  if (distanceActive.value) {
    return;
  }
  
  controlsVisible.value = false;
  if (mapControlEmitter) {
    mapControlEmitter.emit('setControlsVisible', false);
  }
};

// 监听地图事件
const setupMapListeners = () => {
  if (!window.map) return;

  // 修改：添加条件检查，避免测距模式下隐藏控件
  const handleMapEvent = () => {
    // 如果正在测距，不隐藏控件
    if (window.__drawdistance_disable_userinfo__ || distanceActive.value) {
      return;
    }
    hideControls();
  };

  // 地图移动或缩放结束时隐藏控件
  window.map.on('moveend', handleMapEvent);
  window.map.on('movestart', handleMapEvent);
};

// 监听事件总线
onMounted(() => {
  if (mapControlEmitter) {
    mapControlEmitter.on('controlsVisibleChanged', (visible) => {
      controlsVisible.value = visible;
    });
  }
  
  // 等待地图初始化完成后设置监听器
  if (window.map) {
    setupMapListeners();
  } else {
    window.addEventListener('map-created', () => {
      setupMapListeners();
    }, { once: true });
  }
  
  // 监听测距模式状态变化
  if (window.__distanceEmitter__) {
    window.__distanceEmitter__.on('distanceControlSwitch', (active) => {
      distanceActive.value = active;
      if (active) {
        // 测距激活时，确保控件可见
        controlsVisible.value = true;
        if (mapControlEmitter) {
          mapControlEmitter.emit('setControlsVisible', true);
        }
      }
    });
  }
});

// 移除事件监听
onBeforeUnmount(() => {
  if (window.map) {
    window.map.un('moveend', hideControls);
    window.map.un('movestart', hideControls);
  }
  
  if (mapControlEmitter) {
    mapControlEmitter.off('controlsVisibleChanged');
  }
  
  if (window.__distanceEmitter__) {
    window.__distanceEmitter__.off('distanceControlSwitch');
  }
});
</script>

<style scoped>
.map-controls-container {
  position: fixed;
  z-index: 3010;
  pointer-events: none;
}

.earth-icon-container {
  position: fixed;
  right: 40px;
  /* 修改位置：放在定位控件下方300像素 */
  top: calc(50% + 250px);
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fffbe6 0%, #f5e1a4 100%);
  border: 2px solid #a67c52;
  box-shadow: 
    0 4px 16px rgba(0,0,0,0.2),
    0 0 0 4px rgba(255,255,255,0.4) inset;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.3s, box-shadow 0.3s;
  z-index: 3010;
}

.earth-icon-container:hover {
  transform: translateY(-5px) rotate(15deg);
  box-shadow: 
    0 8px 24px rgba(166,124,82,0.3),
    0 0 0 4px rgba(255,255,255,0.6) inset;
}

.earth-icon-container:active {
  transform: translateY(0) scale(0.95);
  box-shadow: 
    0 2px 8px rgba(0,0,0,0.15),
    0 0 0 4px rgba(255,255,255,0.4) inset;
}

.earth-icon {
  width: 44px;
  height: 44px;
  object-fit: contain;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

/* 淡入淡出动画 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s, transform 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
