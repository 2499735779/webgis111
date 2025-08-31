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
  
  // 重置信纸高度
  paperLines.value = 3;
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
  console.debug('[DEBUG] handleRequest:', msg, accept);
  // 修复：确保传递正确的参数
  await axios.post('/api/handle-friend-request', {
    username: user.value.username,
    from: typeof msg === 'string' ? msg : msg.from, // 支持直接传入用户名或消息对象
    accept
  });
  await fetchFriends();
  // 更新好友请求列表
  if (typeof fetchFriendRequests === 'function') {
    await fetchFriendRequests();
  }
  // 如果当前在聊天，刷新聊天记录
  if (selectedFriend.value) {
    await fetchMessages(selectedFriend.value);
  }
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

// 添加行高追踪和下划线管理
const lineHeight = 24; // 文本输入的行高
const paperLines = ref(3); // 默认显示的行数
const paperBackground = ref(null); // 引用信纸背景元素

// 新增：最大显示行数限制，超过后显示滚动条
const maxDisplayLines = 8;

// 监听输入内容变化，动态调整行数和下划线
const updatePaperLines = () => {
  nextTick(() => {
    if (!paperBackground.value) return;
    
    // 计算当前文本需要的行数(至少1行)
    const text = inputMsg.value;
    const lines = text.split('\n').length;
    const textWidth = paperBackground.value.clientWidth - 40; // 减去左右内边距
    let totalLines = 0;
    
    // 计算每行文本是否需要换行
    text.split('\n').forEach(line => {
      // 创建临时span计算宽度
      const tempSpan = document.createElement('span');
      tempSpan.style.font = '16px "JiangxiZhuokai", cursive, sans-serif';
      tempSpan.style.position = 'absolute';
      tempSpan.style.visibility = 'hidden';
      tempSpan.style.whiteSpace = 'nowrap';
      tempSpan.textContent = line || 'A'; // 空行也算1行
      document.body.appendChild(tempSpan);
      
      // 计算需要的行数
      const lineWidth = tempSpan.offsetWidth;
      const lineCount = Math.max(1, Math.ceil(lineWidth / textWidth));
      totalLines += lineCount;
      
      // 移除临时元素
      document.body.removeChild(tempSpan);
    });
    
    // 确保至少有3行，但不超过最大行数限制
    paperLines.value = Math.min(Math.max(3, totalLines + 1), maxDisplayLines); // +1为光标所在行
  });
};

// 监听输入内容变化
watch(() => inputMsg.value, updatePaperLines);

// 在组件挂载后初始化
onMounted(() => {
  // ...existing code...
  nextTick(updatePaperLines);
});

// 处理回车键（shift+回车添加新行，直接回车发送消息）
const handleKeyDown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
};

// 添加信纸焦点状态
const paperFocused = ref(false);

// 处理信纸获得焦点和失去焦点事件
const handlePaperFocus = () => {
  paperFocused.value = true;
};

const handlePaperBlur = () => {
  paperFocused.value = false;
};

// 聊天面板首次显示时自动聚焦到文本输入框
watch(() => selectedFriend.value, (newVal) => {
  if (newVal) {
    nextTick(() => {
      const textarea = document.querySelector('.paper-textarea');
      if (textarea) {
        textarea.focus();
      }
    });
  }
});
</script>

<template>
  <div class="msg-root cuphead-theme">
    <div class="msg-friend-list">
      <div class="msg-friend-title">好友列表</div>
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
      
      <div class="msg-chat-list cuphead-chat-list" ref="chatListRef">
        <div
          v-for="msg in messages"
          :key="msg._id"
          :class="['cuphead-msg-item', { self: msg.from === user.username }]"
        >
          <div class="msg-bubble-container">
            <div class="msg-user">{{ msg.from }}</div>
            <div class="msg-bubble" v-if="msg.type !== 'friend-request'">
              {{ msg.content }}
            </div>
            <!-- 修改：调整好友请求消息中按钮的布局，确保对齐 -->
            <div class="msg-bubble friend-request" v-else>
              <div class="friend-request-content">
                <div>[好友请求] {{ msg.from }} 请求加你为好友</div>
              </div>
              <div class="request-buttons-vertical">
                <button class="cuphead-btn accept" @click.stop="handleRequest(msg, true)">同意</button>
                <button class="cuphead-btn reject" @click.stop="handleRequest(msg, false)">拒绝</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div class="cuphead-chat-input">
        <div class="paper-container">
          <div class="paper-background" ref="paperBackground" :class="{ 'paper-focused': paperFocused }">
            <div 
              class="paper-lines"
              :style="{ height: `${paperLines * lineHeight}px` }"
            >
              <div 
                v-for="i in paperLines" 
                :key="i" 
                class="paper-line"
                :style="{ top: `${i * lineHeight - 4}px` }"
              ></div>
            </div>
            
            <!-- 修改：添加容器控制滚动 -->
            <div class="paper-textarea-container">
              <textarea
                v-model="inputMsg"
                class="paper-textarea"
                :style="{ 
                  height: `${paperLines * lineHeight}px`, 
                  maxHeight: `${maxDisplayLines * lineHeight}px` 
                }"
                placeholder="在信纸上写下你的消息..."
                @keydown="handleKeyDown"
                @input="updatePaperLines"
                @focus="handlePaperFocus"
                @blur="handlePaperBlur"
                autocomplete="off"
                spellcheck="false"
              ></textarea>
              
              <!-- 添加光标元素 -->
              <div class="paper-cursor" v-if="paperFocused"></div>
            </div>
          </div>
        </div>
        
        <button 
          class="cuphead-send-btn" 
          @click="sendMessage" 
          :disabled="!inputMsg.trim()"
        >
          发送
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 整体风格覆盖 */
.cuphead-theme {
  --cuphead-primary: #7c4a1e;
  --cuphead-accent: #a67c52;
  --cuphead-bg: #fffbe6;
  --cuphead-bg-light: #f5e1a4;
  --cuphead-shadow: rgba(166, 124, 82, 0.2);
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
}

