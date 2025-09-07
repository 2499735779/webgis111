<template>
  <div
    class="friend-list-sidebar"
    :class="{ show: showFriendList }"
    @mouseenter="handleFriendListEnter"
    @mouseleave="handleFriendListLeave"
  >
    <div class="friend-list-title">
      好友列表
      <el-button class="add-friend-btn" type="primary" circle size="small" @click.stop="showAddFriendDialog = true" title="添加好友">
        <span style="font-size:20px;">+</span>
      </el-button>
    </div>
    <el-scrollbar style="height:calc(100vh - 60px);">
      <el-skeleton v-if="loadingFriends" :rows="6" animated />
      <div v-else>
        <div v-if="friends.length === 0 && friendRequests.length === 0" class="friend-list-empty">暂无好友</div>
        <!-- 好友请求项 -->
        <div
          v-for="req in friendRequests"
          :key="'req-' + req.from"
          class="friend-list-item friend-request-item"
        >
          <div class="friend-request-info">
            <el-avatar :size="36" :src="req.avatar || defaultAvatar" />
            <span class="friend-list-name">{{ req.from }}</span>
          </div>
          <!-- 修改：调整按钮容器的样式，增加右边距，并确保中轴线对齐 -->
          <div class="friend-request-actions-vertical">
            <el-button 
              type="success" 
              size="small" 
              class="action-btn action-accept" 
              @click.stop="handleRequest(req.from, true)"
              title="同意"
            >同意</el-button>
            <el-button 
              type="danger" 
              size="small" 
              class="action-btn action-reject" 
              @click.stop="handleRequest(req.from, false)"
              title="拒绝"
            >拒绝</el-button>
          </div>
        </div>
        <!-- 好友列表项 -->
        <div
          v-for="f in friends"
          :key="f.username"
          class="friend-list-item"
          @click="handleFriendClick(f)"
          @contextmenu.prevent.stop="onFriendContextMenu($event, f)"
          ref="friendItemRefs"
        >
          <el-avatar :size="36" :src="f.avatar || defaultAvatar" @click.stop="openAvatarModal(f.avatar)" />
          <span class="friend-list-name">{{ f.username }}</span>
          <span
            v-if="unreadMap[f.username] > 0"
            class="friend-unread-dot"
            title="有新消息"
          ></span>
        </div>
      </div>
    </el-scrollbar>
    <!-- 修改：添加好友弹窗替换为茶杯头风格 -->
    <el-dialog
      v-model="showAddFriendDialog"
      title=""
      width="420px"
      append-to-body
      align-center
      class="add-friend-dialog-center cuphead-dialog"
      :modal="true"
      :close-on-click-modal="true"
      :show-close="false"
    >
      <template #header="{ close }">
        <div class="cuphead-header-bar">
          <span class="cuphead-title-text">添加好友</span>
          <button class="cuphead-close-btn" aria-label="关闭" @click="close">
            <img src="/cross-156772.svg" alt="关闭" class="cuphead-close-svg" width="28" height="28" />
          </button>
        </div>
      </template>
      <!-- 新增：整体茶杯头风格 -->
      <div class="cuphead-dialog-content">
        <div class="cuphead-search-container">
          <el-input
            v-model="searchName"
            placeholder="输入用户名搜索"
            clearable
            @keyup.enter="searchUser"
            class="cuphead-search-input"
          >
            <template #prefix>
              <i class="el-icon-search">🔍</i>
            </template>
          </el-input>
          <button class="cuphead-search-btn" @click="searchUser">搜索</button>
        </div>
        <div v-if="searchResult !== null" class="cuphead-search-result">
          <div v-if="searchResult && searchResult.username" class="cuphead-user-card">
            <div class="cuphead-avatar-container">
              <el-avatar :size="64" :src="searchResult.avatar || defaultAvatar" class="cuphead-avatar" />
            </div>
            <div class="cuphead-user-info">
              <span class="cuphead-username">{{ searchResult.username }}</span>
              <button
                class="cuphead-add-btn"
                :disabled="searchResult.username === user.username || isFriend(searchResult.username) || isPending(searchResult.username)"
                @click="addFriendBySearch(searchResult.username)"
              >
                <template v-if="searchResult.username === user.username">这是你自己</template>
                <template v-else-if="isFriend(searchResult.username)">已是好友</template>
                <template v-else-if="isPending(searchResult.username)">已发送请求</template>
                <template v-else>添加好友</template>
              </button>
            </div>
          </div>
          <div v-else class="cuphead-no-result">
            <div class="cuphead-no-result-icon">🔍</div>
            <div class="cuphead-no-result-text">未找到该用户</div>
          </div>
        </div>
      </div>
    </el-dialog>
    <!-- 只保留棕色发光圆角框弹窗，绝对定位模拟弹窗位置 -->
    <div
      v-if="contextMenu.visible && contextMenu.friend && contextMenu.virtualRef"
      class="friend-context-popover"
      :style="{
        position: 'fixed',
        left: contextMenu.virtualRef.getBoundingClientRect().left + 'px',
        top: contextMenu.virtualRef.getBoundingClientRect().top + 'px',
        zIndex: 6000
      }"
    >
      <div class="context-menu-list">
        <div class="context-menu-item context-menu-item-profile" @click="viewFriendProfile(contextMenu.friend)">查看好友主页</div>
        <div class="context-menu-item" @click="clearChatHistory(contextMenu.friend)">清空聊天记录</div>
        <div class="context-menu-item context-menu-item-danger" @click="deleteFriend(contextMenu.friend)">删除好友</div>
        <div class="context-menu-item context-menu-item-cancel" @click="closeContextMenu">取消</div>
      </div>
    </div>

    <!-- 好友主页弹窗 -->
    <el-dialog
      v-model="showFriendProfile"
      title=""
      width="540px"
      :close-on-click-modal="true"
      :modal="true"
      append-to-body
      class="user-info-dialog cuphead-bg"
      :wrapper-class="'user-info-cuphead-bg'"
      :z-index="4100"
      :show-close="false"
      @close="handleFriendProfileClose"
    >
      <template #header="{ close }">
        <div class="cuphead-header-bar">
          <span class="cuphead-title-text">好友主页</span>
          <button class="cuphead-close-btn" aria-label="关闭" @click="close">
            <img src="/cross-156772.svg" alt="关闭" class="cuphead-close-svg" width="32" height="32" />
          </button>
        </div>
      </template>
      <!-- 好友主页弹窗内容部分 -->
      <div class="cuphead-content-bg" v-if="selectedFriend">
        <div class="cuphead-avatar-area">
          <div class="avatar-frame">
            <el-avatar :size="120" :src="selectedFriend.avatar || defaultAvatar" class="avatar-img" />
            <div class="avatar-glow"></div>
          </div>
          <div class="user-name">{{ selectedFriend.username }}</div>
        </div>
        <div class="cuphead-divider"></div>
        <div class="cuphead-section">
          <div class="section-title">TA的游戏标签</div>
          <div class="tag-list">
            <template v-if="selectedFriend.gameTags && selectedFriend.gameTags.length > 0">
              <template v-for="tag in getMergedTags(selectedFriend.gameTags)" :key="tag.id">
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
              <div class="match-levels-container" v-if="getMatchedTags(selectedFriend.gameTags).length > 0">
                <div class="match-levels-title">匹配等级</div>
                <div class="match-level-tags">
                  <div 
                    v-for="match in getMatchedTags(selectedFriend.gameTags)" 
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
            <div v-else class="empty-tags-message">该好友暂未添加游戏标签</div>
          </div>
        </div>
        <div class="cuphead-divider"></div>
        <div class="cuphead-section">
          <el-button
            type="primary"
            class="cuphead-btn cuphead-game-btn-2d"
            @click="handleFriendClick(selectedFriend); showFriendProfile = false;"
          >发送消息</el-button>
        </div>
      </div>
    </el-dialog>

    <!-- 头像大图预览弹窗 -->
    <el-dialog
      v-model="showAvatarModal"
      title="头像预览"
      width="400px"
      :show-close="true"
      class="avatar-preview-dialog"
    >
      <img :src="avatarModalUrl" alt="头像大图" class="avatar-preview-img" />
    </el-dialog>
  </div>
  <div class="friend-list-hover-area" @mouseenter="handleFriendListEnter"></div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, defineExpose, nextTick, onUnmounted } from 'vue'
