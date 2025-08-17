<script setup>
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import XYZ from 'ol/source/XYZ.js';
import { onMounted, ref, reactive, watch, onBeforeUnmount } from 'vue';
import axios from 'axios';
import { fromLonLat, toLonLat } from 'ol/proj';
import Overlay from 'ol/Overlay.js';
import MousePosition from './control/MousePosition.vue';
// 新增
import ScaleLine from './control/ScaleLine.vue';
import OverviewMap from './control/OverviewMap.vue';

// 获取当前登录用户信息
const user = ref(JSON.parse(localStorage.getItem('user') || '{}'));

const lng = ref('');
const lat = ref('');
const locating = ref(false);
const errorMsg = ref('');
let olmap = null;

let userPositionOverlay = null; // 实时位置覆盖物
let watchId = null;             // 定时器ID

const showNearby = ref(false);
const nearbyUsers = ref([]);
const overlays = reactive([]);
const showUserDialog = ref(false);
const selectedUser = ref(null);
const isSelf = ref(false);
const isFriend = ref(false);
const friends = ref([]);
const pendingFriendRequests = ref([]);
const mousePositionReady = ref(false);

// 新增：控制地图用户弹窗显示时右下角控件隐藏
const setGlobalDialogVisible = window.setGlobalDialogVisible || (()=>{});
watch(showUserDialog, v => setGlobalDialogVisible(v));

// 获取好友列表
const fetchFriends = async () => {
  if (!user.value.username) return;
  const res = await axios.get('/api/user-friends', {
    params: { username: user.value.username }
  });
  friends.value = res.data || [];
};

// 获取待处理好友请求列表
const fetchPendingFriendRequests = async () => {
  if (!user.value.username) return;
  const res = await axios.get('/api/pending-friend-requests', {
    params: { username: user.value.username }
  });
  pendingFriendRequests.value = res.data || [];
};

// 移除addFriend本地实现，直接调用FriendMenu暴露的方法
const addFriend = async (friendName) => {
  if (!user.value.username || !friendName) return;
  // 推荐：通过window.friendMenuRef调用
  if (window.friendMenuRef?.value?.sendFriendRequest) {
    await window.friendMenuRef.value.sendFriendRequest(friendName);
  } else {
    console.error('window.friendMenuRef is undefined. Ensure Home.vue is mounted to initialize it.');
  }
  window.ElMessage && window.ElMessage.success('好友请求已发送');
  await fetchPendingFriendRequests();
};

// 判断是否是自己或好友
const handleUserMarkerClick = async (u, e) => {
  // 新增：测距时禁止弹窗
  if (window.__drawdistance_disable_userinfo__) {
    console.log('[Map.vue] 测距激活，禁止弹窗，点击用户：', u.username, e);
    if (e) e.stopPropagation();
    return;
  }
  console.log('[Map.vue] 正常弹窗，点击用户：', u.username, e);
  selectedUser.value = u;
  showUserDialog.value = true;
  isSelf.value = u.username === user.value.username;
  await fetchFriends();
  await fetchPendingFriendRequests();
  isFriend.value = friends.value.includes(u.username);
};