.msg-root {
  display: flex;
  height: 100vh;
  background: var(--cuphead-bg);
}

/* 好友列表侧边栏 */
.msg-friend-list {
  width: 220px;
  background: linear-gradient(180deg, #fffbe6 0%, #f5e1a4 100%);
  border-right: 3px solid var(--cuphead-accent);
  padding: 0;
  display: flex;
  flex-direction: column;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.1);
}

.msg-friend-title {
  font-weight: bold;
  padding: 20px 0 16px 24px;
  border-bottom: 2px dashed rgba(166, 124, 82, 0.4);
  font-size: 22px;
  color: var(--cuphead-primary);
  text-shadow: 1px 1px 0 #f5e1a4;
}

.msg-friend-item {
  padding: 14px 24px;
  cursor: pointer;
  border-bottom: 1px solid rgba(166, 124, 82, 0.2);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.2s;
  color: var(--cuphead-primary);
  font-size: 16px;
}

.msg-friend-item:hover {
  background: rgba(166, 124, 82, 0.1);
}

.msg-friend-item.active {
  background: rgba(166, 124, 82, 0.2);
  border-left: 4px solid var(--cuphead-accent);
  font-weight: bold;
}

.msg-unread {
  background: #f56c6c;
  color: #fff;
  border-radius: 12px;
  padding: 2px 10px;
  font-size: 12px;
  border: 2px solid #fff;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
}

/* 聊天主面板 */
.msg-chat-panel {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-height: 540px; /* 原来未限制，放大为540px */
  background: var(--cuphead-bg);
}

.msg-chat-title {
  padding: 20px 0 16px 24px;
  border-bottom: 2px dashed rgba(166, 124, 82, 0.4);
  font-weight: bold;
  font-size: 22px;
  color: var(--cuphead-primary);
  text-shadow: 1px 1px 0 #f5e1a4;
}

/* 聊天消息列表 */
/* 原来 .cuphead-chat-list 高度由父容器控制，现在直接设置更大高度 */
.cuphead-chat-list {
  flex: 1 1 auto;
  min-height: 340px; /* 原来高度较小，放大为340px */
  max-height: 420px; /* 增加最大高度，防止撑破弹窗 */
  overflow-y: auto;
  padding: 24px;
  background: rgba(255, 255, 255, 0.6);
  margin: 16px;
  border-radius: 16px;
  border: 2px solid #a67c52;
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.05);
}

/* 聊天消息气泡样式 */
.cuphead-msg-item {
  margin-bottom: 20px;
  display: flex;
  align-items: flex-start;
}

.cuphead-msg-item.self {
  justify-content: flex-end;
}

.msg-bubble-container {
  max-width: 75%;
  display: flex;
  flex-direction: column;
}

.msg-user {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 4px;
  color: var(--cuphead-primary);
}

.cuphead-msg-item.self .msg-user {
  text-align: right;
  color: #67c23a;
}

.msg-bubble {
  background: #fff;
  padding: 12px 16px;
  border-radius: 16px;
  border: 2px solid var(--cuphead-accent);
  box-shadow: 0 2px 8px var(--cuphead-shadow);
  color: var(--cuphead-primary);
  font-size: 16px;
  word-break: break-word;
  line-height: 1.5;
  position: relative;
}

.cuphead-msg-item.self .msg-bubble {
  background: var(--cuphead-bg);
}

