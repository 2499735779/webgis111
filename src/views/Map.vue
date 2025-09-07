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
import { allGames, getGameNameById, gameCategories, gameNameToId } from './userinformation/games.js'  // 修正导入路径

// 获取当前登录用户信息
const user = ref(JSON.parse(localStorage.getItem('user') || '{}'));

const lng = ref('');
const lat = ref('');
const locating = ref(false);
const errorMsg = ref('');
const locationSuccess = ref(false); // 定位成功状态
const checks = ref('');  // 当前选择图层
let olmap = null;

let userPositionOverlay = null; // 实时位置覆盖物
let watchId = null;             // 定时器ID

// 添加一个变量来存储错误消息的计时器ID
let errorMsgTimer = null;

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
const selectedUserTags = ref([]) // 存储选中用户的游戏标签
const tagColors = ['#222', '#67c23a', '#409eff', '#a259e6', '#f56c6c'] // 标签颜色映射

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

// 统计标签出现次数
const getTagStats = (tags) => {
  const stats = {}
  tags.forEach(id => {
    stats[id] = (stats[id] || 0) + 1
  })
  return stats
}

// 合并标签逻辑：同一个标签出现多次，显示为一个标签，颜色随次数变化
const getMergedTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const stats = getTagStats(tags)
  return Object.entries(stats).map(([id, count]) => ({
    id: Number(id),
    count,
    color: tagColors[Math.min(count - 1, tagColors.length - 1)]
  }))
}

// 获取当前用户的游戏标签
const myGameTags = ref([]);

// 检查标签是否匹配
const isTagMatched = (tagId) => {
  if (!selectedUserTags.value) return false;
  return getMatchedTags(selectedUserTags.value).some(match => match.id === tagId);
};

// 获取匹配标签的光晕颜色
const getMatchTagColor = (tagId) => {
  if (!selectedUserTags.value) return '';
  const match = getMatchedTags(selectedUserTags.value).find(m => m.id === tagId);
  if (!match) return '';
  return getMatchLevelColor(match.matchLevel);
};

// 计算匹配等级的颜色
const getMatchLevelColor = (level) => {
  const colors = ['#67c23a', '#409eff', '#a259e6', '#ff9500', '#f56c6c'];
  return colors[Math.min(level - 1, 4)] || '';
};

// 获取匹配的标签
const getMatchedTags = (otherTags) => {
  if (!user.value || !user.value.username || !myGameTags.value || !Array.isArray(otherTags)) return [];
  
  // 统计我的标签
  const myTagCounts = {};
  myGameTags.value.forEach(tag => {
    myTagCounts[tag] = (myTagCounts[tag] || 0) + 1;
  });
  
  // 统计对方标签
  const otherTagCounts = {};
  otherTags.forEach(tag => {
    otherTagCounts[tag] = (otherTagCounts[tag] || 0) + 1;
  });
  
  // 查找重复标签并计算匹配度
  const matches = [];
  Object.keys(myTagCounts).forEach(tag => {
    if (otherTagCounts[tag]) {
      // 计算共同标签数（取两边出现次数的较小值）
      const count = Math.min(myTagCounts[tag], otherTagCounts[tag]);
      matches.push({
        id: Number(tag),
        count,
        matchLevel: Math.min(count, 5), // 匹配等级，最高5级
      });
    }
  });
  
  return matches;
};

// 根据匹配等级返回匹配文字
const getMatchLevelText = (level) => {
  const texts = ['意气相投', '志同道合', '惺惺相惜', '相见恨晚', '天作之合'];
  return texts[Math.min(level - 1, 4)] || '';
};

// 获取我的游戏标签
const fetchMyGameTags = async () => {
  if (!user.value || !user.value.username) return;
  try {
    const res = await axios.post('/api/user-info-batch', { usernames: [user.value.username] });
    if (Array.isArray(res.data) && res.data.length > 0) {
      myGameTags.value = res.data[0].gameTags || [];
    }
  } catch (err) {
    console.error('Failed to fetch user tags:', err);
  }
};