import axios from 'axios'
import { useSocket } from '@/utils/usesocket'  // 请确保此模块已创建
import { getGameNameById } from '../userinformation/games.js'

// 修改：默认头像使用本地 public 目录下的 blank-avatar.png
const defaultAvatar = '/blank-avatar.png';
const showFriendList = ref(false);
const friends = ref([]);
const loadingFriends = ref(false);
const user = ref(JSON.parse(localStorage.getItem('user') || '{}'));
const emit = defineEmits(['open-chat']);
const unreadMap = ref({});
const friendRequests = ref([]);
const friendItemRefs = ref([]);
const backendOrigin = 'https://kexiaohua.online'; // 后端部署域名

// 新增：好友资料相关变量
const showFriendProfile = ref(false);
const selectedFriend = ref(null);
const tagColors = ['#222', '#67c23a', '#409eff', '#a259e6', '#f56c6c']; // 标签颜色映射

// 工具函数：补全头像URL为后端绝对路径
function fixAvatarUrl(avatar) {
  if (!avatar) return defaultAvatar;
  if (avatar.startsWith('http://') || avatar.startsWith('https://')) return avatar;
  if (avatar.startsWith('/avatars/')) return backendOrigin + avatar;
  return avatar;
}

// 原有的请求函数保持不变
const fetchFriends = async () => {
  loadingFriends.value = true;
  try {
    const res = await axios.get('/api/user-friends', {
      params: { username: user.value.username }
    });
    const friendNames = (res.data || []).map(f => typeof f === 'string' ? f : (f.username || f));
    if (friendNames.length === 0) {
      friends.value = [];
    } else {
      const res2 = await axios.post('/api/user-info-batch', {
        usernames: friendNames
      });
      // 修正：补全头像URL为后端绝对路径（优先缩略图）
      friends.value = (res2.data || []).map(u => ({
        username: u.username,
        avatar: fixAvatarUrl(u.avatar)
      }));
    }
  } finally {
    loadingFriends.value = false;
  }
};