// 每分钟刷新一次用户位置，仅前端展示，不上传后端
const startWatchUserPosition = () => {
  if (!navigator.geolocation) {
    errorMsg.value = '当前浏览器不支持地理位置获取';
    return;
  }
  // 清理旧的定时器
  if (watchId !== null) {
    clearInterval(watchId);
    watchId = null;
  }
  // 定义刷新函数
  const refreshPosition = () => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        // 只用于前端显示
        const lngVal = pos.coords.longitude;
        const latVal = pos.coords.latitude;
        if (olmap) {
          const coord = fromLonLat([lngVal, latVal], olmap.getView().getProjection());
          if (!userPositionOverlay) {
            const el = document.createElement('div');
            el.className = 'user-location-marker';
            // 关键：允许鼠标事件穿透到 overlay
            el.style.pointerEvents = 'auto';
            // 新增 title 属性和鼠标悬停提示
            el.innerHTML = `<span 
              style="display:inline-block;width:18px;height:18px;background:#67c23a;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.18);cursor:pointer;"
              title="这是您的当前位置"
            ></span>`;
            // 鼠标悬停自定义提示
            el.onmouseenter = (e) => {
              if (el._tipDiv) return;
              const tipDiv = document.createElement('div');
              tipDiv.className = 'user-location-tip';
              tipDiv.innerText = '这是您的当前位置';
              tipDiv.style.position = 'fixed';
              tipDiv.style.left = (e.clientX + 16) + 'px';
              tipDiv.style.top = (e.clientY + 16) + 'px';
              tipDiv.style.background = '#67c23a';
              tipDiv.style.color = '#fff';
              tipDiv.style.padding = '4px 12px';
              tipDiv.style.borderRadius = '6px';
              tipDiv.style.fontSize = '15px';
              tipDiv.style.zIndex = 30001;
              tipDiv.style.pointerEvents = 'none';
              tipDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
              document.body.appendChild(tipDiv);
              el._tipDiv = tipDiv;
              el.onmousemove = (ev) => {
                if (el._tipDiv) {
                  el._tipDiv.style.left = (ev.clientX + 16) + 'px';
                  el._tipDiv.style.top = (ev.clientY + 16) + 'px';
                }
              };
            };
            el.onmouseleave = () => {
              if (el._tipDiv) {
                document.body.removeChild(el._tipDiv);
                el._tipDiv = null;
              }
              el.onmousemove = null;
            };
            userPositionOverlay = new Overlay({
              element: el,
              positioning: 'center-center',
              stopEvent: false // 允许事件穿透
            });
            olmap.addOverlay(userPositionOverlay);
          } else {
            // 修正：如果 overlay 已存在但被 remove 过，需要重新 add
            if (!olmap.getOverlays().getArray().includes(userPositionOverlay)) {
              olmap.addOverlay(userPositionOverlay);
            }
            // 保证 pointerEvents 始终为 auto
            userPositionOverlay.getElement().style.pointerEvents = 'auto';
          }
          userPositionOverlay.setPosition(coord);
          // 修正：强制刷新地图，避免 overlay 不显示
          if (olmap.renderSync) olmap.renderSync();
          if (olmap.updateSize) olmap.updateSize();
        }
      },
      err => {
        // 删除后续刷新时的定位失败提示
        // errorMsg.value = '定位失败: ' + err.message;
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  };
  // 立即刷新一次
  refreshPosition();
  // 每60秒刷新一次
  watchId = setInterval(refreshPosition, 60000);
};

// 页面卸载时清理定时器和覆盖物
onBeforeUnmount(() => {
  if (watchId !== null) {
    clearInterval(watchId);
    watchId = null;
  }
  if (olmap && userPositionOverlay) {
    olmap.removeOverlay(userPositionOverlay);
    userPositionOverlay = null;
  }
});

// 用户点击按钮后定位并上传当前位置（只上传一次，不实时上传）
const getCurrentLocation = () => {
  locating.value = true;
  errorMsg.value = '';
  if (!navigator.geolocation) {
    errorMsg.value = '当前浏览器不支持地理位置获取';
    locating.value = false;
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async pos => {
      lng.value = pos.coords.longitude;
      lat.value = pos.coords.latitude;
      locating.value = false;
      if (olmap) {
        const proj = olmap.getView().getProjection();
        const coord = proj.getCode() === 'EPSG:3857'
          ? fromLonLat([lng.value, lat.value], proj)
          : [lng.value, lat.value];
        olmap.getView().setCenter(coord);
        olmap.getView().setZoom(17);
      }
      // 定位后自动上传坐标
      if (lng.value && lat.value) {
        await axios.post('/api/user-location', {
          username: user.value.username,
          avatar: user.value.avatar,
          lng: Number(lng.value),
          lat: Number(lat.value)
        });
        errorMsg.value = '上传成功';
        setTimeout(() => { errorMsg.value = ''; }, 1500);
      }
    },
    err => {
      errorMsg.value = '定位失败: ' + err.message;
      locating.value = false;
    }
  );
};

// 上传位置只在用户点击按钮时才上传
const uploadLocation = async () => {
  if (!lng.value || !lat.value) {
    errorMsg.value = '请先定位';
    return;
  }
  await axios.post('/api/user-location', {
    username: user.value.username,
    avatar: user.value.avatar,
    lng: Number(lng.value),
    lat: Number(lat.value)
  });
  errorMsg.value = '上传成功';
  setTimeout(() => { errorMsg.value = ''; }, 1500);
};