// 在页面加载时获取当前用户标签
onMounted(async () => {
  // ...existing code...
  await fetchMyGameTags(); // 添加这行
});

// 判断是否是自己或好友
const handleUserMarkerClick = async (u, e) => {
  e.stopPropagation();
  const centerUid = user.value.username;
  if (u.username === centerUid) {
    errorMsg.value = '这是您自己的位置';
    // 自动清除消息
    if (errorMsgTimer) {
      clearTimeout(errorMsgTimer);
    }
    errorMsgTimer = setTimeout(() => {
      errorMsg.value = '';
      errorMsgTimer = null;
    }, 5000);
    return;
  }

  // 先获取我的游戏标签，确保有最新数据用于比较
  await fetchMyGameTags();
  
  // 获取用户标签信息
  try {
    const res = await axios.post('/api/user-info-batch', {
      usernames: [u.username]
    });
    if (Array.isArray(res.data) && res.data.length > 0) {
      selectedUserTags.value = res.data[0].gameTags || [];
    }
  } catch (error) {
    console.error('Failed to fetch user tags:', error);
  }
  
  // 设置当前选中的用户
  selectedUser.value = u;
  
  // 使用异步函数检查是否是好友
  const isFriendUser = await isUserFriend(u.username);
  console.log(`${u.username} 是否是好友:`, isFriendUser);
  
  if (isFriendUser) {
    console.log(`${u.username} 是好友，使用好友信息界面`);
    // 如果是好友，使用好友菜单的查看好友主页方法
    if (window.friendMenuRef?.value?.viewFriendProfile) {
      // 构造完整的用户对象
      const friendObj = {
        username: u.username,
        avatar: u.avatar || defaultAvatar,
        // 添加好友标签信息
        gameTags: selectedUserTags.value
      };
      
      // 直接调用好友资料界面
      window.friendMenuRef.value.viewFriendProfile(friendObj);
      
      // 关闭普通用户信息弹窗
      showUserDialog.value = false;
    } else {
      console.log('friendMenuRef.viewFriendProfile 方法不存在，使用普通用户信息弹窗');
      // 如果没有找到好友菜单引用，则使用普通的用户信息弹窗
      showUserDialog.value = true;
      isFriend.value = true; // 标记为好友
    }
  } else {
    // 非好友，使用普通的用户信息弹窗
    console.log(`${u.username} 不是好友，使用普通用户信息弹窗`);
    showUserDialog.value = true;
    isFriend.value = false; // 标记不是好友
  }
};

// 在这里添加一个函数来判断用户是否是好友
const isUserFriend = async (username) => {
  // 判断一个用户是否是当前用户的好友
  if (!user.value || !user.value.username) return false;
  if (user.value.username === username) return false; // 自己不是自己的好友
  
  try {
    // 从后端直接获取最新的好友列表
    const res = await axios.get('/api/user-friends', {
      params: { username: user.value.username }
    });
    
    if (Array.isArray(res.data) && res.data.length > 0) {
      const myFriends = res.data;
      console.log(`[DEBUG] 从后端获取到的好友列表:`, myFriends);
      
      // 检查是否包含目标用户名
      const isFriend = myFriends.some(f => {
        if (typeof f === 'string') return f === username;
        return f && f.username === username;
      });
      
      console.log(`[DEBUG] 重新检查 ${username} 是否为好友:`, isFriend);
      return isFriend;
    }
  } catch (err) {
    console.error("[DEBUG] 获取好友列表失败:", err);
  }
  
  return false;
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
  
  // 清除错误消息计时器
  if (errorMsgTimer) {
    clearTimeout(errorMsgTimer);
    errorMsgTimer = null;
  }
});

