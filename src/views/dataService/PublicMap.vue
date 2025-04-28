<script setup>
import { ref, onMounted } from 'vue'
import TileLayer from 'ol/layer/Tile.js'
import XYZ from 'ol/source/XYZ.js'
import OSM from 'ol/source/OSM.js'
import BingMaps from 'ol/source/BingMaps.js'
import TileImage from 'ol/source/TileImage.js'
import TileGrid from 'ol/tilegrid/TileGrid.js'

const debugTileUrl = (url) => {
  // 取一个实际的瓦片URL进行测试
  const testUrl = url
    .replace('{x}', 5372)
    .replace('{y}', 2460)
    .replace('{z}', 13)
    .replace('{s}', '')
    .replace('{0-7}', '0')
    .replace('{1-4}', '1')
    .replace('{0-3}', '0');
  // 尝试加载图片
  const img = new window.Image();
  img.onload = () => {
    console.log('[DEBUG] 瓦片加载成功:', testUrl);
  };
  img.onerror = () => {
    console.error('[DEBUG] 瓦片加载失败:', testUrl);
  };
  img.src = testUrl;
};

// 3-创建高德地图
const createLyrGd = () =>
{
  return new TileLayer({
    properties: {
      name: 'gaode',
      title: '高德地图',
    },
    visible:false,
    source: new XYZ({
      url: 'http://webrd0{1-4}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scl=1&style=8&lstyle=7&x={x}&y={y}&z={z}',
    })
  })
}


// 2-创建天地图
const createLyrTian = () => {
  const key = '569737ea36171685d686b54ce079a49d'
  const url = `http://t{0-7}.tianditu.gov.cn/vec_c/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=vec&STYLE=default&TILEMATRIXSET=c&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${key}`;
  debugTileUrl(url);
  return new TileLayer({
    properties: {
      name: 'tian',
      title: '天地图',
    },
    visible: false,
    source: new XYZ({
      projection: 'EPSG:4326',
      url,
    })
  })
}

// 3-创建百度地图
const createLyrBd = () => {
  let url = 'http://online{0-3}.map.bdimg.com/onlinelabel/?qt=tile&x={x}&y={y}&z={z}&styles=pl&udt=20191119&scaler=1&p=1'
  debugTileUrl(url);
  const resolutions = []
  for (let i = 0; i < 19; i++)
    resolutions.push(Math.pow(2, 18 - i))
  const tileGrid = new TileGrid({
    origin: [0, 0],
    resolutions
  })
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
          return ''
        let tempUrl = url
        tempUrl = tempUrl.replace('{x}', tileCoord[1] < 0 ? `M${-tileCoord[1]}` : tileCoord[1])
        tempUrl = tempUrl.replace('{y}', tileCoord[2] < 0 ? `M${tileCoord[2] + 1}` : -(tileCoord[2] + 1))
        tempUrl = tempUrl.replace('{z}', tileCoord[0])
        var match = /\{(\d+)-(\d+)\}/.exec(tempUrl)
        if (match) {
          var delta = parseInt(match[2]) - parseInt(match[1])
          var num = Math.round(Math.random() * delta + parseInt(match[1]))
          tempUrl = tempUrl.replace(match[0], num.toString())
        }
        return tempUrl
      }
    })
  })
}

// 4-创建OpenStreetMap地图
const createLyrOSM = () => {
  const url = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  debugTileUrl(url);
  return new TileLayer({
    properties: {
      name: 'osm',
      title: 'OpenStreetMap地图',
    },
    visible: false,
    source: new OSM()
  })
}

// 5-创建Bing地图
const createLyrBing = () => {
  const key = 'AvehefmVM_surC2UyDjyO2T_EvSgRUA9Te3_9D_sj88ZYEBNNWxaufCSPGzecf-B'
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
  })
}

// 6-创建Arcgis地图
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
  })
}

let olmap = null
let layers = []
const checks = ref('') // 单选，初始为空字符串