const props = defineProps({
  viewConf: { type: Object, default: () => ({}) },
  // 不初始化任何底图，由 PublicMap 控制
  defLyrs: { type: Array, default: () => [] }
});

const emit = defineEmits(['created']);

const clearNearbyOverlays = () => {
  overlays.forEach(ov => {
    if (olmap) olmap.removeOverlay(ov);
  });
  overlays.length = 0;
};

const defaultAvatar = '/blank-avatar.png'; // 确保 public 目录下有此文件

const renderedUsers = ref([]); // 当前已渲染的用户
let pendingUsers = [];         // 待渲染的用户
let renderTimer = null;

const renderUserMarkers = (users) => {
  if (!olmap) return;
  // 只操作你自己用 JS 创建的 marker，不要删除 Vue 组件渲染的 DOM
  const mapContainer = document.getElementById('mapDom');
  if (mapContainer) {
    // 只删除你自己 appendChild 的 .user-marker-direct
    const existingMarkers = mapContainer.querySelectorAll('.user-marker-direct');
    existingMarkers.forEach(marker => {
      // 检查 marker 是否还在 DOM 中再删除
      if (marker.parentNode) marker.parentNode.removeChild(marker);
    });
  }
  
  // 强制清理所有 overlays
  const allOverlays = olmap.getOverlays().getArray();
  allOverlays.forEach(ov => {
    if (ov.getElement() && ov.getElement().classList.contains('user-marker')) {
      olmap.removeOverlay(ov);
    }
  });
  overlays.forEach(ov => {
    if (olmap) olmap.removeOverlay(ov);
  });
  overlays.length = 0;

  users.forEach(u => {
    if (u.lng == null || u.lat == null) return;
    const lng = Number(u.lng);
    const lat = Number(u.lat);
    if (isNaN(lng) || isNaN(lat)) {
      return;
    }
    
    // 直接在地图容器中创建绝对定位的元素
    const el = document.createElement('div');
    el.className = 'user-marker-direct';
    el.style.cssText = `
      position: absolute;
      z-index: 99999 !important;
      pointer-events: auto;
      visibility: visible !important;
      display: block !important;
      width: 48px;
      height: 48px;
      margin-left: -24px;
      margin-top: -24px;
    `;
    
    // 计算屏幕像素坐标
    const proj = olmap.getView().getProjection();
    const coord = proj.getCode() === 'EPSG:3857'
      ? fromLonLat([lng, lat], proj)
      : [lng, lat];
    
    // 将地图坐标转换为像素坐标
    const pixel = olmap.getPixelFromCoordinate(coord);
    if (pixel) {
      el.style.left = pixel[0] + 'px';
      el.style.top = pixel[1] + 'px';
    }

    const avatarUrl = u.avatar || defaultAvatar;
    el.innerHTML = `<img src="${avatarUrl}" style="width:48px;height:48px;border-radius:50%;border:2px solid #409eff;box-shadow:0 2px 8px rgba(0,0,0,0.15);cursor:pointer;" title="${u.username}"/>`;
    
    const img = el.querySelector('img');
    img.onerror = function() {
      if (!this._tried) {
        this._tried = 1;
        this.src = defaultAvatar;
      }
    };
    
    let tipDiv = null;
    img.onmouseenter = (e) => {
      img.style.boxShadow = '0 0 16px 6px #409eff, 0 2px 8px rgba(0,0,0,0.18)';
      img.style.borderColor = '#67c23a';
      img.style.zIndex = 30000;
      img.style.cursor = 'pointer';
      tipDiv = document.createElement('div');
      tipDiv.className = 'user-marker-tip';
      tipDiv.innerText = u.username;
      tipDiv.style.position = 'fixed';
      tipDiv.style.left = (e.clientX + 16) + 'px';
      tipDiv.style.top = (e.clientY + 16) + 'px';
      tipDiv.style.background = '#409eff';
      tipDiv.style.color = '#fff';
      tipDiv.style.padding = '4px 12px';
      tipDiv.style.borderRadius = '6px';
      tipDiv.style.fontSize = '15px';
      tipDiv.style.zIndex = 30001;
      tipDiv.style.pointerEvents = 'none';
      tipDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
      document.body.appendChild(tipDiv);
      img.onmousemove = (ev) => {
        if (tipDiv) {
          tipDiv.style.left = (ev.clientX + 16) + 'px';
          tipDiv.style.top = (ev.clientY + 16) + 'px';
        }
      };
    };
    
    img.onmouseleave = () => {
      img.style.boxShadow = '';
      img.style.borderColor = '#409eff';
      img.style.zIndex = '';
      img.style.cursor = '';
      if (tipDiv) {
        document.body.removeChild(tipDiv);
        tipDiv = null;
      }
      img.onmousemove = null;
    };
    
    el.onclick = (e) => {
      if (window.__drawdistance_disable_userinfo__) {
        e && e.stopPropagation();
        e && e.preventDefault();
        return false;
      }
      handleUserMarkerClick(u, e);
    };
    
    img.onclick = (e) => {
      if (window.__drawdistance_disable_userinfo__) {
        e && e.stopPropagation();
        e && e.preventDefault();
        return false;
      }
      handleUserMarkerClick(u, e);
    };
    
    // 将元素直接添加到地图容器
    if (mapContainer) {
      mapContainer.appendChild(el);
    }
    
    // 存储用户数据到元素上，便于后续更新位置
    el._userData = { lng, lat, coord };
  });
  
  // 监听地图移动事件，实时更新标记位置
  const updateMarkerPositions = () => {
    const markers = mapContainer?.querySelectorAll('.user-marker-direct');
    markers?.forEach(marker => {
      if (marker._userData) {
        const pixel = olmap.getPixelFromCoordinate(marker._userData.coord);
        if (pixel) {
          marker.style.left = pixel[0] + 'px';
          marker.style.top = pixel[1] + 'px';
        }
      }
    });
  };
  
  // 移除旧的监听器
  if (olmap._userMarkerMoveListener) {
    olmap.un('moveend', olmap._userMarkerMoveListener);
    olmap.un('postrender', olmap._userMarkerMoveListener);
  }
  
  // 添加新的监听器
  olmap._userMarkerMoveListener = updateMarkerPositions;
  olmap.on('moveend', updateMarkerPositions);
  olmap.on('postrender', updateMarkerPositions);
};