// 用户点击按钮后定位并上传当前位置（只上传一次，不实时上传）
const getCurrentLocation = () => {
  locating.value = true;
  errorMsg.value = '';
  locationSuccess.value = false;
  
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
        
        // 显示成功反馈
        locationSuccess.value = true;
        errorMsg.value = '定位成功';
        
        // 3秒后隐藏成功状态
        setTimeout(() => { 
          locationSuccess.value = false;
          errorMsg.value = '';
        }, 3000);
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

// 渲染标记点函数 - 需要修改以暴露给全局
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
  
  // 清除可能存在的旧计时器
  if (errorMsgTimer) {
    clearTimeout(errorMsgTimer);
    errorMsgTimer = null;
  }
  
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
    
    // 新增：检查是否没有找到附近玩家
    if (nearbyUsers.value.length === 0) {
      errorMsg.value = '附近没有玩家留下足迹，点击定位标识留下您的足迹吧！';
      
      // 设置5秒后自动清除消息
      errorMsgTimer = setTimeout(() => {
        errorMsg.value = '';
        errorMsgTimer = null;
      }, 5000);
      
      return;
    }
    
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
    
    // 设置错误消息也自动消失
    errorMsgTimer = setTimeout(() => {
      errorMsg.value = '';
      errorMsgTimer = null;
    }, 5000);
  }
};

// 解决 transformGCJ02ToWGS84 未定义的问题
// 添加坐标转换函数
function transformGCJ02ToWGS84(lng, lat) {
  // 检查是否在中国境外
  function outOfChina(lng, lat) {
    return (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271);
  }
  
  if (outOfChina(lng, lat)) {
    return { lng, lat };
  }
  
  let dlat = transformLatitude(lng - 105.0, lat - 35.0);
  let dlng = transformLongitude(lng - 105.0, lat - 35.0);
  
  const radlat = lat / 180.0 * Math.PI;
  let magic = Math.sin(radlat);
  magic = 1 - 0.00669342162296594323 * magic * magic;
  
  const sqrtmagic = Math.sqrt(magic);
  dlat = (dlat * 180.0) / ((6378245.0 * (1 - 0.00669342162296594323)) / (magic * sqrtmagic) * Math.PI);
  dlng = (dlng * 180.0) / (6378245.0 / sqrtmagic * Math.cos(radlat) * Math.PI);
  
  const mglat = lat + dlat;
  const mglng = lng + dlng;
  
  return {
    lng: lng * 2 - mglng,
    lat: lat * 2 - mglat
  };
}

// 辅助函数：经度偏移计算
function transformLongitude(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
  return ret;
}

// 辅助函数：纬度偏移计算
function transformLatitude(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320.0 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

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

  // 监听地图点击事件，进行坐标转换
  if (window.map) {
    window.map.on('click', function(evt) {
      // 如果测距模式激活，不执行默认点击行为
      if (window.__drawdistance_disable_userinfo__) {
        console.log('[Map.vue] 测距模式激活，跳过默认点击处理');
        return;
      }
      
      // 获取点击位置的坐标
      const coordinate = evt.coordinate;
      // 将坐标转换为经纬度，使用导入的 toLonLat 函数
      const lonlat = toLonLat(coordinate, window.map.getView().getProjection());
      
      // 根据当前选择的地图类型，对坐标进行转换
      if (checks && checks.value === 'gaode') {
        // 高德地图点击位置需要转换为天地图坐标系
        const corrected = transformGCJ02ToWGS84(lonlat[0], lonlat[1]);
        // 转回Mercator投影坐标，使用导入的 fromLonLat 函数
        const correctedCoord = fromLonLat([corrected.lng, corrected.lat], window.map.getView().getProjection());
        // 存储修正后的坐标
        window.correctedCoordinate = correctedCoord;
      } 
      else {
        // 天地图等其他地图不需要转换
        window.correctedCoordinate = coordinate;
      }
    });
  }
});
</script>

