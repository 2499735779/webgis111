<template>
  <div 
    class="control publicmap-draggable"
    :style="{
      opacity: controlsVisible ? 1 : 0,
      transform: controlsVisible ? 'translateY(0)' : 'translateY(20px)',
      transition: 'opacity 0.3s, transform 0.3s',
      pointerEvents: controlsVisible ? 'auto' : 'none'
    }"
  >
    <div class="cuphead-title-bar">
      <span class="cuphead-control-title">选择地图</span>
    </div>
    <el-radio-group v-model="checks" @change="onCheckChange" size="large" class="custom-radio-group">
      <div class="basemap-columns">
        <div class="basemap-column">
          <!-- 左侧底图按钮 -->
          <el-radio 
            v-for="item in leftLayers" 
            :key="item.name" 
            :label="item.name" 
            class="basemap-radio cuphead-radio"
          >
            {{ item.title }}
          </el-radio>
        </div>
        <div class="basemap-column">
          <!-- 右侧底图按钮 -->
          <el-radio 
            v-for="item in rightLayers" 
            :key="item.name" 
            :label="item.name" 
            class="basemap-radio cuphead-radio"
          >
            {{ item.title }}
          </el-radio>
        </div>
      </div>
    </el-radio-group>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, onBeforeUnmount } from 'vue'
import TileLayer from 'ol/layer/Tile.js'
import XYZ from 'ol/source/XYZ.js'
import OSM from 'ol/source/OSM.js'
import { fromLonLat, toLonLat } from 'ol/proj' // 添加导入 fromLonLat 和 toLonLat

// 调试瓦片URL函数
const debugTileUrl = (url) => {
  try {
    const testUrl = url
      .replace('{x}', 5372)
      .replace('{y}', 2460)
      .replace('{z}', 13)
      .replace('{s}', '')
      .replace('{0-7}', '0')
      .replace('{1-4}', '1')
      .replace('{0-3}', '0')
    const img = new window.Image();
    img.onload = () => {
      console.log('[DEBUG] 瓦片加载成功:', testUrl);
    };
    img.onerror = () => {
      console.error('[DEBUG] 瓦片加载失败:', testUrl);
    };
    img.src = testUrl;
  } catch(e) {
    // 忽略URL测试错误
  }
};

// 创建各个图层方法
const createLyrTian = () => {
  const key = '569737ea36171685d686b54ce079a49d';
  // 天地图最大支持18级，手动指定maxZoom
  const maxZoom = 18;
  // 矢量底图
  const vecUrl = `http://t{0-7}.tianditu.gov.cn/vec_c/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=c&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${key}`;
  // 文字注记图层
  const cvaUrl = `http://t{0-7}.tianditu.gov.cn/cva_c/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=cva&STYLE=default&TILEMATRIXSET=c&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${key}`;
  debugTileUrl(vecUrl);
  debugTileUrl(cvaUrl);

  // 返回一个包含底图和注记的图层组
  return [
    new TileLayer({
      properties: {
        name: 'tian',
        title: '天地图',
        isTianBase: true
      },
      visible: false,
      source: new XYZ({
        projection: 'EPSG:4326',
        url: vecUrl,
        maxZoom // 指定最大缩放级别
      })
    }),
    new TileLayer({
      properties: {
        name: 'tian-label',
        title: '天地图文字注记',
        isTianLabel: true
      },
      visible: false,
      source: new XYZ({
        projection: 'EPSG:4326',
        url: cvaUrl,
        maxZoom
      })
    })
  ];
};

// 高德地图坐标转换参数优化
// 中国正常范围的经纬度范围
const CHINA_BOUND = {
  min_lng: 72.004, max_lng: 137.8347,
  min_lat: 0.8293, max_lat: 55.8271
};

// 判断坐标是否在中国境外 - 更精确的实现
function outOfChina(lng, lat) {
  if (lng < CHINA_BOUND.min_lng || lng > CHINA_BOUND.max_lng || 
      lat < CHINA_BOUND.min_lat || lat > CHINA_BOUND.max_lat) {
    return true;
  }
  return false;
}