// 搜索附近用户（3km内，带头像）
const searchNearby = async () => {
  if (!olmap) {
    return;
  }
  clearNearbyOverlays();
  errorMsg.value = '正在搜索附近用户...';
  if (olmap.updateSize) {
    olmap.updateSize();
  }
  if (olmap.renderSync) {
    olmap.renderSync();
  }
  await new Promise(resolve => setTimeout(resolve, 100));
  const center = olmap.getView().getCenter();
  if (!center) {
    errorMsg.value = '地图尚未初始化，请稍后重试';
    return;
  }
  const [centerLng, centerLat] = toLonLat(center, 'EPSG:3857');
  try {
    const res = await axios.get('/api/nearby-users', {
      params: { lng: centerLng, lat: centerLat, radius: 3000 }
    });
    nearbyUsers.value = res.data || [];
    errorMsg.value = '';
    if (nearbyUsers.value.length > 0) {
      const first = nearbyUsers.value[0];
      const coord = fromLonLat([Number(first.lng), Number(first.lat)], olmap.getView().getProjection());
      olmap.getView().setCenter(coord);
      olmap.getView().setZoom(18);
      if (olmap.updateSize) {
        olmap.updateSize();
      }
      if (olmap.renderSync) {
        olmap.renderSync();
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    renderUserMarkers(nearbyUsers.value);
  } catch (err) {
    errorMsg.value = '搜索附近用户失败';
  }
};

onMounted(() => {
  console.log('组件挂载，开始初始化地图...');

  if (window.map) {
    olmap = window.map;
    // 关键：移除所有已存在的控件，避免重复
    const controlsToRemove = [];
    olmap.getControls().forEach(ctrl => {
      const name = ctrl.constructor && ctrl.constructor.name;
      if (
        name === 'MousePosition' ||
        name === 'ScaleLine' ||
        name === 'OverviewMap'
      ) {
        controlsToRemove.push(ctrl);
      }
    });
    controlsToRemove.forEach(ctrl => olmap.removeControl(ctrl));
    emit('created', window.map);
    // 这里通过事件通知 PublicMap 组件加载天地图底图
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('refresh-basemap', { detail: 'tian' }));
    }, 0);
    window.nearbyUsers = nearbyUsers;
    window.olmap = olmap;
    return;
  }

  // 优先尝试获取用户当前位置
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const userLng = pos.coords.longitude;
        const userLat = pos.coords.latitude;
        const center = fromLonLat([userLng, userLat], 'EPSG:3857');
        const viewOpts = Object.assign({
          projection: 'EPSG:3857',
          center,
          zoom: 17.5,
          minZoom: 2,
          maxZoom: 22, // 不要设置过大，建议22以内
          constrainResolution: false // 允许任意缩放级别
        }, props.viewConf);

        const map = new Map({
          target: 'mapDom',
          view: new View(viewOpts),
          layers: [] // 这里不初始化任何底图，由 PublicMap 控制
        });

        window.map = map;
        olmap = map;
        emit('created', map);

        // 关键：移除所有已存在的控件，避免重复
        const controlsToRemove = [];
        map.getControls().forEach(ctrl => {
          const name = ctrl.constructor && ctrl.constructor.name;
          if (
            name === 'MousePosition' ||
            name === 'ScaleLine' ||
            name === 'OverviewMap'
          ) {
            controlsToRemove.push(ctrl);
          }
        });
        controlsToRemove.forEach(ctrl => map.removeControl(ctrl));

        window.dispatchEvent(new CustomEvent('map-created', { detail: map }));
        // 通知 PublicMap 组件加载天地图底图
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('refresh-basemap', { detail: 'tian' }));
        }, 0);
        window.nearbyUsers = nearbyUsers;
        window.olmap = olmap;
        startWatchUserPosition();
      },
      err => {
        // 定位失败，使用默认中心
        const viewOpts = Object.assign({
          projection: 'EPSG:3857',
          center: [12758612.973162018, 3562849.0216611675],
          zoom: 17.5,
          minZoom: 2,
          maxZoom: 22,
          constrainResolution: false
        }, props.viewConf);

        const map = new Map({
          target: 'mapDom',
          view: new View(viewOpts),
          layers: [] // 这里不初始化任何底图，由 PublicMap 控制
        });

        window.map = map;
        olmap = map;
        emit('created', map);

        // 关键：移除所有已存在的控件，避免重复
        const controlsToRemove = [];
        map.getControls().forEach(ctrl => {
          const name = ctrl.constructor && ctrl.constructor.name;
          if (
            name === 'MousePosition' ||
            name === 'ScaleLine' ||
            name === 'OverviewMap'
          ) {
            controlsToRemove.push(ctrl);
          }
        });
        controlsToRemove.forEach(ctrl => map.removeControl(ctrl));

        window.dispatchEvent(new CustomEvent('map-created', { detail: map }));
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('refresh-basemap', { detail: 'tian' }));
        }, 0);
        window.nearbyUsers = nearbyUsers;
        window.olmap = olmap;
        startWatchUserPosition();
      }
    );
  } else {
    // 浏览器不支持定位，使用默认中心
    const viewOpts = Object.assign({
      projection: 'EPSG:3857',
      center: [12758612.973162018, 3562849.0216611675],
      zoom: 17.5,
      minZoom: 2,
      maxZoom: 22,
      constrainResolution: false
    }, props.viewConf);

    const map = new Map({
      target: 'mapDom',
      view: new View(viewOpts),
      layers: [] // 这里不初始化任何底图，由 PublicMap 控制
    });

    window.map = map;
    olmap = map;
    emit('created', map);

    // 关键：移除所有已存在的控件，避免重复
    const controlsToRemove = [];
    map.getControls().forEach(ctrl => {
      const name = ctrl.constructor && ctrl.constructor.name;
      if (
        name === 'MousePosition' ||
        name === 'ScaleLine' ||
        name === 'OverviewMap'
      ) {
        controlsToRemove.push(ctrl);
      }
    });
    controlsToRemove.forEach(ctrl => map.removeControl(ctrl));

    window.dispatchEvent(new CustomEvent('map-created', { detail: map }));
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('refresh-basemap', { detail: 'tian' }));
    }, 0);
    window.nearbyUsers = nearbyUsers;
    window.olmap = olmap;
    startWatchUserPosition();
  }

  window.addEventListener('refresh-basemap', () => {
    setTimeout(() => {
      if (olmap) {
        if (olmap.updateSize) olmap.updateSize();
        if (olmap.renderSync) olmap.renderSync();
        renderUserMarkers(nearbyUsers.value);
      }
    }, 500);
  });
});
</script>