<template>
  <div style="width:100%;height:100%;position:relative;">
    <div id="mapDom" class="map"></div>
    <!-- 替换原有定位按钮为新设计的风格按钮 -->
    <div class="usermap-btns">
      <div class="locate-btn-wrapper" title="定位到当前坐标并上传">
        <div 
          class="location-button-container" 
          @click="!locating && getCurrentLocation()"
          :class="{ 'success-state': locationSuccess }"
        >
          <img 
            src="/location-button.svg" 
            class="location-button-img" 
            :style="{ opacity: locating ? 0.6 : 1 }"
            alt="定位按钮"
          />
          <!-- 添加加载指示器 -->
          <div class="location-loading-indicator" v-if="locating">
            <div class="spinner"></div>
          </div>
          <!-- 添加成功指示器 -->
          <div class="location-success-indicator" v-if="locationSuccess">
            <div class="success-icon">✓</div>
          </div>
          <!-- 添加悬停提示 -->
          <div class="location-tooltip">点击定位</div>
        </div>
      </div>
    </div>
    
    <!-- 底部搜索搭子按钮和提示信息 -->
    <div class="search-nearby-bar">
      <div class="search-error-msg-bar">
        <span v-if="errorMsg" class="error-msg search-error-msg">{{ errorMsg }}</span>
      </div>
      <el-button 
        type="primary" 
        size="large" 
        @click="searchNearby" 
        class="search-nearby-btn cuphead-game-btn-2d"
      >搜索附近游戏搭子</el-button>
    </div>
    <!-- 用户信息弹窗 -->
    <el-dialog
      v-model="showUserDialog"
      title=""
      width="540px"
      append-to-body
      class="user-info-dialog cuphead-bg"
      :wrapper-class="'user-info-cuphead-bg'"
      :z-index="4100"
      :close-on-click-modal="true"
      :show-close="false"
    >
      <template #header="{ close }">
        <div class="cuphead-header-bar">
          <span class="cuphead-title-text">用户信息</span>
          <button class="cuphead-close-btn" aria-label="关闭" @click="close">
            <img src="/cross-156772.svg" alt="关闭" class="cuphead-close-svg" width="32" height="32" />
          </button>
        </div>
      </template>
      <div class="cuphead-content-bg" v-if="selectedUser">
        <div class="cuphead-avatar-area">
          <div class="avatar-frame">
            <el-avatar :size="120" :src="selectedUser.avatar || defaultAvatar" class="avatar-img" />
            <div class="avatar-glow"></div>
          </div>
          <div class="user-name">{{ selectedUser.username }}</div>
        </div>
        <div class="cuphead-divider"></div>
        <div class="cuphead-section">
          <div class="section-title">游戏标签</div>
          <div class="tag-list">
            <template v-if="selectedUserTags.length > 0">
              <template v-for="tag in getMergedTags(selectedUserTags)" :key="tag.id">
                <!-- 查找当前标签是否匹配 -->
                <el-tag
                  :style="{
                    backgroundColor: tag.color,
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '18px',
                    border: 'none',
                    fontFamily: '\'JiangxiZhuokai\',cursive,sans-serif',
                    // 添加匹配标签的光晕效果
                    boxShadow: isTagMatched(tag.id) ? `0 0 15px ${getMatchTagColor(tag.id)}` : '',
                    position: 'relative'
                  }"
                  class="cuphead-tag"
                >
                  {{ getGameNameById(tag.id) }}
                  <span v-if="tag.count > 1" style="margin-left:6px;">x{{ tag.count }}</span>
                </el-tag>
              </template>
              
              <!-- 匹配等级说明区域 -->
              <div class="match-levels-container" v-if="getMatchedTags(selectedUserTags).length > 0">
                <div class="match-levels-title">匹配等级</div>
                <div class="match-level-tags">
                  <div 
                    v-for="match in getMatchedTags(selectedUserTags)" 
                    :key="`match-${match.id}`"
                    class="match-tag-item"
                  >
                    <div class="match-tag-name">{{ getGameNameById(match.id) }}</div>
                    <div 
                      class="match-tag-level"
                      :style="{
                        color: getMatchLevelColor(match.matchLevel),
                        textShadow: `0 0 8px ${getMatchLevelColor(match.matchLevel)}`
                      }"
                    >{{ getMatchLevelText(match.matchLevel) }}</div>
                  </div>
                </div>
              </div>
            </template>
            <div v-else class="empty-tags-message">该用户暂未添加游戏标签</div>
          </div>
        </div>
        <div class="cuphead-divider"></div>
        <div class="cuphead-section">
          <el-button
            v-if="!isFriend"
            type="primary"
            class="cuphead-game-btn-2d"
            @click="friendMenuRef && friendMenuRef.value.sendFriendRequest(selectedUser.username)"
            :disabled="isPending"
          >
            <template v-if="isPending">已发送好友请求</template>
            <template v-else>添加好友</template>
          </el-button>
          <template v-else>
            <span class="already-friend-text">已是你的好友</span>
            <el-button
              type="primary"
              class="cuphead-game-btn-2d"
              @click="openGlobalChatDialog && openGlobalChatDialog(selectedUser); showUserDialog = false;"
            >发送消息</el-button>
          </template>
        </div>
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

