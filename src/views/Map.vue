<script setup>
import Map from 'ol/Map.js';
import View from 'ol/View.js';
import TileLayer from 'ol/layer/Tile.js';
import XYZ from 'ol/source/XYZ.js';
import { onMounted, ref, reactive, watch } from 'vue';
import axios from 'axios';
import { fromLonLat, toLonLat } from 'ol/proj';
import Overlay from 'ol/Overlay.js';

// 获取当前登录用户信息
const user = ref(JSON.parse(localStorage.getItem('user') || '{}'));

const lng = ref('');
const lat = ref('');
const locating = ref(false);
const errorMsg = ref('');
let olmap = null;

const showNearby = ref(false);
const nearbyUsers = ref([]);
const overlays = reactive([]);
const showUserDialog = ref(false);
const selectedUser = ref(null);
const isSelf = ref(false);
const isFriend = ref(false);
const friends = ref([]);
const pendingFriendRequests = ref([]);

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

const getCurrentLocation = () => {
  locating.value = true;
  errorMsg.value = '';
  if (!navigator.geolocation) {
    errorMsg.value = '当前浏览器不支持地理位置获取';
    locating.value = false;
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
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
    },
    err => {
      errorMsg.value = '定位失败: ' + err.message;
      locating.value = false;
    }
  );
};

const uploadLocation = async () => {
  if (!lng.value || !lat.value) {
    errorMsg.value = '请先定位';
    return;
  }
  // 上传时带上用户名和头像
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

const searchNearby = async () => {
  if (!olmap) return;
  clearNearbyOverlays();
  const center = olmap.getView().getCenter();
  const [centerLng, centerLat] = toLonLat(center, 'EPSG:3857');
  const res = await axios.get('/api/nearby-users', {
    params: { lng: centerLng, lat: centerLat, radius: 3000 }
  });
  nearbyUsers.value = res.data || [];
  nearbyUsers.value.forEach(u => {
    if (!u.lng || !u.lat) return;
    const el = document.createElement('div');
    el.className = 'user-marker';
    el.innerHTML = `<img src="${u.avatar || 'https://cdn.jsdelivr.net/gh/xiangyuecn/avatardata@main/blank-avatar.png'}" style="width:48px;height:48px;border-radius:50%;border:2px solid #409eff;box-shadow:0 2px 8px rgba(0,0,0,0.15);cursor:pointer;" title="${u.username}"/>`;

    // 新增：鼠标移入时加光影、显示用户名提示，光标变为手型
    const img = el.querySelector('img');
    let tipDiv = null;
    img.onmouseenter = (e) => {
      img.style.boxShadow = '0 0 16px 6px #409eff, 0 2px 8px rgba(0,0,0,0.18)';
      img.style.borderColor = '#67c23a';
      img.style.zIndex = 30000;
      img.style.cursor = 'pointer';
      // 显示用户名提示
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
      // 跟随鼠标
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

    // 关键：阻止事件冒泡和默认行为
    el.onclick = (e) => {
      console.log('[Map.vue] user-marker div onclick, __drawdistance_disable_userinfo__:', window.__drawdistance_disable_userinfo__, u.username, e);
      if (window.__drawdistance_disable_userinfo__) {
        e && e.stopPropagation();
        e && e.preventDefault();
        return false;
      }
      handleUserMarkerClick(u, e);
    };
    // 兼容头像img本身的点击
    img.onclick = (e) => {
      console.log('[Map.vue] user-marker img onclick, __drawdistance_disable_userinfo__:', window.__drawdistance_disable_userinfo__, u.username, e);
      if (window.__drawdistance_disable_userinfo__) {
        e && e.stopPropagation();
        e && e.preventDefault();
        return false;
      }
      handleUserMarkerClick(u, e);
    };

    const overlay = new Overlay({
      element: el,
      positioning: 'center-center',
      stopEvent: false
    });
    overlay.setPosition(fromLonLat([u.lng, u.lat], olmap.getView().getProjection()));
    olmap.addOverlay(overlay);
    overlays.push(overlay);
  });
};

onMounted(() => {
  console.log('组件挂载，开始初始化地图...');

  if (window.map) {
    console.log('地图实例已存在，复用现有实例:', window.map);
    olmap = window.map;
    emit('created', window.map);
    // 触发一次底图初始化为天地图
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('refresh-basemap', { detail: 'tian' }));
    }, 0);
    return;
  }

  const viewOpts = Object.assign({
    projection: 'EPSG:3857',
    center: [12758612.973162018, 3562849.0216611675],
    zoom: 17.5
  }, props.viewConf);

  // 不初始化任何底图图层
  const map = new Map({
    target: 'mapDom',
    view: new View(viewOpts),
    layers: []
  });

  window.map = map;
  olmap = map;
  console.log('地图实例创建成功:', map);

  emit('created', map);

  window.dispatchEvent(new CustomEvent('map-created', { detail: map }));
  // 触发一次底图初始化为天地图
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('refresh-basemap', { detail: 'tian' }));
  }, 0);
});
</script>

<template>
  <div style="width:100%;height:100%;position:relative;">
    <div id="mapDom" class="map"></div>
    <!-- 左上角按钮容器 -->
    <div class="usermap-btns">
      <button
        class="locate-btn"
        :disabled="locating"
        @click="getCurrentLocation"
        title="定位到当前位置"
      >
        <span v-if="!locating" class="icon">&#128269;</span>
        <span v-else class="icon">...</span>
      </button>
      <button
        class="upload-btn"
        :disabled="!lng || !lat"
        @click="uploadLocation"
        title="上传当前位置"
      >
        <span class="icon">&#8679;</span> 上传坐标
      </button>
      <span v-if="errorMsg" class="error-msg">{{ errorMsg }}</span>
    </div>
    <!-- 底部搜索搭子按钮 -->
    <div class="search-nearby-bar">
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
  </div>
</template>

<style>
.map {
  width: 100%;
  height: 100%;
}

.usermap-btns {
  position: fixed;
  left: 40px;
  top: 50px;
  z-index: 10010;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}
.locate-btn,
.upload-btn {
  pointer-events: auto;
}
.locate-btn {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: #409eff;
  color: #fff;
  border: none;
  box-shadow: 0 2px 8px rgba(0,0,0,0.18);
  font-size: 28px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  margin-bottom: 10px;
}
.locate-btn:disabled {
  background: #b3d8ff;
  cursor: not-allowed;
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
.error-msg {
  position: absolute;
  left: 70px;
  top: 10px;
  color: #f56c6c;
  background: #fff;
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 15px;
  z-index: 20;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  pointer-events: auto;
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
  z-index: 20000;
  pointer-events: auto;
}
.search-nearby-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 18px;
  z-index: 30010;
  display: flex;
  justify-content: center;
  pointer-events: auto;
}
</style>
``` 