<template>
  <div style="width:100%;height:100%;position:relative;">
    <div id="mapDom" class="map"></div>
    <!-- 右侧定位按钮（已融合上传功能） -->
    <div class="usermap-btns">
      <div class="locate-btn-wrapper" title="定位到当前坐标并上传">
        <svg
          class="locate-svg-btn"
          @click="!locating && getCurrentLocation()"
          :style="{ pointerEvents: locating ? 'none' : 'auto', opacity: locating ? 0.5 : 1 }"
          width="56"
          height="56"
          viewBox="0 0 4855.79 4855.79"
          style="cursor:pointer;"
          xmlns="http://www.w3.org/2000/svg"
        >
          <g>
            <circle class="fil0" style="stroke:#4D4D4D;stroke-width:617.74;stroke-miterlimit:22.9256;fill:none;" cx="2427.9" cy="2427.89" r="1495.78"/>
            <path class="fil0" style="stroke:#4D4D4D;stroke-width:617.74;stroke-miterlimit:22.9256;fill:none;" d="M3092.69 2427.89c0,-367.15 -297.64,-664.79 -664.79,-664.79 -367.15,0 -664.79,297.64 -664.79,664.79 0,367.15 297.64,664.79 664.79,664.79 367.15,0 664.79,-297.64 664.79,-664.79z"/>
            <line class="fil0" style="stroke:#4D4D4D;stroke-width:617.74;stroke-linecap:round;stroke-miterlimit:22.9256;fill:none;" x1="2427.9" y1="3923.66" x2="2427.9" y2="4546.91"/>
            <line class="fil0" style="stroke:#4D4D4D;stroke-width:617.74;stroke-linecap:round;stroke-miterlimit:22.9256;fill:none;" x1="2427.9" y1="308.88" x2="2427.9" y2="932.11"/>
            <line class="fil0" style="stroke:#4D4D4D;stroke-width:617.74;stroke-linecap:round;stroke-miterlimit:22.9256;fill:none;" x1="932.12" y1="2427.89" x2="308.88" y2="2427.89"/>
            <line class="fil0" style="stroke:#4D4D4D;stroke-width:617.74;stroke-linecap:round;stroke-miterlimit:22.9256;fill:none;" x1="4546.91" y1="2427.89" x2="3923.67" y2="2427.89"/>
            <circle class="fil0" style="stroke:#0573E1;stroke-width:617.74;stroke-miterlimit:22.9256;fill:none;" cx="2427.9" cy="2427.89" r="664.79"/>
          </g>
        </svg>
      </div>
      <!-- 删除上传按钮，只保留定位按钮 -->
    </div>
    <!-- 底部搜索搭子按钮和提示信息 -->
    <div class="search-nearby-bar">
      <div class="search-error-msg-bar">
        <span v-if="errorMsg" class="error-msg search-error-msg">{{ errorMsg }}</span>
      </div>
      <el-button type="primary" size="large" @click="searchNearby">搜索附近游戏搭子</el-button>
    </div>
    <!-- 用户信息弹窗 -->
    <el-dialog v-model="showUserDialog" title="用户信息" width="320px" :close-on-click-modal="true" append-to-body>
      <div style="text-align:center;" v-if="selectedUser">
        <el-avatar :size="80" :src="selectedUser.avatar || 'https://cdn.jsdelivr.net/gh/xiangyuecn/avatardata@main/blank-avatar.png'" style="margin-bottom: 16px;" />
        <div style="margin:16px 0;">账号：{{ selectedUser.username }}</div>
        <template v-if="isSelf">
          <div style="color:#409eff;">这是你自己</div>
        </template>
        <template v-else-if="isFriend">
          <div style="color:#67c23a;">已是你的好友</div>
        </template>
        <template v-else>
          <el-button
            type="success"
            :disabled="pendingFriendRequests && pendingFriendRequests.includes(selectedUser.username)"
            @click="addFriend(selectedUser.username)"
          >
            {{ (pendingFriendRequests && pendingFriendRequests.includes(selectedUser.username)) ? '等待对方回复' : '添加好友' }}
          </el-button>
        </template>
      </div>
    </el-dialog>
    <!-- 挂载控件 -->
    <MousePosition />
    <ScaleLine />
    <OverviewMap />
  </div>
