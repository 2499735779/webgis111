<script setup>
import { ref, onMounted, nextTick, watch, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { useSocket } from '@/utils/usesocket'  // 请确保该模块路径正确

// 获取登录用户信息
const user = ref(JSON.parse(localStorage.getItem('user') || '{}'))
const friends = ref([])
const selectedFriend = ref(null)
const messages = ref([])            // 当前会话消息
const inputMsg = ref('')
const unreadMap = ref({})           // 各个好友的未读消息数

// 用于聊天列表滚动到底部
const chatListRef = ref(null)
const scrollToBottom = () => {
  if (chatListRef.value) {
    chatListRef.value.scrollTop = chatListRef.value.scrollHeight
    console.debug('[DEBUG] scrollToBottom')
  }
}

// ---------------------------
// 数据获取函数（保持不变）
// ---------------------------

// 获取好友列表（如有需要，可在其它地方调用）
const fetchFriends = async () => {
  const res = await axios.get('/api/user-friends', {
    params: { username: user.value.username }
  })
  friends.value = res.data || []
  console.debug('[DEBUG] fetchFriends:', friends.value)
}

// 获取与某好友的消息
const fetchMessages = async (friendName) => {
  console.debug('[DEBUG] fetchMessages for:', friendName)
  const res = await axios.get('/api/messages', {
    params: { user1: user.value.username, user2: friendName }
  })
  messages.value = res.data || []
  // 清零当前会话的未读消息数
  unreadMap.value[friendName] = 0
  await nextTick()
  scrollToBottom()
  console.debug('[DEBUG] messages loaded:', messages.value)
}

// 发送消息（发送后调用 fetchMessages 刷新当前会话）
const sendMessage = async () => {
  if (!inputMsg.value.trim() || !selectedFriend.value) return
  console.debug('[DEBUG] sendMessage:', inputMsg.value)
  await axios.post('/api/messages', {
    from: user.value.username,
    to: selectedFriend.value,
    content: inputMsg.value.trim()
  })
  inputMsg.value = ''
  // 这里调用 fetchMessages 以防万一，通常服务器推送会自动刷新
  await fetchMessages(selectedFriend.value)
}

// 获取未读消息数
const fetchUnread = async () => {
  const res = await axios.get('/api/unread-messages', {
    params: { username: user.value.username }
  })
  unreadMap.value = res.data || {}
  console.debug('[DEBUG] fetchUnread:', unreadMap.value)
  // 如果当前已选择好友，主动刷新聊天记录
  if (selectedFriend.value) {
    await fetchMessages(selectedFriend.value)
  }
}

// 处理好友请求（与消息模块通常无直接关系，可在其它文件维护）
const handleRequest = async (msg, accept) => {
  console.debug('[DEBUG] handleRequest:', msg, accept)
  await axios.post('/api/handle-friend-request', {
    username: user.value.username,
    from: msg.from,
    accept
  })
  await fetchFriends()
  await fetchMessages(selectedFriend.value)
}

// ---------------------------
// 使用 Socket 推送更新（取消轮询部分）
// ---------------------------
let socket = null

onMounted(async () => {
  // 初次加载数据
  await fetchFriends()
  await fetchUnread()
  
  // 初始化 socket 连接，并加入用户对应的房间
  const socketData = useSocket()
  socket = socketData.socket
  if (user.value.username) {
    socketData.joinRoom(user.value.username)
  }
  
  // 监听服务器推送的未读消息更新事件
  socket.value.on('unread-updated', async (data) => {
    console.debug('[DEBUG] received unread-updated event:', data)
    // 此处直接重新拉取最新未读数据
    await fetchUnread()
  })
  
  // 监听服务器推送的新消息（改为使用 "chat-message" 事件）
  socket.value.on('chat-message', async (msg) => {
    console.debug('[DEBUG] received chat-message event:', msg)
    // 若当前会话与该消息对应，则刷新会话内容
    if (selectedFriend.value && msg.from === selectedFriend.value) {
      await fetchMessages(selectedFriend.value)
    }
  })
})

// 当选择不同好友时，刷新当前会话消息记录
watch(selectedFriend, async (v) => {
  if (v) {
    await fetchMessages(v)
  }
})

// 页面卸载时解绑 socket 事件监听
onBeforeUnmount(() => {
  if (socket && socket.value) {
    socket.value.off('unread-updated')
    socket.value.off('chat-message')
  }
})

// 选择好友函数
const selectFriend = async (f) => {
  selectedFriend.value = typeof f === 'string' ? f : (f.username || f)
  console.debug('[DEBUG] selectFriend:', selectedFriend.value)
  await fetchMessages(selectedFriend.value)
}
</script>

<template>
  <div class="msg-root">
    <div class="msg-friend-list">
      <div class="msg-friend-title">好友</div>
      <div
        v-for="f in friends"
        :key="typeof f === 'string' ? f : f.username"
        :class="['msg-friend-item', { active: selectedFriend === (typeof f === 'string' ? f : f.username) }]"
        @click="selectFriend(typeof f === 'string' ? f : f.username)"
      >
        <span>{{ typeof f === 'string' ? f : f.username }}</span>
        <span v-if="unreadMap[typeof f === 'string' ? f : f.username] > 0" class="msg-unread">
          {{ unreadMap[typeof f === 'string' ? f : f.username] }}
        </span>
      </div>
    </div>
    <div class="msg-chat-panel" v-if="selectedFriend">
      <div class="msg-chat-title">
        <span>与 {{ selectedFriend }} 的聊天</span>
      </div>
      <div class="msg-chat-list" ref="chatListRef">
        <div
          v-for="msg in messages"
          :key="msg._id"
          :class="['msg-item', { self: msg.from === user.username }]"
        >
          <span class="msg-user">{{ msg.from }}</span>
          <span class="msg-content" v-if="msg.type !== 'friend-request'">{{ msg.content }}</span>
          <template v-else>
            <span class="msg-content">[好友请求] {{ msg.from }} 请求加你为好友</span>
            <el-button size="small" type="success" @click="handleRequest(msg, true)">同意</el-button>
            <el-button size="small" type="danger" @click="handleRequest(msg, false)">拒绝</el-button>
          </template>
        </div>
      </div>
      <div class="msg-chat-input">
        <el-input
          v-model="inputMsg"
          placeholder="输入消息，回车发送"
          @keyup.enter="sendMessage"
        />
        <el-button type="primary" @click="sendMessage">发送</el-button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.msg-root {
  display: flex;
  height: 100vh;
  background: #f8f8f8;
}
.msg-friend-list {
  width: 180px;
  background: #fff;
  border-right: 1px solid #eee;
  padding: 0;
  display: flex;
  flex-direction: column;
}
.msg-friend-title {
  font-weight: bold;
  padding: 16px 0 8px 18px;
  border-bottom: 1px solid #eee;
}
.msg-friend-item {
  padding: 12px 18px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;
}
.msg-friend-item.active {
  background: #e6f7ff;
}
.msg-unread {
  background: #f56c6c;
  color: #fff;
  border-radius: 10px;
  padding: 2px 8px;
  font-size: 12px;
}
.msg-chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.msg-chat-title {
  padding: 16px 0 8px 18px;
  border-bottom: 1px solid #eee;
  font-weight: bold;
}
.msg-chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 18px;
  background: #f8f8f8;
}
.msg-item {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}
.msg-item.self {
  justify-content: flex-end;
}
.msg-user {
  font-weight: bold;
  margin-right: 8px;
  color: #409eff;
}
.msg-content {
  background: #fff;
  padding: 6px 12px;
  border-radius: 6px;
  margin-right: 8px;
  max-width: 320px;
  word-break: break-all;
}
.msg-chat-input {
  display: flex;
  gap: 8px;
  padding: 12px 18px;
  border-top: 1px solid #eee;
  background: #fff;
}
</style>
