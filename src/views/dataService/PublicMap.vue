<script setup>
import { ref, onMounted, computed } from 'vue'
import TileLayer from 'ol/layer/Tile.js'
import XYZ from 'ol/source/XYZ.js'
import OSM from 'ol/source/OSM.js'
import BingMaps from 'ol/source/BingMaps.js'
import TileImage from 'ol/source/TileImage.js'
import TileGrid from 'ol/tilegrid/TileGrid.js'

// 调试瓦片URL函数
const debugTileUrl = (url) => {
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
};

// 创建各个图层方法
const createLyrGd = () => {
  return new TileLayer({
    properties: {
      name: 'gaode',
      title: '高德地图',
    },
    visible: false,
    source: new XYZ({
      url: 'http://webrd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scl=1&style=8&lstyle=7&x={x}&y={y}&z={z}',
    })
  });
};

const createLyrTian = () => {
  const key = '569737ea36171685d686b54ce079a49d';
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
      })
    })
  ];
};

const createLyrBd = () => {
  let url = 'http://online{0-3}.map.bdimg.com/onlinelabel/?qt=tile&x={x}&y={y}&z={z}&styles=pl&udt=20191119&scaler=1&p=1';
  debugTileUrl(url);
  const resolutions = [];
  for (let i = 0; i < 19; i++)
    resolutions.push(Math.pow(2, 18 - i));
  const tileGrid = new TileGrid({
    origin: [0, 0],
    resolutions
  });
  return new TileLayer({
    properties: {
      name: 'baidu',
      title: '百度地图',
    },
    visible: false,
    source: new TileImage({
      projection: 'EPSG:3857',
      tileGrid: tileGrid,
      tileUrlFunction: function(tileCoord, pixelRatio, proj) {
        if (!tileCoord)
          return '';
        let tempUrl = url;
        tempUrl = tempUrl.replace('{x}', tileCoord[1] < 0 ? `M${-tileCoord[1]}` : tileCoord[1]);
        tempUrl = tempUrl.replace('{y}', tileCoord[2] < 0 ? `M${tileCoord[2] + 1}` : -(tileCoord[2] + 1));
        tempUrl = tempUrl.replace('{z}', tileCoord[0]);
        var match = /\{(\d+)-(\d+)\}/.exec(tempUrl);
        if (match) {
          var delta = parseInt(match[2]) - parseInt(match[1]);
          var num = Math.round(Math.random() * delta + parseInt(match[1]));
          tempUrl = tempUrl.replace(match[0], num.toString());
        }
        return tempUrl;
      }
    })
  });
};

const createLyrOSM = () => {
  const url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  debugTileUrl(url);
  return new TileLayer({
    properties: {
      name: 'osm',
      title: 'OpenStreetMap',
    },
    visible: false,
    source: new OSM()
  });
};

const createLyrBing = () => {
  const key = 'AvehefmVM_surC2UyDjyO2T_EvSgRUA9Te3_9D_sj88ZYEBNNWxaufCSPGzecf-B';
  const url = `https://dev.virtualearth.net/REST/v1/Imagery/Map/Road/{z}/{x}/{y}?key=${key}`;
  debugTileUrl(url);
  return new TileLayer({
    properties: {
      name: 'bing',
      title: 'Bing地图',
    },
    visible: false,
    source: new BingMaps({
      key: key,
      imagerySet: 'RoadOnDemand'
    })
  });
};

const createLyrArc = () => {
  const url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  debugTileUrl(url);
  return new TileLayer({
    properties: {
      name: 'arc',
      title: 'Arcgis地图',
    },
    visible: false,
    source: new XYZ({
      url,
      projection: 'EPSG:3857'
    })
  });
};

let olmap = null;
const layers = ref([]); // 改为响应式
const checks = ref(''); // 当前选择图层

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
  if (!existNames.has('baidu')) olmap.addLayer(createLyrBd());
  if (!existNames.has('osm')) olmap.addLayer(createLyrOSM());
  if (!existNames.has('bing')) olmap.addLayer(createLyrBing());
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
      return {
        name: layer.get('name'),
        title: layer.get('title'),
        layer
      };
    });
  layers.value = arr; // 赋值给 ref
  onCheckChange();
};

const onCheckChange = () => {
  if (!olmap) return;
  layers.value.forEach(layer => {
    layer.layer.setVisible(layer.name === checks.value);
    // 天地图底图时，自动显示注记图层
    if (layer.name === 'tian') {
      const labelLayer = olmap.getLayers().getArray().find(l => l.get('isTianLabel'));
      if (labelLayer) labelLayer.setVisible(layer.layer.getVisible());
    } else {
      const labelLayer = olmap.getLayers().getArray().find(l => l.get('isTianLabel'));
      if (labelLayer) labelLayer.setVisible(false);
    }
  });
};

// 计算左右两列的底图选项
const leftLayers = computed(() => layers.value.slice(0, 3))
const rightLayers = computed(() => layers.value.slice(3, 6))

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
});
</script>

<template>
  <div class="control publicmap-draggable">
    <!-- 删除调试信息 -->
    <el-radio-group v-model="checks" @change="onCheckChange" size="large">
      <div class="basemap-columns">
        <div class="basemap-column">
          <el-radio
            v-for="layer in leftLayers"
            :key="layer.name"
            :value="layer.name"
            class="basemap-radio"
          >
            {{ layer.title }}
          </el-radio>
        </div>
        <div class="basemap-column">
          <el-radio
            v-for="layer in rightLayers"
            :key="layer.name"
            :value="layer.name"
            class="basemap-radio"
          >
            {{ layer.title }}
          </el-radio>
        </div>
      </div>
    </el-radio-group>
  </div>
</template>

<style scoped>
.control {
  width: 310px;
  height: 140px;
  background: rgba(255,255,255,0.6); /* 半透明背景 */
  padding: 16px 16px;
  border-radius: 5px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  position: fixed;
  right: 40px; /* 距离页面右侧40像素 */
  left: auto;
  top: 50%;
  transform: translateY(-50%);
  cursor: move;
  z-index: 2002;
  user-select: none;
  pointer-events: auto;
}

.el-radio-group {
  width: 100%;
  height: 100%;
}

.basemap-columns {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: stretch;
  height: 100%;
  width: 100%;
  gap: 0; /* 去除两列间隙 */
}

.basemap-column {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  flex: 1;
  height: 100%;
  gap: 0; /* 去除每列内部间隙 */
}

.basemap-radio {
  margin: 0;
  width: 100%;
  /* 让每个选项高度均分，且左右对齐 */
  display: flex;
  align-items: center;
  padding: 0;
}
</style>