</template>

<style>
.map {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: visible !important;
}

.usermap-btns {
  position: fixed;
  right: 40px;
  top: calc(50% + 200px); /* 向下移动100像素 */
  z-index: 10010;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
  transform: translateY(-50%);
  background: transparent !important; /* 保证背景透明 */
}
.publicmap-placeholder {
  /* 用于占位，与publicmap控件高度一致 */
  width: 310px;
  height: 140px;
  margin-bottom: 20px; /* 定位控件与publicmap控件间距20px */
  pointer-events: none;
}
.locate-btn-wrapper {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  background: transparent !important; /* 保证背景透明 */
}
.locate-svg-btn {
  pointer-events: auto;
  background: transparent !important;
  border: none;
  padding: 0;
  display: block;
  transition: box-shadow 0.2s;
  /* box-shadow: 0 2px 8px rgba(0,0,0,0.10); */ /* 注释掉外部边框阴影 */
  border-radius: 50%;
}
.locate-btn-wrapper:hover .locate-svg-btn {
  /* box-shadow: 0 4px 16px rgba(64,158,255,0.18); */ /* 注释掉悬停时的阴影 */
  background: #f0f7ff;
}
.upload-btn {
  height: 44px;
  border-radius: 22px;
  background: linear-gradient(90deg,#67c23a,#409eff);
  color: #fff;
  border: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  font-size: 18px;
  padding: 0 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: background 0.2s;
}
.upload-btn:disabled {
  background: #e0e0e0;
  color: #aaa;
  cursor: not-allowed;
}
.icon {
  font-size: 22px;
}
/* 只保留底部提示样式，去除原来左侧的 error-msg 定位 */
.error-msg {
  color: #f56c6c;
  background: #fff;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 15px;
  z-index: 20;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  pointer-events: auto;
  margin: 0 auto;
  position: static;
  display: inline-block;
  vertical-align: middle;
}
.search-error-msg {
  margin-bottom: 0;
}
html, body, #app {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
}
.user-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 99999 !important; /* 提高层级，防止被地图瓦片遮挡 */
  pointer-events: auto;
}
.search-nearby-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 18px;
  z-index: 30010;
  display: flex;
  flex-direction: column;
  align-items: center;
  pointer-events: auto;
  gap: 8px;
}
.search-error-msg-bar {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 24px;
  margin-bottom: 2px;
}
.user-location-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 21000;
  pointer-events: auto; /* 允许鼠标事件 */
}
.user-location-tip {
  position: fixed;
  background: #67c23a;
  color: #fff;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 15px;
  z-index: 30001;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

/* 新增：强制提升 overlay 容器 z-index */
.ol-overlaycontainer, .ol-overlaycontainer-stopevent {
  z-index: 99999 !important;
  pointer-events: none;
}
.ol-overlaycontainer .user-marker, .ol-overlaycontainer-stopevent .user-marker {
  pointer-events: auto;
}
</style>
  pointer-events: auto;
  gap: 8px;
}
.search-error-msg-bar {
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 24px;
  margin-bottom: 2px;
}
.user-location-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 21000;
  pointer-events: auto; /* 允许鼠标事件 */
}
.user-location-tip {
  position: fixed;
  background: #67c23a;
  color: #fff;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 15px;
  z-index: 30001;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}

/* 新增：强制提升 overlay 容器 z-index */
.ol-overlaycontainer, .ol-overlaycontainer-stopevent {
  z-index: 99999 !important;
  pointer-events: none;
}
.ol-overlaycontainer .user-marker, .ol-overlaycontainer-stopevent .user-marker {
  pointer-events: auto;
}
</style>