const fetchUnread = async () => {
  const res = await axios.get('/api/unread-messages', {
    params: { username: user.value.username }
  });
  unreadMap.value = res.data || {};
};

const fetchFriendRequests = async () => {
  const res = await axios.get('/api/received-friend-requests', {
    params: { username: user.value.username }
  });
  // 修正：补全头像URL为后端绝对路径
  friendRequests.value = (res.data || []).map(req => ({
    ...req,
    avatar: fixAvatarUrl(req.avatar)
  }));
};

const handleRequest = async (from, accept) => {
  await axios.post('/api/handle-friend-request', {
    username: user.value.username,
    from,
    accept
  });
  await fetchFriends();
  await fetchFriendRequests();
  window.refreshPendingRequests && window.refreshPendingRequests();
  // 新增：操作后清除好友列表变化未读
  await clearFriendListEvents();
};

const sendFriendRequest = async (toUsername) => {
  if (!user.value.username || !toUsername) return;
  try {
    const res = await axios.post('/api/friend-request', {
      from: user.value.username,
      to: toUsername
    });
    window.ElMessage && window.ElMessage.success('好友请求已发送');
    window.refreshPendingRequests && window.refreshPendingRequests();
    // 新增：操作后清除好友列表变化未读
    await clearFriendListEvents();
  } catch (err) {
    window.ElMessage && window.ElMessage.error('发送好友请求失败');
  }
};

const handleFriendListEnter = () => {
  showFriendList.value = true;
  if (friends.value.length === 0 && user.value.username) {
    fetchFriends();
  }
};

const handleFriendListLeave = () => {
  // 只有未锁定时才允许关闭好友列表
  if (!contextMenuLock.value) {
    showFriendList.value = false;
  }
};

const handleFriendClick = (f) => {
  if (window.openGlobalChatDialog) {
    window.openGlobalChatDialog(f);
  } else {
    emit('open-chat', f);
  }
  unreadMap.value[f.username] = 0;
  
  // 新增：点击好友打开聊天窗口时自动关闭好友列表
  showFriendList.value = false;
};

// 新增：添加好友弹窗相关
const showAddFriendDialog = ref(false)
const searchName = ref('')
const searchResult = ref(null)
const pendingFriendRequests = ref([]) // 用于判断是否已发送请求

// 判断是否已是好友
function isFriend(username) {
  return friends.value.some(f => (typeof f === 'string' ? f : f.username) === username)
}
// 判断是否已发送请求
function isPending(username) {
  return pendingFriendRequests.value.includes(username)
}

// 搜索用户
const searchUser = async () => {
  searchResult.value = null
  if (!searchName.value) return
  // 查询后端数据库
  const res = await axios.post('/api/user-info-batch', { usernames: [searchName.value] })
  if (Array.isArray(res.data) && res.data.length > 0) {
    // 修正：补全头像URL为后端绝对路径
    const userObj = res.data[0]
    userObj.avatar = fixAvatarUrl(userObj.avatar)
    searchResult.value = userObj
  } else {
    searchResult.value = {}
  }
}

// 添加好友（通过搜索结果）
const addFriendBySearch = async (toUsername) => {
  if (!user.value.username || !toUsername) return
  await sendFriendRequest(toUsername)
  pendingFriendRequests.value.push(toUsername)
}

// 获取自己发出的未处理好友请求
const fetchPendingFriendRequests = async () => {
  if (!user.value.username) return
  const res = await axios.get('/api/pending-friend-requests', {
    params: { username: user.value.username }
  })
  pendingFriendRequests.value = res.data || []
}

// 右键菜单状态
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  friend: null,
  virtualRef: null
});

// 锁定好友列表弹窗
const contextMenuLock = ref(false);

// 右键事件
function onFriendContextMenu(e, friend) {
  // 锁定好友列表弹窗
  contextMenuLock.value = true;
  contextMenu.value.visible = false;
  contextMenu.value.friend = null;
  contextMenu.value.virtualRef = null;
  nextTick(() => {
    contextMenu.value.friend = friend;
    contextMenu.value.virtualRef = {
      getBoundingClientRect: () => ({
        width: 0,
        height: 0,
        top: e.clientY,
        left: e.clientX,
        right: e.clientX,
        bottom: e.clientY
      }),
      clientWidth: 0,
      clientHeight: 0
    };
    nextTick(() => {
      contextMenu.value.visible = true;
      // 添加全局点击监听，点击空白处关闭菜单
      document.addEventListener('mousedown', onGlobalClick, true);
    });
  });
}

// 关闭右键菜单
function closeContextMenu() {
  contextMenu.value.visible = false;
  contextMenu.value.friend = null;
  contextMenu.value.virtualRef = null;
  // 解除锁定
  contextMenuLock.value = false;
  document.removeEventListener('mousedown', onGlobalClick, true);
}