/* 重新设计的定位按钮样式 */
.usermap-btns {
  position: fixed;
  right: 40px;
  top: calc(50% + 200px);
  z-index: 10010;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0;
  transform: translateY(-50%);
  background: transparent !important;
}

.locate-btn-wrapper {
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 10px;
  background: transparent !important;
  position: relative;
}

.location-button-container {
  width: 64px;
  height: 64px;
  position: relative;
  cursor: pointer;
  transition: transform 0.3s;
}

.location-button-container:hover {
  transform: scale(1.08) translateY(-3px);
}

.location-button-container:active {
  transform: scale(0.95);
}

.location-button-img {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 4px 8px rgba(166, 124, 82, 0.3));
  transition: filter 0.3s;
}

/* 成功状态样式 */
.location-button-container.success-state .location-button-img {
  filter: drop-shadow(0 0 12px rgba(103, 194, 58, 0.8));
}

.location-success-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 251, 230, 0.7);
  border-radius: 50%;
}

.success-icon {
  width: 32px;
  height: 32px;
  background: #67c23a;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: bold;
  border: 2px solid #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  animation: bounce 0.5s ease;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-10px); }
  60% { transform: translateY(-5px); }
}

/* 悬停提示样式 */
.location-tooltip {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%) scale(0);
  background: #fffbe6;
  color: #7c4a1e;
  padding: 6px 12px;
  border-radius: 12px;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-weight: bold;
  font-size: 14px;
  white-space: nowrap;
  border: 2px solid #a67c52;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  opacity: 0;
  transition: transform 0.2s, opacity 0.2s;
  pointer-events: none;
  z-index: 10011;
}

.location-button-container:hover .location-tooltip {
  transform: translateX(-50%) scale(1);
  opacity: 1;
}

/* 加载状态指示器 */
.location-loading-indicator {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 251, 230, 0.7);
  border-radius: 50%;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid #a67c52;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.search-nearby-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 30px; /* 增加底部间距 */
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

/* 复用 Home.vue 的主题弹窗样式 */
.el-dialog__wrapper.user-info-cuphead-bg {
  background: linear-gradient(135deg, #fffbe6 0%, #f5e1a4 100%);
  border-radius: 60px;
  min-width: 340px;
  min-height: 420px;
  max-width: 520px;
  max-height: 640px;
  aspect-ratio: 1/1.2;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 12px 48px rgba(80,60,30,0.18),
    0 0 0 18px #c7a16b inset,
    0 0 0 4px #7c4a1e;
  position: relative;
  overflow: hidden;
}
.el-dialog__wrapper.user-info-cuphead-bg .el-dialog {
  background: transparent !important;
  box-shadow: none !important;
  border-radius: 60px !important;
  border: none !important;
}
.el-dialog__wrapper.user-info-cuphead-bg .el-dialog__body {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  padding: 0 !important;
}
.cuphead-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px 0 0;
  background: none;
}
.cuphead-title-text {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 28px;
  font-weight: bold;
  color: #a67c52;
  margin-left: 12px;
  margin-top: 8px;
  text-shadow: 2px 2px 0 #f5e1a4, 0 2px 8px #a67c52;
  user-select: none;
}
.cuphead-close-btn {
  background: #fffbe6;
  border: 2px solid #a67c52;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  cursor: pointer;
  box-shadow: 0 2px 8px #a67c52, 0 2px 8px rgba(0,0,0,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, box-shadow 0.2s;
  margin-left: 12px;
  outline: none;
  padding: 0;
}
.cuphead-close-btn:hover {
  background: #f5b507;
  box-shadow: 0 4px 16px #a67c52, 0 2px 8px rgba(0,0,0,0.12);
}
.cuphead-close-svg {
  display: block;
  width: 32px;
  height: 32px;
}