// 修正：重新实现更准确的WGS84转GCJ02算法
function transformWGS84ToGCJ02(lng, lat) {
  if (outOfChina(lng, lat)) {
    return { lng, lat };
  }
  
  const PI = Math.PI;
  const a = 6378245.0; // 长半轴
  const ee = 0.00669342162296594323; // 扁率
  
  let dLat = transformLatitude(lng - 105.0, lat - 35.0);
  let dLng = transformLongitude(lng - 105.0, lat - 35.0);
  
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - ee * magic * magic;
  
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((a * (1 - ee)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (a / sqrtMagic * Math.cos(radLat) * PI);
  
  return {
    lng: lng + dLng,
    lat: lat + dLat
  };
}

// 修正：更准确的经度偏移计算
function transformLongitude(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
  return ret;
}

// 修正：更准确的纬度偏移计算
function transformLatitude(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320.0 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

// 修正：使用迭代法更精确地实现GCJ02转WGS84
function transformGCJ02ToWGS84(lng, lat) {
  if (outOfChina(lng, lat)) {
    return { lng, lat };
  }
  
  let dLng = lng, dLat = lat;
  let mLng = lng - 0, mLat = lat - 0;
  let precision = 1e-8;
  let diff = 1;
  
  // 循环收敛，提高精度
  for (let i = 0; i < 30 && diff > precision; i++) {
    const result = transformWGS84ToGCJ02(dLng, dLat);
    dLng = mLng * 2 - result.lng;
    dLat = mLat * 2 - result.lat;
    const newResult = transformWGS84ToGCJ02(dLng, dLat);
    dLng += mLng - newResult.lng;
    dLat += mLat - newResult.lat;
    diff = Math.max(Math.abs(mLng - newResult.lng), Math.abs(mLat - newResult.lat));
  }
  
  return {
    lng: dLng,
    lat: dLat
  };
}

// 修改高德地图源，添加更准确的坐标系转换
const createLyrGd = () => {
  // 高德最大支持18级
  return new TileLayer({
    properties: {
      name: 'gaode',
      title: '高德地图',
    },
    visible: false,
    source: new XYZ({
      url: 'http://webrd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scl=1&style=8&lstyle=7&x={x}&y={y}&z={z}',
      maxZoom: 18,
      // 高德地图使用GCJ02坐标系，需要转换
      tileUrlFunction: function(tileCoord) {
        if (!tileCoord) return '';
        
        // 获取原始瓦片坐标
        const z = tileCoord[0];
        const x = tileCoord[1];
        const y = tileCoord[2];
        
        if (z < 0) return '';
        
        // 构建URL模板
        const url = 'http://webrd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scl=1&style=8&lstyle=7&x={x}&y={y}&z={z}';
        
        // 随机服务器编号
        const randomServer = Math.floor(Math.random() * 4) + 1;
        
        // 替换URL中的变量
        return url
          .replace('{1-4}', randomServer)
          .replace('{x}', x)
          .replace('{y}', y)
          .replace('{z}', z);
      }
    })
  });
};

const createLyrOSM = () => {
  // OSM最大支持19级
  return new TileLayer({
    properties: {
      name: 'osm', // 添加缺失的name属性
      title: 'OpenStreetMap',
    },
    visible: false,
    source: new OSM({
      maxZoom: 19
    })
  });
};

const createLyrArc = () => {
  // ArcGIS最大支持19级
  return new TileLayer({
    properties: {
      name: 'arc', // 添加缺失的name属性
      title: 'Arcgis地图',
    },
    visible: false,
    source: new XYZ({
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      projection: 'EPSG:3857',
      maxZoom: 19
    })
  });
};

let olmap = null;
const layers = ref([]); // 改为响应式
const checks = ref(''); // 当前选择图层

// 控件显示状态
const controlsVisible = ref(true);
const mapControlEmitter = window.__mapControlEmitter__;

onMounted(() => {
  // 初始化地图图层
  if (window.map) {
    initLayers();
  } else {
    const handler = map => {
      initLayers();
      window.removeEventListener('map-created', handler);
    };
    window.addEventListener('map-created', handler);
  }
  
  window.addEventListener('refresh-basemap', e => {
    if (!layers.value.length) return;
    const key = e.detail || 'gaode';
    if (layers.value.some(l => l.name === key)) {
      checks.value = key;
      onCheckChange();
    }
  });
  
  // 预先设置控件为 fixed 定位，避免第一次点击时转换定位带来的问题
  const el = document.querySelector('.publicmap-draggable');
  if (!el) return;
  const rect = el.getBoundingClientRect();
  el.style.left = rect.left + 'px';
  el.style.top = rect.top + 'px';
  el.style.right = 'auto';
  el.style.bottom = 'auto';
  el.style.transform = '';
  el.style.position = 'fixed';
  
  // 拖动逻辑
  let isDragging = false;
  let startX = 0, startY = 0;
  let origX = 0, origY = 0;
  
  const onMouseMove = e => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.left = (origX + dx) + 'px';
    el.style.top = (origY + dy) + 'px';
  };

  const onMouseUp = () => {
    isDragging = false;
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  el.onmousedown = e => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    origX = parseFloat(el.style.left);
    origY = parseFloat(el.style.top);
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };
  
  // 监听地图点击事件，进行坐标转换
  if (window.map) {
    window.map.on('click', function(evt) {
      // 获取点击位置的坐标
      const coordinate = evt.coordinate;
      // 将坐标转换为经纬度
      const lonlat = toLonLat(coordinate, window.map.getView().getProjection());
      
      // 根据当前选择的地图类型，对坐标进行转换
      if (checks.value === 'gaode') {
        // 高德地图点击位置需要转换为天地图坐标系
        const corrected = transformGCJ02ToWGS84(lonlat[0], lonlat[1]);
        // 转回Mercator投影坐标
        const correctedCoord = fromLonLat([corrected.lng, corrected.lat], window.map.getView().getProjection());
        // 存储修正后的坐标
        window.correctedCoordinate = correctedCoord;
      } else {
        // 天地图等其他地图不需要转换
        window.correctedCoordinate = coordinate;
      }
    });
  }
  
  // 监听控件显示状态变化
  if (mapControlEmitter) {
    mapControlEmitter.on('setControlsVisible', (visible) => {
      controlsVisible.value = visible;
    });
  }
  
  // 默认隐藏控件
  controlsVisible.value = false;
});

onBeforeUnmount(() => {
  if (mapControlEmitter) {
    mapControlEmitter.off('setControlsVisible');
  }
});

// 初始化图层时，删除百度和Bing图层
const initLayers = () => {
  olmap = window.map;
  if (!olmap) return;

  // 只添加一次各个图层，避免重复添加
  const existNames = new Set(olmap.getLayers().getArray().map(l => l.get('name')));
  if (!existNames.has('gaode')) olmap.addLayer(createLyrGd());
  // 天地图底图和注记分开添加
  if (!existNames.has('tian')) {
    const tianLayers = createLyrTian();
    tianLayers.forEach(layer => olmap.addLayer(layer));
  }
  if (!existNames.has('osm')) olmap.addLayer(createLyrOSM());
  if (!existNames.has('arc')) olmap.addLayer(createLyrArc());

  // 筛选唯一的图层（只显示底图，不显示注记）
  const arr = olmap.getLayers().getArray()
    .filter((layer, idx, arr) =>
      layer.get('title') &&
      !layer.get('isTianLabel') && // 不把注记图层作为单独可选项
      arr.findIndex(l => l.get('name') === layer.get('name')) === idx
    )
    .map(layer => {
      if (!checks.value && layer.getVisible()) checks.value = layer.get('name');
      const name = layer.get('name');
      const title = layer.get('title');
      return {
        name,
        title,
        layer
      };
    });
  layers.value = arr; // 赋值给 ref
  
  // 确保默认选中一个有效图层
  if (!checks.value || !layers.value.some(l => l.name === checks.value)) {
    checks.value = 'gaode';
  }
  
  onCheckChange();
};

// 修改 onCheckChange 函数，删除百度和Bing地图相关代码
const onCheckChange = () => {
  if (!olmap) return;
  
  // 获取当前视图中心点和缩放级别
  const currentCenter = olmap.getView().getCenter();
  const currentZoom = olmap.getView().getZoom();
  const currentMapType = checks.value; // 保存当前地图类型
  
  // 设置图层可见性
  layers.value.forEach(layer => {
    layer.layer.setVisible(layer.name === checks.value);
    
    // 天地图底图时，自动显示注记图层
    if (layer.name === 'tian') {
      const labelLayer = olmap.getLayers().getArray().find(l => l.get('isTianLabel'));
      if (labelLayer) {
        labelLayer.setVisible(layer.layer.getVisible());
      }
    }
  });
  
  // 如果当前不是天地图，确保天地图注记隐藏
  if (checks.value !== 'tian') {
    const labelLayer = olmap.getLayers().getArray().find(l => l.get('isTianLabel'));
    if (labelLayer) {
      labelLayer.setVisible(false);
    }
  }
  
  // 当前中心点的WGS84经纬度
  if (currentCenter && currentMapType && currentMapType !== checks.value) {
    try {
      // 使用导入的 toLonLat 函数进行坐标转换
      const lonlat = toLonLat(currentCenter, olmap.getView().getProjection());
      
      // 根据切换前后的地图类型，计算坐标偏移调整
      // 从高德地图切换到其他地图
      if (currentMapType === 'gaode' && checks.value !== 'gaode') {
        // 从GCJ02转WGS84
        const wgs84 = transformGCJ02ToWGS84(lonlat[0], lonlat[1]);
        const newCenter = fromLonLat([wgs84.lng, wgs84.lat], olmap.getView().getProjection());
        
        olmap.getView().setCenter(newCenter);
      }
      // 从其他地图切换到高德地图
      else if (currentMapType !== 'gaode' && checks.value === 'gaode') {
        // 从WGS84转GCJ02
        const gcj02 = transformWGS84ToGCJ02(lonlat[0], lonlat[1]);
        const newCenter = fromLonLat([gcj02.lng, gcj02.lat], olmap.getView().getProjection());
        
        olmap.getView().setCenter(newCenter);
      }
    } catch (e) {
      console.error('坐标转换出错:', e);
    }
  }
};

// 计算左右两列的底图选项
const leftLayers = computed(() => layers.value.slice(0, Math.ceil(layers.value.length / 2)));
const rightLayers = computed(() => layers.value.slice(Math.ceil(layers.value.length / 2)));

onMounted(() => {
  // 初始化地图图层
  if (window.map) {
    initLayers();
  } else {
    const handler = map => {
      initLayers();
      window.removeEventListener('map-created', handler);
    };
    window.addEventListener('map-created', handler);
  }
  
  window.addEventListener('refresh-basemap', e => {
    if (!layers.value.length) return;
    const key = e.detail || 'gaode';
    if (layers.value.some(l => l.name === key)) {
      checks.value = key;
      onCheckChange();
    }
  });
  
  // 预先设置控件为 fixed 定位，避免第一次点击时转换定位带来的问题
  const el = document.querySelector('.publicmap-draggable');
  if (!el) return;
  const rect = el.getBoundingClientRect();
  el.style.left = rect.left + 'px';
  el.style.top = rect.top + 'px';
  el.style.right = 'auto';
  el.style.bottom = 'auto';
  el.style.transform = '';
  el.style.position = 'fixed';
  
  // 拖动逻辑
  let isDragging = false;
  let startX = 0, startY = 0;
  let origX = 0, origY = 0;
  
  const onMouseMove = e => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    el.style.left = (origX + dx) + 'px';
    el.style.top = (origY + dy) + 'px';
  };

  const onMouseUp = () => {
    isDragging = false;
    document.body.style.userSelect = '';
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  };

  el.onmousedown = e => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    origX = parseFloat(el.style.left);
    origY = parseFloat(el.style.top);
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };
  
  // 监听地图点击事件，进行坐标转换
  if (window.map) {
    window.map.on('click', function(evt) {
      // 获取点击位置的坐标
      const coordinate = evt.coordinate;
      // 将坐标转换为经纬度
      const lonlat = toLonLat(coordinate, window.map.getView().getProjection());
      
      // 根据当前选择的地图类型，对坐标进行转换
      if (checks.value === 'gaode') {
        // 高德地图点击位置需要转换为天地图坐标系
        const corrected = transformGCJ02ToWGS84(lonlat[0], lonlat[1]);
        // 转回Mercator投影坐标
        const correctedCoord = fromLonLat([corrected.lng, corrected.lat], window.map.getView().getProjection());
        // 存储修正后的坐标
        window.correctedCoordinate = correctedCoord;
      } else {
        // 天地图等其他地图不需要转换
        window.correctedCoordinate = coordinate;
      }
    });
  }
  
  // 监听控件显示状态变化
  if (mapControlEmitter) {
    mapControlEmitter.on('setControlsVisible', (visible) => {
      controlsVisible.value = visible;
    });
  }
  
  // 默认隐藏控件
  controlsVisible.value = false;
});
</script>