// 右键菜单关闭后回调
function onContextMenuAfterLeave() {
  // 解除锁定
  contextMenuLock.value = false;
  document.removeEventListener('mousedown', onGlobalClick, true);
}

// 全局点击关闭右键菜单（只要不是在菜单内点击）
function onGlobalClick(e) {
  // 判断点击是否在弹窗内
  const popover = document.querySelector('.friend-context-popover');
  if (popover && popover.contains(e.target)) return;
  closeContextMenu();
}

// 清空聊天记录
async function clearChatHistory(friend) {
  contextMenu.value.visible = false;
  contextMenuLock.value = false;
  document.removeEventListener('mousedown', onGlobalClick, true);
  if (!user.value.username || !friend?.username) return;
  await axios.post('/api/clear-chat-history', {
    user1: user.value.username,
    user2: friend.username
  });
  window.ElMessage && window.ElMessage.success('聊天记录已清空');
}

// 删除好友
async function deleteFriend(friend) {
  contextMenu.value.visible = false;
  contextMenuLock.value = false;
  document.removeEventListener('mousedown', onGlobalClick, true);
  if (!user.value.username || !friend?.username) return;
  await axios.post('/api/delete-friend', {
    user1: user.value.username,
    user2: friend.username
  });
  window.ElMessage && window.ElMessage.success('好友已删除');
  await fetchFriends();
  if (window.friendMenuRef?.value?.fetchFriends) {
    window.friendMenuRef.value.fetchFriends();
  }
  // 新增：操作后清除好友列表变化未读
  await clearFriendListEvents();
}

// 新增：清除好友列表变化未读
async function clearFriendListEvents() {
  if (!user.value.username) return;
  await axios.post('/api/friend-list-events/read', { username: user.value.username });
}

// 组件卸载时移除全局事件监听
onUnmounted(() => {
  document.removeEventListener('mousedown', onGlobalClick, true);
});

onMounted(async () => {
  // 初次加载数据
  await fetchFriends();
  await fetchUnread();
  await fetchFriendRequests();
  await fetchPendingFriendRequests()

  // 不再使用轮询（已删除如下代码）：
  // unreadTimer = setInterval(fetchUnread, 1000)
  // friendReqTimer = setInterval(fetchFriendRequests, 1000)

  // 初始化 WebSocket 连接，并加入房间
  const { socket, joinRoom } = useSocket();
  if (user.value.username) {
    joinRoom(user.value.username);
  }

  // 实时监听未读消息变化，及时刷新红点
  socket.value.on('unread-updated', (data) => {
    unreadMap.value = data || {};
  });

  // 实时监听好友请求变化，及时刷新好友请求和红点
  socket.value.on('pending-requests-updated', () => {
    fetchFriendRequests();
  });

  // 实时监听好友列表变化，及时刷新好友列表
  socket.value.on('friend-list-updated', () => {
    fetchFriends();
  });

  // 新增：监听收到新聊天消息时刷新未读
  socket.value.on('chat-message', (msg) => {
    // 只处理发给自己的消息
    if (msg && msg.to === user.value.username) {
      fetchUnread();
    }
  });

  // 新增：监听被删除好友通知
  socket.value.on('friend-removed-notice', (data) => {
    window.ElMessage && window.ElMessage.warning(`你已被 ${data.from} 移除好友`);
    fetchFriends();
  });
  
  // 新增：添加点击外部关闭功能
  document.addEventListener('click', handleDocumentClick);
  
  // 新增：设置地图事件监听，在地图操作时关闭好友列表
  setupMapEventListeners();
});

onBeforeUnmount(() => {
  // 如果你的全局 socket 在整个 App 生命周期都需要，无须在此断开连接，
  // 如果需要局部断开，可以解除事件监听:
  // socket.value.off('unread-updated');
  // socket.value.off('new-friend-request');
  // socket.value.off('friend-list-updated');
  
  // 新增：移除点击外部关闭功能监听器
  document.removeEventListener('click', handleDocumentClick);
  
  // 新增：移除地图事件监听器
  if (window.map) {
    ['movestart', 'zoomstart', 'dragstart', 'pinchstart'].forEach(eventName => {
      window.map.un(eventName, handleMapEvent);
    });
  }
});

// 新增：处理文档点击事件，当点击好友列表外部时关闭列表
function handleDocumentClick(e) {
  // 如果好友列表未显示，无需处理
  if (!showFriendList.value) return;
  
  // 检查点击是否在好友列表或其触发区域内
  const friendList = document.querySelector('.friend-list-sidebar');
  const hoverArea = document.querySelector('.friend-list-hover-area');
  const friendTipBtn = document.querySelector('.friend-tip-btn, .friend-tip-svg-abs');
  
  if (friendList && !friendList.contains(e.target) && 
      (!hoverArea || !hoverArea.contains(e.target)) &&
      (!friendTipBtn || !friendTipBtn.contains(e.target))) {
    // 只有未锁定时才允许关闭好友列表
    if (!contextMenuLock.value) {
      showFriendList.value = false;
    }
  }
}