/* 修改地图用户信息弹窗背景使整体一致 */
.map-user-info-content {
  background: transparent;
  border-radius: 24px;
  padding: 24px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 0 12px;
  position: relative;
  /* 移除阴影 */
  box-shadow: none;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
}

/* 调整头像发光效果，使其更协调 */
.map-avatar-glow {
  position: absolute;
  left: 0; top: 0;
  width: 110px; height: 110px;
  border-radius: 50%;
  box-shadow: 0 0 24px 12px rgba(245, 181, 7, 0.8), 0 0 0 6px rgba(255, 255, 255, 0.8) inset;
  pointer-events: none;
  z-index: 1;
}

/* 修复标题区位置 - 确保标题在内部而不是外部 */
:deep(.user-info-cuphead-bg .el-dialog__header) {
  position: absolute !important;
  left: 0 !important;
  top: 0 !important;
  width: 100% !important;
  padding: 20px 20px 0 20px !important;
  z-index: 10 !important;
}

/* 修复弹窗内容区域 - 增加上部距离避开标题 */
:deep(.user-info-cuphead-bg .el-dialog__body) {
  padding-top: 80px !important; /* 为标题留出空间 */
  box-sizing: border-box;
}

/* 新增：恢复缺失的用户信息弹窗样式 */
.map-user-avatar {
  position: relative;
  width: 110px;
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.map-avatar-img {
  box-shadow: 0 0 16px #f5b507, 0 2px 8px rgba(0,0,0,0.10);
  border: 3px solid #f5b507;
  border-radius: 50%;
  background: #fff;
}

.map-user-name {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 26px;
  font-weight: bold;
  color: #a67c52;
  margin: 8px 0;
  text-shadow: 1px 1px 0 #f5e1a4, 0 2px 4px #a67c52;
}

.map-user-status {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.map-status-self, .map-status-friend {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 18px;
  padding: 8px 16px;
  border-radius: 12px;
  font-weight: bold;
}

.map-status-self {
  color: #409eff;
  background: rgba(64,158,255,0.1);
  border: 2px solid #409eff;
}

.map-status-friend {
  color: #67c23a;
  background: rgba(103,194,58,0.1);
  border: 2px solid #67c23a;
}

.map-add-friend-btn {
  background: linear-gradient(90deg, #fffbe6 0%, #f5e1a4 100%) !important;
  color: #a67c52 !important;
  border-radius: 16px !important;
  border: 2px solid #a67c52 !important;
  font-weight: bold !important;
  box-shadow: 0 2px 8px rgba(166,124,82,0.12);
  padding: 10px 20px !important;
  font-size: 16px !important;
  font-family: 'JiangxiZhuokai', cursive, sans-serif !important;
  transition: background 0.2s, box-shadow 0.2s;
}

.map-add-friend-btn:hover:not(:disabled) {
  background: linear-gradient(90deg, #f5e1a4 0%, #ffe066 100%) !important;
  box-shadow: 0 4px 16px rgba(166,124,82,0.18);
}

.map-add-friend-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* 标签样式 */
.map-user-tags {
  width: 100%;
  margin: 8px 0;
}

.map-section-title {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 20px;
  font-weight: bold;
  color: #7c4a1e;
  margin-bottom: 10px;
  text-align: center;
  text-shadow: 1px 1px 0 #f5e1a4;
  letter-spacing: 1px;
}

.map-tag-list {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  margin-bottom: 10px;
}

.map-cuphead-tag {
  border-radius: 16px !important;
  box-shadow: 0 2px 8px rgba(166,124,82,0.10);
  font-size: 16px !important;
  padding: 6px 16px !important;
  font-family: 'JiangxiZhuokai', cursive, sans-serif !important;
  border: none !important;
  font-weight: bold !important;
}

/* 茶杯头风格的2D手绘搜索按钮 */
.search-nearby-btn.cuphead-game-btn-2d {
  background: #fff6d0 !important;
  color: #7c4a1e !important;
  border: 3px solid #7c4a1e !important;
  border-radius: 18px !important;
  font-weight: bold !important;
  box-shadow: 
    0 4px 0 #7c4a1e,
    0 6px 8px rgba(0,0,0,0.15);
  padding: 12px 32px !important;
  margin: 12px 0;
  font-size: 20px !important;
  position: relative;
  transform: translateY(-2px);
  transition: transform 0.1s, box-shadow 0.1s, background 0.2s;
  text-shadow: 1px 1px 0 #fffbe6;
  font-family: 'JiangxiZhuokai', cursive, sans-serif !important;
  overflow: visible;
}

.search-nearby-btn.cuphead-game-btn-2d::before {
  content: "";
  position: absolute;
  left: -6px;
  right: -6px;
  top: -6px;
  bottom: -6px;
  background: transparent;
  border: 2px dashed rgba(166, 124, 82, 0.4);
  border-radius: 22px;
  z-index: -1;
  opacity: 0;
  transition: opacity 0.2s;
}

.search-nearby-btn.cuphead-game-btn-2d:hover {
  background: #ffeba0 !important;
  color: #7c4a1e !important;
  transform: translateY(0);
  box-shadow: 
    0 2px 0 #7c4a1e,
    0 4px 6px rgba(0,0,0,0.1);
}

.search-nearby-btn.cuphead-game-btn-2d:hover::before {
  opacity: 1;
}

.search-nearby-btn.cuphead-game-btn-2d:active {
  transform: translateY(2px);
  box-shadow: 
    0 0px 0 #7c4a1e,
    0 2px 4px rgba(0,0,0,0.08);
}

.error-msg.search-error-msg {
  background: #fff6d0;
  color: #7c4a1e;
  border: 2px solid #a67c52;
  border-radius: 12px;
  padding: 8px 24px;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 16px;
  font-weight: bold;
  box-shadow: 0 2px 8px rgba(166, 124, 82, 0.15);
  text-align: center;
  max-width: 90%;
  margin: 0 auto;
  animation: fadeIn 0.5s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 删除按钮样式 */
.delete-btn-overlay {
  background: transparent;
  border: none;
  z-index: 99999 !important;
  pointer-events: auto !important;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  transition: background 0.2s, transform 0.2s;
}

.delete-btn-overlay:hover {
  background: rgba(255, 255, 255, 0.8);
  transform: scale(1.1);
}

.delete-btn-overlay:active {
  transform: scale(0.95);
}

/* 新增匹配等级样式 */
.match-levels-container {
  width: 100%;
  margin-top: 20px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 12px;
  border: 2px dashed #e7cfa2;
}

.match-levels-title {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 20px;
  font-weight: bold;
  color: #7c4a1e;
  text-align: center;
  margin-bottom: 10px;
  text-shadow: 1px 1px 0 #f5e1a4;
}

.match-level-tags {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
}

.match-tag-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.match-tag-name {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 16px;
  color: #7c4a1e;
}

.match-tag-level {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 18px;
  font-weight: bold;
  letter-spacing: 1px;
  /* 颜色和文字发光在行内样式中设置 */
}

.already-friend-text {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 18px;
  color: #67c23a;
  margin-bottom: 12px;
  display: block;
}

/* 测距模式下强制十字光标 */
.measure-active,
.measure-active * {
  cursor: crosshair !important;
}

body.measure-mode .ol-viewport,
body.measure-mode .ol-viewport * {
  cursor: crosshair !important;
}

/* 确保测距相关元素在测距模式下可见 */
body.measure-mode .drawdistance-cursor-tip,
body.measure-mode .distance-label,
body.measure-mode .delete-btn-overlay {
  visibility: visible !important;
  opacity: 1 !important;
  z-index: 999999 !important;
  pointer-events: auto !important;
}
</style>