const initLayers = () => {
  olmap = window.map
  if (!olmap) return

  // 只添加一次高德地图，顺序：高德、天地图、百度、OSM、Bing、Arcgis
  // 检查是否已存在同名图层，避免重复
  const existNames = new Set(olmap.getLayers().getArray().map(l => l.get('name')))
  if (!existNames.has('gaode')) olmap.addLayer(createLyrGd())
  if (!existNames.has('tian')) olmap.addLayer(createLyrTian())
  if (!existNames.has('baidu')) olmap.addLayer(createLyrBd())
  if (!existNames.has('osm')) olmap.addLayer(createLyrOSM())
  if (!existNames.has('bing')) olmap.addLayer(createLyrBing())
  if (!existNames.has('arc')) olmap.addLayer(createLyrArc())

  // 只保留唯一图层
  layers = olmap.getLayers().getArray()
    .filter((layer, idx, arr) =>
      layer.get('title') &&
      arr.findIndex(l => l.get('name') === layer.get('name')) === idx
    )
    .map(layer => {
      if (!checks.value && layer.getVisible()) checks.value = layer.get('name')
      return {
        name: layer.get('name'),
        title: layer.get('title'),
        layer
      }
    })
  // 不自动设置 checks.value，等待外部事件驱动
  onCheckChange()
}

// 监听外部事件，初始化时自动切换到底图
onMounted(() => {
  if (window.map) {
    initLayers()
  } else {
    const handler = map => {
      initLayers()
      window.removeEventListener('map-created', handler)
    }
    window.addEventListener('map-created', handler)
  }

  // 监听 map.vue 的底图初始化事件
  window.addEventListener('refresh-basemap', e => {
    if (!layers.length) return;
    const key = e.detail || 'gaode';
    if (layers.some(l => l.name === key)) {
      checks.value = key;
      onCheckChange();
    }
  });

  // 拖动逻辑（独立实现，修复闪烁）
  const el = document.querySelector('.publicmap-draggable')
  if (!el) return
  let isDragging = false
  let startX = 0
  let startY = 0
  let origX = 0
  let origY = 0

  // 记录初始位置，只在第一次拖动时设置
  let hasMoved = false

  const onMouseMove = e => {
    if (!isDragging) return
    const dx = e.clientX - startX
    const dy = e.clientY - startY
    el.style.left = origX + dx + 'px'
    el.style.top = origY + dy + 'px'
  }
  const onMouseUp = () => {
    isDragging = false
    document.body.style.userSelect = ''
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }

  el.onmousedown = e => {
    isDragging = true
    startX = e.clientX
    startY = e.clientY

    if (!hasMoved) {
      const rect = el.getBoundingClientRect()
      el.style.left = rect.left + 'px'
      el.style.top = rect.top + 'px'
      el.style.right = 'auto'
      el.style.bottom = 'auto'
      el.style.transform = ''
      el.style.position = 'fixed'
      hasMoved = true
    }

    origX = parseInt(el.style.left)
    origY = parseInt(el.style.top)
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }
})

const onCheckChange = () => {
  if (!olmap) return
  layers.forEach(layer => {
    layer.layer.setVisible(layer.name === checks.value)
  })
}
</script>

<template>
  <div class="control publicmap-draggable">
    <el-radio-group v-model="checks" @change="onCheckChange" size="large">
      <el-radio v-for="layer in layers" :key="layer.name" :value="layer.name">
        {{ layer.title }}
      </el-radio>
    </el-radio-group>
  </div>
</template>

<style scoped>
.control {
  width: 350px;
  height: 180px;
  background: white;
  padding: 20px 16px;
  border-radius: 5px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2);
  position: fixed;
  right: 40px;
  top: 50%;
  left: auto;
  transform: translateY(-50%);
  cursor: move;
  z-index: 2002;
  user-select: none;
  pointer-events: auto;
}
</style>