// 新增：设置地图事件监听
function setupMapEventListeners() {
  if (!window.map) return;
  
  // 定义处理地图事件的函数
  window.handleMapEvent = function() {
    // 只有未锁定时才允许关闭好友列表
    if (showFriendList.value && !contextMenuLock.value) {
      showFriendList.value = false;
    }
  };
  
  // 为地图添加移动、缩放、拖拽和捏合事件监听
  ['movestart', 'zoomstart', 'dragstart', 'pinchstart'].forEach(eventName => {
    window.map.on(eventName, window.handleMapEvent);
  });
}

// 新增：合并标签逻辑（同一个标签出现多次，显示为一个标签，颜色随次数变化）
const getMergedTags = (tags) => {
  if (!Array.isArray(tags)) return [];
  const stats = {};
  tags.forEach(id => {
    stats[id] = (stats[id] || 0) + 1;
  });
  return Object.entries(stats).map(([id, count]) => ({
    id: Number(id),
    count,
    color: tagColors[Math.min(count - 1, tagColors.length - 1)]
  }));
};

// 新增：获取当前用户的游戏标签
const myGameTags = ref([]);

// 计算相同标签并生成匹配信息的函数
const getMatchedTags = (otherTags) => {
  if (!user.value || !user.value.username) return [];
  if (!otherTags) return [];
  
  // 如果是查看自己的信息，不计算匹配
  if (selectedFriend.value && user.value.username === selectedFriend.value.username) {
    return [];
  }
  
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

// 根据匹配等级返回匹配文字颜色
const getMatchLevelColor = (level) => {
  const colors = ['#67c23a', '#409eff', '#a259e6', '#ff9500', '#f56c6c'];
  return colors[Math.min(level - 1, 4)] || '';
};

// 检查标签是否匹配
const isTagMatched = (tagId) => {
  return getMatchedTags(selectedFriend.value?.gameTags || []).some(match => match.id === tagId);
};

// 获取匹配标签的光晕颜色
const getMatchTagColor = (tagId) => {
  const match = getMatchedTags(selectedFriend.value?.gameTags || []).find(m => m.id === tagId);
  if (!match) return '';
  return getMatchLevelColor(match.matchLevel);
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

// 新增：查看好友主页方法
const viewFriendProfile = async (friend) => {
  // 如果是通过右键菜单调用，需要关闭右键菜单
  if (contextMenu.value.visible) {
    closeContextMenu();
  }
  
  // 获取好友详细信息
  try {
    // 如果已经有完整的好友信息（包含gameTags），则直接使用
    if (friend.gameTags) {
      selectedFriend.value = friend;
      showFriendProfile.value = true;
      return;
    }
    
    const res = await axios.post('/api/user-info-batch', {
      usernames: [friend.username]
    });
    
    if (Array.isArray(res.data) && res.data.length > 0) {
      selectedFriend.value = {
        ...friend,
        gameTags: res.data[0].gameTags || []
      };
      showFriendProfile.value = true;
    } else {
      window.ElMessage && window.ElMessage.error('获取好友信息失败');
    }
  } catch (err) {
    console.error('获取好友信息失败', err);
    window.ElMessage && window.ElMessage.error('获取好友信息失败');
  }
};

// 新增：关闭好友主页弹窗
const handleFriendProfileClose = () => {
  showFriendProfile.value = false;
  selectedFriend.value = null;
};

// 新增：头像大图预览相关
const showAvatarModal = ref(false); // 控制头像大图弹窗的显示状态
const avatarModalUrl = ref(''); // 存储当前显示的大图 URL

// 打开头像大图弹窗
const openAvatarModal = (url) => {
  avatarModalUrl.value = url || defaultAvatar;
  showAvatarModal.value = true;
};

// 关闭头像大图弹窗
const closeAvatarModal = () => {
  showAvatarModal.value = false;
};

// 暴露部分方法给父组件使用
defineExpose({
  sendFriendRequest,
  fetchFriends,
  showFriendList,
  viewFriendProfile,  // 添加这个方法到暴露的接口中
  friends             // 暴露好友列表，方便直接访问
});
</script>

<style scoped>
@font-face {
  font-family: 'JiangxiZhuokai';
  src: url('/fonts/jiangxi-zhoukai/jiangxizhuokai-Regular.woff2') format('woff2'),
       url('/fonts/jiangxi-zhoukai/jiangxizhuokai-Regular.woff') format('woff');
  font-display: swap;
}

/* 好友列表整体风格，普通边框 */
.friend-list-sidebar {
  position: fixed;
  top: 0;
  left: -240px;
  width: 240px;
  height: 100vh;
  background: url('/friendlistbackground.jpg') center center/cover no-repeat;
  box-shadow: none;
  border: 2px solid #a67c52;
  z-index: 5000;
  transition: left 0.25s cubic-bezier(.4,0,.2,1);
  display: flex;
  flex-direction: column;
  pointer-events: auto;
  filter: contrast(1.05) brightness(1.03);
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
}
.friend-list-sidebar.show {
  left: 0;
}

/* 标题分割线：柔和弯曲效果 */
.friend-list-title {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 22px;
  font-weight: bold;
  padding: 24px 0 12px 32px;
  background: transparent;
  color: #7c4a1e;
  letter-spacing: 2px;
  text-shadow: 2px 2px 0 #f5e1a4, 0 2px 8px #a67c52;
  border-bottom: 0;
  position: relative;
}
.friend-list-title::after {
  content: "";
  display: block;
  width: 85%;
  height: 0;
  margin: 12px auto 0 auto;
  border-bottom: 2px solid #e7cfa2;
  border-radius: 0 0 16px 16px;
  box-shadow: 0 2px 8px rgba(166,124,82,0.08);
  opacity: 0.7;
}

/* 好友项分割线：手绘感，略带弯曲 */
.friend-list-item {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 18px;
  color: #7c4a1e;
  background: transparent;
  padding: 16px 24px;
  border-bottom: 0;
  position: relative;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
  display: flex;
  align-items: center;
  flex-direction: row;
  min-width: 0; /* 允许子项收缩 */
  width: 100%;  /* 保证横向填满 */
}

/* 修正分割线位置，避免覆盖头像和文字 */
.friend-list-item:not(:last-child)::after {
  content: "";
  position: absolute;
  left: 24px; /* 与头像左边距一致 */
  right: 24px; /* 与右边距一致 */
  bottom: 0;
  height: 0;
  border-bottom: 2px solid #e7cfa2;
  border-radius: 0 0 12px 12px;
  box-shadow: 0 1px 6px rgba(166,124,82,0.06);
  opacity: 0.6;
  margin: 0; /* 去掉 margin-top */
  z-index: 1;
}

/* 鼠标悬停时变深色，字体变浅色，头像高亮 */
.friend-list-item:hover {
  background: #a67c52;
  color: #fff;
  transition: background 0.2s, color 0.2s;
}
.friend-list-item:hover .friend-list-name {
  color: #fff;
  text-shadow: none;
}
.friend-list-item:hover .el-avatar {
  box-shadow: 0 0 8px #fff, 0 2px 8px rgba(0,0,0,0.10);
  border: 2px solid #fff;
}

/* 好友名称与头像垂直居中对齐 */
.friend-list-name {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 18px;
  color: #7c4a1e;
  margin-left: 12px;
  margin-top: 0;
  line-height: 36px;
  /* 修正：保证名称横向显示，不换行 */
  flex: 1 1 0;
  min-width: 0;
  max-width: 140px; /* 可根据实际调整 */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  /* 删除 word-break: break-all; */
  text-shadow: 1px 1px 0 #f5e1a4;
}
.friend-unread-dot {
  display: inline-block;
  width: 13px;
  height: 13px;
  background: #a67c52;
  border-radius: 50%;
  margin-left: 8px;
  margin-top: 2px;
  border: 2px solid #f5e1a4;
  box-shadow: 0 0 4px #a67c52;
  flex-shrink: 0; /* 防止挤压名称 */
}
.add-friend-btn {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  background: #f5e1a4;
  color: #7c4a1e;
  border: 2px solid #a67c52;
  border-radius: 12px;
  box-shadow: 2px 2px 0 #a67c52;
  font-size: 22px;
  padding: 0 8px;
  min-width: 32px;
  min-height: 32px;
  transition: background 0.2s;
}
.add-friend-btn:hover {
  background: #a67c52;
  color: #f5e1a4;
}
.friend-request-item {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  background: rgba(253, 246, 227, 0.8);
  border-left: 6px solid #a67c52;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  border-radius: 12px;
  margin: 8px 0;
  transition: background 0.2s, transform 0.2s;
}
.friend-request-item:hover {
  background: rgba(166, 124, 82, 0.1);
  transform: translateY(-2px);
}
.friend-request-info {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.friend-request-actions-vertical {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-left: 12px; /* 增加左边距，将按钮组向右移动 */
  width: 54px; /* 固定宽度 */
  align-items: center; /* 确保按钮在容器中居中对齐 */
}

.action-btn {
  padding: 2px !important;
  height: 28px !important; /* 固定高度 */
  min-height: 28px !important;
  width: 100% !important; /* 使用100%宽度填充父容器 */
  border-radius: 8px !important; /* 长方形圆角 */
  font-size: 13px !important;
  font-weight: bold !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  justify-content: center;
  align-items: center;
  border: 2px solid #fff;
  line-height: 1;
  letter-spacing: 1px;
}
.action-accept {
  background: #67c23a !important;
  border-color: #529b2e !important;
}
.action-accept:hover {
  background: #529b2e !important;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}
.action-reject {
  background: #f56c6c !important;
  border-color: #e64242 !important;
}
.action-reject:hover {
  background: #e64242 !important;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

/* 茶杯头风格：整体弹窗 */
.cuphead-dialog {
  /* 背景渐变 */
  background: linear-gradient(135deg, #f5f0e1 0%, #e8d1a0 100%);
  /* 边框阴影 */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  /* 圆角 */
  border-radius: 16px;
  overflow: hidden;
}

/* 茶杯头风格：头部 */
.cuphead-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: linear-gradient(90deg, #fffbe6 0%, #f5e1a4 100%);
  border-bottom: 2px solid #a67c52;
  border-radius: 24px 24px 0 0;
}

/* 茶杯头风格：标题文本 */
.cuphead-title-text {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 24px;
  font-weight: bold;
  color: #7c4a1e;
  text-shadow: 1px 1px 0 #f5e1a4, 0 2px 4px rgba(166, 124, 82, 0.4);
}

/* 茶杯头风格：关闭按钮 */
.cuphead-close-btn {
  background: #fffbe6;
  border: 2px solid #a67c52;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  padding: 0;
}

.cuphead-close-btn:hover {
  background: #ffeba0;
  transform: scale(1.1);
}

/* 茶杯头风格：内容区域 */
.cuphead-dialog-content {
  background: #f5e1a4;
  padding: 24px;
  border-radius: 0 0 24px 24px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* 茶杯头风格：搜索容器 */
.cuphead-search-container {
  display: flex;
  margin-bottom: 20px;
  gap: 12px;
}

/* 茶杯头风格：搜索输入框 */
.cuphead-search-input {
  flex: 1;
}

:deep(.cuphead-search-input .el-input__wrapper) {
  background: rgba(255, 255, 255, 0.8);
  border: 2px solid #a67c52;
  border-radius: 12px;
  box-shadow: none !important;
}

:deep(.cuphead-search-input .el-input__inner) {
  color: #7c4a1e;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 16px;
}

/* 茶杯头风格：搜索按钮 */
.cuphead-search-btn {
  background: #fffbe6;
  color: #7c4a1e;
  border: 2px solid #a67c52;
  border-radius: 12px;
  font-weight: bold;
  padding: 0 16px;
  font-size: 16px;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 0 #a67c52;
}

.cuphead-search-btn:hover {
  background: #ffeba0;
  transform: translateY(-2px);
  box-shadow: 0 4px 0 #a67c52;
}

.cuphead-search-btn:active {
  transform: translateY(0);
  box-shadow: 0 0 0 #a67c52;
}

.cuphead-search-result {
  background: rgba(255, 255, 255, 0.5);
  border: 2px solid #a67c52;
  border-radius: 16px;
  padding: 16px;
  min-height: 120px;
}

.cuphead-user-card {
  display: flex;
  align-items: center;
  gap: 20px;
}

.cuphead-avatar-container {
  position: relative;
}

.cuphead-avatar {
  border: 3px solid #a67c52;
  box-shadow: 0 0 0 2px #fffbe6, 0 2px 8px rgba(0, 0, 0, 0.1);
}

.cuphead-user-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cuphead-username {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 20px;
  font-weight: bold;
  color: #7c4a1e;
  text-shadow: 1px 1px 0 #fffbe6;
}

/* 茶杯头风格：添加按钮 */
.cuphead-add-btn {
  background: #fffbe6;
  color: #7c4a1e;
  border: 2px solid #a67c52;
  border-radius: 12px;
  font-weight: bold;
  box-shadow: 0 4px 0 #a67c52, 0 6px 8px rgba(0,0,0,0.15);
  padding: 8px 16px;
  font-size: 16px;
  align-self: flex-start;
  cursor: pointer;
  transition: all 0.2s;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
}

.cuphead-add-btn:hover:not(:disabled) {
  background: #ffeba0;
  transform: translateY(-2px);
  box-shadow: 0 6px 0 #a67c52, 0 8px 16px rgba(0,0,0,0.15);
}

.cuphead-add-btn:active:not(:disabled) {
  transform: translateY(2px);
  box-shadow: 0 2px 0 #a67c52;
}

.cuphead-add-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 茶杯头风格：无结果提示 */
.cuphead-no-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 120px;
}

.cuphead-no-result-icon {
  font-size: 32px;
  color: #a67c52;
}

.cuphead-no-result-text {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 18px;
  color: #7c4a1e;
}

/* 茶杯头风格弹窗 */
:deep(.cuphead-dialog) {
  background: transparent !important;
  border-radius: 24px;
  box-shadow: none !important;
  overflow: visible;
}

:deep(.cuphead-dialog .el-dialog__header) {
  padding: 0 !important;
  margin: 0 !important;
  background: transparent !important;
}

:deep(.cuphead-dialog .el-dialog__body) {
  padding: 0 !important;
  background: transparent !important;
}

:deep(.cuphead-dialog .el-dialog) {
  background-color: transparent !important;
  border: none !important;
  box-shadow: none !important;
  margin: 0 !important;
  padding: 0 !important;
}

/* 重要：修复对话框背景透明问题 */
:deep(.add-friend-dialog-center .el-overlay-dialog) {
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.add-friend-dialog-center .el-dialog) {
  margin: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

/* 弹窗内容区域 - 保持阴影与边框 */
.cuphead-header-bar {
  background: linear-gradient(90deg, #fffbe6 0%, #f5e1a4 100%);
  border: 2px solid #a67c52;
  border-bottom-width: 0;
  border-radius: 24px 24px 0 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
.cuphead-dialog-content {
  background: #f5e1a4;
  border: 2px solid #a67c52;
  border-top-width: 0;
  border-radius: 0 0 24px 24px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

/* 右键菜单样式 - 新增茶杯头风格 */
.friend-context-popover {
  min-width: 160px;
  background: linear-gradient(135deg, #fffbe6 0%, #f5e1a4 100%);
  border: 2px solid #a67c52;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15), 0 0 0 2px rgba(255, 255, 255, 0.5) inset;
  overflow: hidden;
  padding: 8px 0;
  z-index: 6000;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
}

.context-menu-list {
  display: flex;
  flex-direction: column;
  width: 100%;
}

.context-menu-item {
  padding: 10px 16px;
  font-size: 16px;
  color: #7c4a1e;
  cursor: pointer;
  transition: all 0.2s;
  font-weight: bold;
  text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.5);
  position: relative;
  text-align: center;
}

.context-menu-item:hover {
  background: rgba(166, 124, 82, 0.2);
  transform: translateY(-1px);
}

.context-menu-item:active {
  transform: translateY(1px);
}

.context-menu-item::after {
  content: "";
  position: absolute;
  left: 10%;
  right: 10%;
  bottom: 0;
  height: 1px;
  background: rgba(166, 124, 82, 0.3);
  border-radius: 50%;
}

.context-menu-item:last-child::after {
  display: none;
}

.context-menu-item-danger {
  color: #e64242;
  text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.7);
}

.context-menu-item-danger:hover {
  background: rgba(245, 108, 108, 0.1);
}

.context-menu-item-cancel {
  font-weight: normal;
  color: #606266;
}

.context-menu-item-cancel:hover {
  background: rgba(0, 0, 0, 0.05);
}

/* 查看好友主页选项特殊样式 */
.context-menu-item-profile {
  color: #409eff;
  text-shadow: 1px 1px 0 rgba(255, 255, 255, 0.7);
}

.context-menu-item-profile:hover {
  background: rgba(64, 158, 255, 0.1);
}

/* 好友主页弹窗样式 */
.cuphead-avatar-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 12px;
}

.avatar-frame {
  position: relative;
  width: 140px;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-img {
  box-shadow: 0 0 24px #f5b507, 0 2px 8px rgba(0,0,0,0.10);
  border: 4px solid #f5b507;
  border-radius: 50%;
  background: #fff;
}

.avatar-glow {
  position: absolute;
  left: 0; top: 0;
  width: 140px; height: 140px;
  border-radius: 50%;
  box-shadow: 0 0 32px 12px #f5b507, 0 0 0 8px #fff inset;
  pointer-events: none;
  z-index: 1;
}

.user-name {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 28px;
  font-weight: bold;
  color: #a67c52;
  margin-top: 10px;
  text-shadow: 2px 2px 0 #f5e1a4, 0 2px 8px #a67c52;
}

.cuphead-divider {
  width: 80%;
  height: 0;
  border-bottom: 2px dashed #e7cfa2;
  margin: 18px 0;
  opacity: 0.7;
}

.section-title {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 22px;
  font-weight: bold;
  color: #7c4a1e;
  margin-bottom: 10px;
  text-shadow: 1px 1px 0 #f5e1a4;
  letter-spacing: 2px;
  text-align: center;
}

.tag-list {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

.cuphead-tag {
  border-radius: 16px !important;
  box-shadow: 0 2px 8px rgba(166,124,82,0.10);
  font-size: 18px !important;
  padding: 6px 18px !important;
  font-family: 'JiangxiZhuokai', cursive, sans-serif !important;
  border: none !important;
  font-weight: bold !important;
  transition: background 0.2s, box-shadow 0.2s;
}

.empty-tags-message {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 18px;
  color: #a67c52;
  text-align: center;
  margin: 10px 0;
  font-style: italic;
  opacity: 0.8;
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

/* 头像大图预览弹窗样式 */
.avatar-preview-dialog {
  text-align: center;
}

.avatar-preview-img {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}
</style>

<!-- 全局样式覆盖 - 确保所有 .cuphead-dialog 样式都被覆盖 -->
<style>
/* 好友主页弹窗样式覆盖 */
.user-info-cuphead-bg {
  background: linear-gradient(135deg, #e0bf18 0%, #f3b90a 100%);
  border-radius: 40px;
  min-width: 440px;
  min-height: 540px;
  max-width: 620px;
  max-height: 720px;
  aspect-ratio: 1/1.2;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    0 12px 48px rgba(80,60,30,0.18),
    0 0 0 16px #c7a16b inset,
    0 0 0 3px #7c4a1e;
  position: relative;
  overflow: hidden;
}

.cuphead-content-bg {
  background: linear-gradient(135deg, #fffbe6 0%, #f5e1a4 100%);
  border-radius: 32px;
  box-shadow: 0 4px 24px rgba(166,124,82,0.08);
  padding: 32px 0 24px 0;
  margin: 0 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}
</style>