/* 修改：好友请求消息样式，增加水平布局 */
.msg-bubble.friend-request {
  background: var(--cuphead-bg-light);
  border-color: var(--cuphead-accent);
  padding-bottom: 16px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.friend-request-content {
  flex: 1;
}

/* 修改：垂直排列的按钮样式，调整为等高等宽 */
.request-buttons-vertical {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  z-index: 10;  /* 提高层级确保按钮可点击 */
  min-width: 64px; /* 略微增加宽度 */
  width: 64px; /* 固定宽度 */
  margin-left: 10px; /* 增加与左侧内容的间距 */
  align-items: center; /* 确保按钮在容器中居中对齐 */
}

.cuphead-btn {
  width: 100%; /* 使用100%宽度填充父容器 */
  height: 32px; /* 固定高度 */
  border-radius: 8px;
  font-weight: bold;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 14px;
  cursor: pointer;
  border: 2px solid;
  transition: all 0.2s;
  outline: none;
  position: relative;  /* 确保按钮层级正确 */
  z-index: 15;  /* 高于其他元素 */
  text-align: center;
  line-height: 28px; /* 文字垂直居中 */
  padding: 0; /* 移除内边距 */
  letter-spacing: 1px; /* 字间距 */
  box-sizing: border-box; /* 确保边框被包含在宽度内 */
}

.cuphead-btn.accept {
  background: #67c23a;
  color: white;
  border-color: #529b2e;
  box-shadow: 0 2px 0 #529b2e;
}

.cuphead-btn.accept:hover {
  background: #85ce61;
  transform: translateY(-2px);
  box-shadow: 0 4px 0 #529b2e;
}

.cuphead-btn.accept:active {
  transform: translateY(0);
  box-shadow: 0 1px 0 #529b2e;
}

.cuphead-btn.reject {
  background: #f56c6c;
  color: white;
  border-color: #e64242;
  box-shadow: 0 2px 0 #e64242;
}

.cuphead-btn.reject:hover {
  background: #f78989;
  transform: translateY(-2px);
  box-shadow: 0 4px 0 #e64242;
}

.cuphead-btn.reject:active {
  transform: translateY(0);
  box-shadow: 0 1px 0 #e64242;
}

/* 信纸风格输入框 */
.cuphead-chat-input {
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.paper-container {
  width: 100%;
  margin-bottom: 16px;
  perspective: 1000px;
}

.paper-background {
  width: 100%;
  position: relative;
  background: #fffef8;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  padding: 16px 20px;
  border: 2px solid var(--cuphead-accent);
  transform: rotate(-0.5deg);
  transition: transform 0.2s;
}

.paper-background:hover {
  transform: rotate(0.5deg);
}

.paper-lines {
  position: absolute;
  left: 20px;
  right: 20px;
  top: 40px;
  pointer-events: none; /* 确保下划线不会阻挡文本选择 */
}

.paper-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 1px;
  background: rgba(166, 124, 82, 0.3);
  pointer-events: none; /* 确保下划线不会阻挡文本选择 */
}

/* 新增：信纸边框焦点状态样式 */
.paper-background.paper-focused {
  box-shadow: 0 4px 16px rgba(166, 124, 82, 0.2);
  border-color: #a67c52;
  transform: rotate(0deg);
}

/* 修改：信纸容器和输入框样式 */
.paper-textarea-container {
  position: relative;
  width: 100%;
  overflow: auto; /* 启用滚动条 */
  max-height: 192px; /* 最大8行 = 8 * 24px */
  z-index: 1; /* 确保在下划线上方 */
}

.paper-textarea {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 16px;
  line-height: 24px;
  color: var(--cuphead-primary);
  padding: 0;
  resize: none;
  overflow: visible; /* 允许内容溢出，由容器控制滚动 */
  z-index: 2; /* 确保在下划线上方 */
  margin: 0; /* 移除默认margin */
  -webkit-appearance: none; /* 移除iOS默认样式 */
  pointer-events: auto; /* 确保可以选中和编辑文本 */
  caret-color: var(--cuphead-accent); /* 原生光标颜色 */
  position: relative; /* 确保相对定位 */
}

.paper-textarea::placeholder {
  color: var(--cuphead-accent);
  opacity: 0.5;
}

/* 新增：自定义闪烁光标 */
.paper-cursor {
  position: absolute;
  top: 0;
  height: 24px; /* 一行高度 */
  width: 2px;
  background-color: var(--cuphead-accent);
  animation: cursor-blink 1s infinite;
  left: 0; /* 初始位置 */
  pointer-events: none; /* 不阻止输入框点击 */
  z-index: 3;
  /* 光标初始位置在首字符处 */
  transform: translateX(calc(0ch + 0px)); /* 根据光标位置动态调整 */
}

/* 闪烁动画 */
@keyframes cursor-blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
</style>