<style scoped>
.control {
  width: 310px;
  height: 160px; /* 稍微增加高度 */
  background: rgba(255,255,255,0.6); /* 保持半透明背景 */
  padding: 0; /* 移除内边距，统一由内部元素控制 */
  border-radius: 20px; /* 更圆润的边角 */
  box-shadow: 
    0 4px 16px rgba(0,0,0,0.15),
    0 0 0 2px #a67c52, /* 棕色边框 */
    0 0 0 4px rgba(255,255,255,0.5) inset; /* 内发光效果 */
  position: fixed;
  right: 40px; /* 距离页面右侧40像素 */
  left: auto;
  top: 50%;
  transform: translateY(-50%);
  cursor: move;
  z-index: 2002;
  user-select: none;
  pointer-events: auto;
  font-family: 'JiangxiZhuokai', cursive, sans-serif; /* 使用茶杯头风格字体 */
  overflow: hidden; /* 确保内容不超出圆角 */
}

/* 顶部标题栏 */
.cuphead-title-bar {
  width: 100%;
  height: 40px;
  background: linear-gradient(90deg, #fffbe6 0%, #f5e1a4 100%);
  border-bottom: 2px solid #a67c52;
  border-radius: 20px 20px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  box-shadow: 0 2px 4px rgba(166,124,82,0.1);
}

.cuphead-control-title {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 22px;
  font-weight: bold;
  color: #7c4a1e;
  text-align: center;
  text-shadow: 1px 1px 0 #fffbe6;
  letter-spacing: 2px;
}

/* 修改单选按钮样式 */
.custom-radio-group {
  padding: 10px 16px;
  height: calc(100% - 40px);
  width: 100%;
}

.basemap-columns {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: stretch;
  height: 100%;
  width: 100%;
  gap: 8px; /* 两列之间添加间隙 */
}

.basemap-column {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  height: 100%;
  gap: 8px; /* 行间距 */
}

/* 茶杯头风格单选按钮 */
.cuphead-radio {
  margin: 0;
  width: 100%;
  background: linear-gradient(90deg, #fffbe6 0%, #f5e1a4 100%);
  border: 2px solid #a67c52;
  border-radius: 12px;
  padding: 4px 8px !important;
  color: #7c4a1e;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.2s;
  height: 38px; /* 固定高度 */
  box-shadow: 0 2px 0 #a67c52;
  text-shadow: 1px 1px 0 #fffbe6;
}

.cuphead-radio:hover {
  background: linear-gradient(90deg, #f5e1a4 0%, #ffe066 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 0 #a67c52;
}

/* 选中状态 */
.cuphead-radio :deep(.el-radio__input.is-checked .el-radio__inner) {
  background-color: #a67c52;
  border-color: #a67c52;
}

.cuphead-radio :deep(.el-radio__input.is-checked + .el-radio__label) {
  color: #7c4a1e;
  font-weight: bold;
}

/* 单选按钮内部样式 */
.cuphead-radio :deep(.el-radio__inner) {
  border-color: #a67c52;
  background-color: #fffbe6;
  width: 16px;
  height: 16px;
}

.cuphead-radio :deep(.el-radio__inner::after) {
  width: 8px;
  height: 8px;
  background-color: #fffbe6;
}

/* 单选按钮文字样式 */
.cuphead-radio :deep(.el-radio__label) {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 16px;
  font-weight: bold;
  color: #7c4a1e;
  padding-left: 8px;
}

/* 确保选中状态有明显的视觉差异 */
.el-radio-group .el-radio.is-checked .cuphead-radio {
  background: linear-gradient(90deg, #ffeba0 0%, #f5b507 100%);
  transform: translateY(-1px);
  box-shadow: 0 3px 0 #7c4a1e;
}

/* 添加字体声明 */
@font-face {
  font-family: 'JiangxiZhuokai';
  src: url('/fonts/jiangxi-zhoukai/jiangxizhuokai-Regular.woff2') format('woff2'),
       url('/fonts/jiangxi-zhoukai/jiangxizhuokai-Regular.woff') format('woff');
  font-display: swap;
}
</style>




<style scoped>
.control {
  width: 310px;
  height: 160px; /* 稍微增加高度 */
  background: rgba(255,255,255,0.6); /* 保持半透明背景 */
  padding: 0; /* 移除内边距，统一由内部元素控制 */
  border-radius: 20px; /* 更圆润的边角 */
  box-shadow: 
    0 4px 16px rgba(0,0,0,0.15),
    0 0 0 2px #a67c52, /* 棕色边框 */
    0 0 0 4px rgba(255,255,255,0.5) inset; /* 内发光效果 */
  position: fixed;
  right: 40px; /* 距离页面右侧40像素 */
  left: auto;
  top: 50%;
  transform: translateY(-50%);
  cursor: move;
  z-index: 2002;
  user-select: none;
  pointer-events: auto;
  font-family: 'JiangxiZhuokai', cursive, sans-serif; /* 使用茶杯头风格字体 */
  overflow: hidden; /* 确保内容不超出圆角 */
}

/* 顶部标题栏 */
.cuphead-title-bar {
  width: 100%;
  height: 40px;
  background: linear-gradient(90deg, #fffbe6 0%, #f5e1a4 100%);
  border-bottom: 2px solid #a67c52;
  border-radius: 20px 20px 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px;
  box-shadow: 0 2px 4px rgba(166,124,82,0.1);
}

.cuphead-control-title {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 22px;
  font-weight: bold;
  color: #7c4a1e;
  text-align: center;
  text-shadow: 1px 1px 0 #fffbe6;
  letter-spacing: 2px;
}

/* 修改单选按钮样式 */
.custom-radio-group {
  padding: 10px 16px;
  height: calc(100% - 40px);
  width: 100%;
}

.basemap-columns {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: stretch;
  height: 100%;
  width: 100%;
  gap: 8px; /* 两列之间添加间隙 */
}

.basemap-column {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
  flex: 1;
  height: 100%;
  gap: 8px; /* 行间距 */
}

/* 茶杯头风格单选按钮 */
.cuphead-radio {
  margin: 0;
  width: 100%;
  background: linear-gradient(90deg, #fffbe6 0%, #f5e1a4 100%);
  border: 2px solid #a67c52;
  border-radius: 12px;
  padding: 4px 8px !important;
  color: #7c4a1e;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 16px;
  font-weight: bold;
  transition: all 0.2s;
  height: 38px; /* 固定高度 */
  box-shadow: 0 2px 0 #a67c52;
  text-shadow: 1px 1px 0 #fffbe6;
}

.cuphead-radio:hover {
  background: linear-gradient(90deg, #f5e1a4 0%, #ffe066 100%);
  transform: translateY(-2px);
  box-shadow: 0 4px 0 #a67c52;
}

/* 选中状态 */
.cuphead-radio :deep(.el-radio__input.is-checked .el-radio__inner) {
  background-color: #a67c52;
  border-color: #a67c52;
}

.cuphead-radio :deep(.el-radio__input.is-checked + .el-radio__label) {
  color: #7c4a1e;
  font-weight: bold;
}

/* 单选按钮内部样式 */
.cuphead-radio :deep(.el-radio__inner) {
  border-color: #a67c52;
  background-color: #fffbe6;
  width: 16px;
  height: 16px;
}

.cuphead-radio :deep(.el-radio__inner::after) {
  width: 8px;
  height: 8px;
  background-color: #fffbe6;
}

/* 单选按钮文字样式 */
.cuphead-radio :deep(.el-radio__label) {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 16px;
  font-weight: bold;
  color: #7c4a1e;
  padding-left: 8px;
}

/* 确保选中状态有明显的视觉差异 */
.el-radio-group .el-radio.is-checked .cuphead-radio {
  background: linear-gradient(90deg, #ffeba0 0%, #f5b507 100%);
  transform: translateY(-1px);
  box-shadow: 0 3px 0 #7c4a1e;
}

/* 添加字体声明 */
@font-face {
  font-family: 'JiangxiZhuokai';
  src: url('/fonts/jiangxi-zhoukai/jiangxizhuokai-Regular.woff2') format('woff2'),
       url('/fonts/jiangxi-zhoukai/jiangxizhuokai-Regular.woff') format('woff');
  font-display: swap;
}
</style>

