<script setup>
import { ref, watch, nextTick, onMounted, onBeforeUnmount, defineExpose, computed } from 'vue'
import axios from 'axios'
import { useSocket } from '@/utils/usesocket'  // 请确保该模块路径正确

const props = defineProps({
  friend: { type: Object, required: true },
  visible: { type: Boolean, required: true }
})
const emit = defineEmits(['close'])

const user = ref(JSON.parse(localStorage.getItem('user') || '{}'))
const messages = ref([])
const inputMsg = ref('');
const minEmptyLines = 2;  // 至少保持两行空白下划线
const minLines = 3;       // 初始显示三行下划线
const lineHeight = 32;    // 行高

// 聊天弹窗位置和尺寸（提前声明）- 增大初始大小
const dialogLeft = ref(window.innerWidth / 2 - 350); // 向左移动，使中心位置适应更大的宽度
const dialogTop = ref(window.innerHeight / 2 - 350); // 向上移动，使中心位置适应更大的高度
const dialogWidth = ref(700); // 从500增大到700
const dialogHeight = ref(700); // 从540增大到700

// 修正初始化顺序 - 确保paperWidth在dialogWidth之后初始化
const paperWidth = ref(700); // 默认宽度也相应增大

// 文本输入区域ref
const textareaRef = ref(null);
// 光标位置
const cursorPosition = ref({ row: 0, col: 0 });

// 改进计算每行最大字符数的方法，使用实际测量而不是估算
const maxCharsPerLine = computed(() => {
  // 使用Canvas测量实际字符宽度
  const measureTextWidth = (text) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.font = '16px "JiangxiZhuokai", cursive, sans-serif';
    return ctx.measureText(text).width;
  };
  
  // 考虑内边距和边距，确定可用宽度
  const availableWidth = paperWidth.value - 80; // 左右各减去40px的空间
  
  // 一个中文字符的平均宽度
  const avgCharWidth = measureTextWidth('字');
  
  // 根据可用宽度估算每行字符数
  return Math.floor(availableWidth / avgCharWidth);
});

// 自动处理文本换行的函数
const processTextWrapping = (text) => {
  if (!text) return [''];
  
  const lines = [];
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  ctx.font = '16px "JiangxiZhuokai", cursive, sans-serif';
  
  // 可用宽度减去一些边距
  const maxWidth = paperWidth.value - 80;
  
  // 处理输入的每一行
  text.split('\n').forEach(inputLine => {
    let line = '';
    let currentWidth = 0;
    
    // 逐字符处理
    for (let i = 0; i < inputLine.length; i++) {
      const char = inputLine[i];
      const charWidth = ctx.measureText(char).width;
      
      // 如果添加这个字符会超过最大宽度，就开始新行
      if (currentWidth + charWidth > maxWidth && line.length > 0) {
        lines.push(line);
        line = char;
        currentWidth = charWidth;
      } else {
        line += char;
        currentWidth += charWidth;
      }
    }
    
    // 添加最后一行
    if (line) {
      lines.push(line);
    }
  });
  
  return lines;
};

// 更新信纸行内容数组计算方法，使用精确的文本换行
const linesArr = computed(() => {
  // 如果没有输入内容，初始显示minLines行
  if (!inputMsg.value) {
    return Array(minLines).fill('');
  }
  
  // 使用优化后的文本换行处理函数
  const lines = processTextWrapping(inputMsg.value);
  
  // 确保至少有minLines行，且末尾有minEmptyLines行空行
  while (lines.length < minLines || lines.length - lines.filter(l => l).length < minEmptyLines) {
    lines.push('');
  }
  
  return lines;
});

// 信纸区域高度：行数*行高+边框
const paperHeight = computed(() => linesArr.value.length * lineHeight);

// 聊天记录区域高度为信纸的三倍
const chatListHeight = computed(() => Math.max(paperHeight.value * 3, 120));

// 聊天记录滚动容器 ref
const chatListRef = ref(null);

// 信纸宽度自动获取
const paperBackgroundRef = ref(null);
onMounted(() => {
  // 挂载后设置信纸宽度为弹窗宽度
  paperWidth.value = dialogWidth.value;
  
  nextTick(() => {
    if (paperBackgroundRef.value) {
      paperWidth.value = paperBackgroundRef.value.offsetWidth || dialogWidth.value;
    }
  });
});
watch(() => dialogWidth.value, () => {
  nextTick(() => {
    if (paperBackgroundRef.value) {
      paperWidth.value = paperBackgroundRef.value.offsetWidth || dialogWidth.value;
    }
  });
});

// 处理文本输入，确保下划线与字符一一对应
const handleTextInput = (e) => {
  nextTick(() => {
    // 更新光标位置
    updateCursorPosition(e);
    
    // 自动滚动到当前输入行
    if (textareaRef.value) {
      // 获取当前光标所在行
      const currentLineIndex = cursorPosition.value.row;
      
      // 找到对应的DOM元素并滚动到视图中
      const lineElements = document.querySelectorAll('.paper-line');
      if (lineElements && lineElements[currentLineIndex]) {
        lineElements[currentLineIndex].scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }
  });
};

// 监听输入内容变化，实时更新行数和自动换行
watch(inputMsg, () => {
  nextTick(() => {
    // 确保textarea高度能容纳所有行
    if (textareaRef.value) {
      textareaRef.value.style.height = `${linesArr.value.length * lineHeight}px`;
    }
  });
});

// 监听窗口宽度变化，更新信纸宽度
watch(() => paperWidth.value, () => {
  // 窗口宽度变化时重新计算行数，实现自动换行
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = `${linesArr.value.length * lineHeight}px`;
    }
  });
});

// 拉取消息并滚动到底部
const fetchMessages = async () => {
  if (!props.friend?.username) {
    messages.value = []
    return
  }
  const res = await axios.get('/api/messages', {
    params: { user1: user.value.username, user2: props.friend.username }
  })
  messages.value = res.data || []
  await nextTick()
  scrollToBottom()
}

// 暴露 refresh 方法，方便外部调用刷新
defineExpose({
  refresh: fetchMessages
})

const sendMessage = async () => {
  if (!inputMsg.value.trim() || !props.friend?.username) return
  await axios.post('/api/messages', {
    from: user.value.username,
    to: props.friend.username,
    content: inputMsg.value.trim()
  })
  inputMsg.value = ''
  // 此处可以调用 fetchMessages() 作为备用（通常 socket 推送即可更新）
  await fetchMessages()
}

const scrollToBottom = () => {
  if (chatListRef.value) {
    chatListRef.value.scrollTop = chatListRef.value.scrollHeight
  }
}

let socket = null

onMounted(async () => {
  // 对话框打开时先拉取历史消息
  if (props.visible) {
    await fetchMessages()
  }
  
  // 初始化 socket 连接，并加入用户房间
  const socketData = useSocket()
  socket = socketData.socket
  if (user.value.username) {
    socketData.joinRoom(user.value.username)
  }
  // 监听后端推送的新消息事件
  socket.value.on('chat-message', async (msg) => {
    // 如果当前对话正在与该好友进行，同时消息来自该好友，则刷新消息记录
    if (props.visible && props.friend?.username && msg.from === props.friend.username) {
      await fetchMessages()
    }
  })
  // 监听未读消息更新事件
  socket.value.on('unread-updated', async (data) => {
    // 刷新当前对话的消息（如有需要，也可单独更新未读状态）
    if (props.visible && props.friend?.username) {
      await fetchMessages()
    }
  })
})

watch(() => props.visible, async (val) => {
  if (val) {
    await fetchMessages()
  }
})
watch(() => props.friend, async (newVal) => {
  if (props.visible) {
    await fetchMessages()
  }
})

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

// 信纸自动聚焦
onMounted(() => {
  // 对话框打开时自动聚焦到文本输入框
  watch(() => props.visible, (newVal) => {
    if (newVal) {
      nextTick(() => {
        if (textareaRef.value) {
          textareaRef.value.focus();
        }
      });
    }
  }, { immediate: true });
});

onBeforeUnmount(() => {
  if (socket && socket.value) {
    socket.value.off('chat-message')
    socket.value.off('unread-updated')
  }
})

// 聊天记录与信纸高度比例
const chatRatio = 3 / 4; // 聊天记录占比
const paperRatio = 1 / 4; // 信纸占比


let dragging = false;
let dragStartX = 0, dragStartY = 0;
let dragOffsetX = 0, dragOffsetY = 0;

// 缩放相关
let resizing = false;
let resizeDir = ''; // 'br'右下, 'bl'左下, 'tr'右上, 'tl'左上, 'r'右, 'l'左, 't'上, 'b'下
let resizeStartX = 0, resizeStartY = 0;
let resizeStartWidth = 0, resizeStartHeight = 0;
let resizeStartLeft = 0, resizeStartTop = 0;

// 拖动事件
function onDragMouseDown(e) {
  if (e.button !== 0) return;
  dragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragOffsetX = dialogLeft.value;
  dragOffsetY = dialogTop.value;
  document.addEventListener('mousemove', onDragMouseMove);
  document.addEventListener('mouseup', onDragMouseUp);
}
function onDragMouseMove(e) {
  if (!dragging) return;
  dialogLeft.value = Math.max(0, Math.min(window.innerWidth - dialogWidth.value, dragOffsetX + (e.clientX - dragStartX)));
  dialogTop.value = Math.max(0, Math.min(window.innerHeight - dialogHeight.value, dragOffsetY + (e.clientY - dragStartY)));
}
function onDragMouseUp() {
  dragging = false;
  document.removeEventListener('mousemove', onDragMouseMove);
  document.removeEventListener('mouseup', onDragMouseUp);
}

// 缩放事件
function onResizeMouseDown(e, dir) {
  e.stopPropagation();
  resizing = true;
  resizeDir = dir;
  resizeStartX = e.clientX;
  resizeStartY = e.clientY;
  resizeStartWidth = dialogWidth.value;
  resizeStartHeight = dialogHeight.value;
  resizeStartLeft = dialogLeft.value;
  resizeStartTop = dialogTop.value;
  document.addEventListener('mousemove', onResizeMouseMove);
  document.addEventListener('mouseup', onResizeMouseUp);
}
function onResizeMouseMove(e) {
  if (!resizing) return;
  let dx = e.clientX - resizeStartX;
  let dy = e.clientY - resizeStartY;
  let minW = 340, minH = 320, maxW = window.innerWidth, maxH = window.innerHeight;
  if (resizeDir.includes('r')) {
    dialogWidth.value = Math.max(minW, Math.min(maxW, resizeStartWidth + dx));
  }
  if (resizeDir.includes('l')) {
    let newW = Math.max(minW, Math.min(maxW, resizeStartWidth - dx));
    let newL = resizeStartLeft + dx;
    if (newL < 0) { newW += newL; newL = 0; }
    dialogWidth.value = newW;
    dialogLeft.value = newL;
  }
  if (resizeDir.includes('b')) {
    dialogHeight.value = Math.max(minH, Math.min(maxH, resizeStartHeight + dy));
  }
  if (resizeDir.includes('t')) {
    let newH = Math.max(minH, Math.min(maxH, resizeStartHeight - dy));
    let newT = resizeStartTop + dy;
    if (newT < 0) { newH += newT; newT = 0; }
    dialogHeight.value = newH;
    dialogTop.value = newT;
  }
}
function onResizeMouseUp() {
  resizing = false;
  resizeDir = '';
  document.removeEventListener('mousemove', onResizeMouseMove);
  document.removeEventListener('mouseup', onResizeMouseUp);
}

// 防止弹窗超出屏幕
function clampDialogPosition() {
  dialogLeft.value = Math.max(0, Math.min(window.innerWidth - dialogWidth.value, dialogLeft.value));
  dialogTop.value = Math.max(0, Math.min(window.innerHeight - dialogHeight.value, dialogTop.value));
}
window.addEventListener('resize', clampDialogPosition);

// 只在鼠标处于可拖动（move）或可缩放（resize）状态时显示圆点
const showResizeHandles = ref(false);

// 判断鼠标是否在边界或标题栏
function handleMouseMove(e) {
  const dialog = document.querySelector('.draggable-resizable-dialog');
  if (!dialog) return;
  const rect = dialog.getBoundingClientRect();
  const x = e.clientX, y = e.clientY;
  const edge = 8; // 边界判定范围
  let onEdge = false;

  // 四边
  if (
    (x >= rect.left - edge && x <= rect.left + edge) ||
    (x >= rect.right - edge && x <= rect.right + edge) ||
    (y >= rect.top - edge && y <= rect.top + edge) ||
    (y >= rect.bottom - edge && y <= rect.bottom + edge)
  ) {
    onEdge = true;
  }
  // 标题栏
  const dragBar = dialog.querySelector('.dialog-drag-bar');
  if (dragBar) {
    const dragRect = dragBar.getBoundingClientRect();
    if (
      x >= dragRect.left && x <= dragRect.right &&
      y >= dragRect.top && y <= dragRect.bottom
    ) {
      onEdge = true;
    }
  }
  showResizeHandles.value = onEdge;
}

onMounted(() => {
  window.addEventListener('mousemove', handleMouseMove);
});
onBeforeUnmount(() => {
  window.removeEventListener('mousemove', handleMouseMove);
});

// 计算署名按钮的位置 - 固定在最后一行下划线的右侧
const signButtonPosition = computed(() => {
  // 获取最后一行的索引
  const lastLineIndex = linesArr.value.length - 1;
  
  return {
    position: 'absolute',
    right: '16px',
    bottom: `${lineHeight - 16}px` // 将按钮定位在最后一行下划线上方
  };
});
</script>

<template>
  <div
    class="draggable-resizable-dialog"
    :style="{
      left: dialogLeft + 'px',
      top: dialogTop + 'px',
      width: dialogWidth + 'px',
      height: dialogHeight + 'px'
    }"
  >
    <div class="dialog-drag-bar" @mousedown="onDragMouseDown">
      <span class="drag-bar-title">
        {{ friend ? ` ${friend.username}` : '' }}
      </span>
      <button class="cuphead-close-btn" @click="emit('close')">
        <img src="/cross-156772.svg" alt="关闭" class="cuphead-close-svg" width="28" height="28" />
      </button>
    </div>
    <div class="dialog-content-area" :style="{ height: (dialogHeight - 56) + 'px' }">
      <div class="chat-container" :style="{ height: (dialogHeight - 56) + 'px', display: 'flex', flexDirection: 'column' }">
        <!-- 聊天记录区域，高度为信纸三倍 -->
        <div class="cuphead-chat-list" ref="chatListRef"
          :style="{ flex: '3 1 0', minHeight: '80px', overflowY: 'auto' }">
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
              <div class="msg-bubble friend-request" v-else>
                [好友请求] {{ msg.from }} 请求加你为好友
              </div>
            </div>
          </div>
        </div>
        
        <!-- 信纸区域，底部紧贴边界 -->
        <div class="cuphead-chat-input"
          :style="{ flex: '1 1 0', minHeight: `${minLines * lineHeight}px`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }">
          <div class="paper-container" :style="{ height: '100%', width: '100%' }">
            <div class="paper-background" ref="paperBackgroundRef" :style="{ height: '100%', position: 'relative' }">
              <!-- 新的信纸内容区域，优化显示自动换行的文本 -->
              <div class="paper-content">
                <!-- 动态生成的行，每行对应一个自动换行后的文本行 -->
                <div 
                  v-for="(line, idx) in linesArr" 
                  :key="idx" 
                  class="paper-line"
                >
                  <!-- 第一行无内容时显示占位符 -->
                  <span v-if="idx === 0 && !inputMsg" class="paper-placeholder">在信纸上写下你的消息...</span>
                  
                  <!-- 显示该行文字，自动换行后的每一行 -->
                  <div class="paper-text">{{ line }}</div>
                  
                  <!-- 下划线 -->
                  <div class="paper-underline"></div>
                  
                  <!-- 如果是最后一行，在右侧添加署名按钮 -->
                  <button 
                    v-if="idx === linesArr.length - 1"
                    class="cuphead-sign-btn" 
                    @click="sendMessage" 
                    :disabled="!inputMsg.trim()"
                  >
                    署名
                  </button>
                </div>
              </div>
              
              <!-- 真实输入框 (透明)，用户实际输入的地方 -->
              <textarea
                v-model="inputMsg"
                ref="textareaRef"
                class="paper-textarea"
                @input="handleTextInput"
                @keydown="handleKeyDown"
                @focus="handlePaperFocus"
                @blur="handlePaperBlur"
                :style="{
                  height: `${linesArr.length * lineHeight}px`,
                }"
                placeholder=""
              ></textarea>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 8个缩放手柄，仅在 showResizeHandles 时显示 -->
    <div v-if="showResizeHandles" class="dialog-resize-handle br" @mousedown="e => onResizeMouseDown(e, 'br')"></div>
    <div v-if="showResizeHandles" class="dialog-resize-handle bl" @mousedown="e => onResizeMouseDown(e, 'bl')"></div>
    <div v-if="showResizeHandles" class="dialog-resize-handle tr" @mousedown="e => onResizeMouseDown(e, 'tr')"></div>
    <div v-if="showResizeHandles" class="dialog-resize-handle tl" @mousedown="e => onResizeMouseDown(e, 'tl')"></div>
    <div v-if="showResizeHandles" class="dialog-resize-handle r" @mousedown="e => onResizeMouseDown(e, 'r')"></div>
    <div v-if="showResizeHandles" class="dialog-resize-handle l" @mousedown="e => onResizeMouseDown(e, 'l')"></div>
    <div v-if="showResizeHandles" class="dialog-resize-handle t" @mousedown="e => onResizeMouseDown(e, 't')"></div>
    <div v-if="showResizeHandles" class="dialog-resize-handle b" @mousedown="e => onResizeMouseDown(e, 'b')"></div>
  </div>
</template>

<style scoped>
/* 茶杯头主题对话框 */
.msg-chat-dialog :deep(.el-dialog) {
  background: linear-gradient(135deg, #fffbe6 0%, #f5e1a4 100%);
  border-radius: 24px;
  box-shadow: 
    0 12px 48px rgba(80,60,30,0.18),
    0 0 0 8px #c7a16b inset,
    0 0 0 3px #7c4a1e;
  border: none;
  overflow: hidden;
}

.msg-chat-dialog :deep(.el-dialog__body) {
  padding: 0 0 12px 0;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
}

.cuphead-dialog-header {
  background: transparent;
  padding: 16px 20px 10px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  border-bottom: 2px dashed rgba(166, 124, 82, 0.4);
}

.cuphead-dialog-title {
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 24px;
  font-weight: bold;
  color: #7c4a1e;
  text-shadow: 1px 1px 0 #f5e1a4, 0 2px 4px #a67c52;
  margin: 0;
  user-select: none;
}

.cuphead-close-btn {
  background: #fffbe6;
  border: 2px solid #a67c52;
  border-radius: 50%;
  width: 36px;
  height: 36px;
  cursor: pointer;
  box-shadow: 0 2px 8px #a67c52, 0 2px 8px rgba(0,0,0,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s, box-shadow 0.2s;
  outline: none;
  padding: 0;
}

.cuphead-close-btn:hover {
  background: #f5b507;
  box-shadow: 0 4px 16px #a67c52, 0 2px 8px rgba(0,0,0,0.12);
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 540px;
  overflow: hidden;
}

/* 聊天消息列表 */
.cuphead-chat-list {
  flex: 1 1 auto;
  min-height: 340px;
  max-height: 420px;
  overflow-y: auto;
  padding: 18px 16px;
  background: rgba(255, 255, 255, 0.3);
  margin: 10px 16px;
  border-radius: 16px;
  border: 2px solid #a67c52;
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.05);
}

/* 聊天消息气泡样式 */
.cuphead-msg-item {
  margin-bottom: 16px;
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
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 4px;
  color: #7c4a1e;
}

.cuphead-msg-item.self .msg-user {
  text-align: right;
  color: #67c23a;
}

.msg-bubble {
  background: #fff;
  padding: 10px 14px;
  border-radius: 16px;
  border: 2px solid #a67c52;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  color: #7c4a1e;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 16px;
  word-break: break-word;
  line-height: 1.5;
  position: relative;
}

.cuphead-msg-item.self .msg-bubble {
  background: #fffbe6;
}

.msg-bubble.friend-request {
  background: #f5e1a4;
  border-color: #a67c52;
}

/* 消息气泡小三角 */
.msg-bubble::before {
  content: "";
  position: absolute;
  top: 10px;
  left: -10px;
  border: 8px solid transparent;
  border-right-color: #a67c52;
}

.msg-bubble::after {
  content: "";
  position: absolute;
  top: 10px;
  left: -7px;
  border: 8px solid transparent;
  border-right-color: #fff;
}

.cuphead-msg-item.self .msg-bubble::before {
  left: auto;
  right: -10px;
  border-right-color: transparent;
  border-left-color: #a67c52;
}

.cuphead-msg-item.self .msg-bubble::after {
  left: auto;
  right: -7px;
  border-right-color: transparent;
  border-left-color: #fffbe6;
}

/* 信纸风格输入框 */
.cuphead-chat-input {
  padding: 0 16px 16px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  min-height: 0;
  max-height: none;
  width: 100%;
  flex: none;
}

/* 信纸容器和背景 */
.paper-container {
  width: 100%;
  height: 100%;
  margin-bottom: 0;
  perspective: 1000px;
}

.paper-background {
  width: 100%;
  height: 100%;
  position: relative;
  background: #fffef8;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  border: 2px solid #a67c52;
  transform: rotate(-0.5deg);
  transition: transform 0.2s;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow-y: auto;
  padding: 0;
}

/* 信纸内容区域 - 新增 */
.paper-content {
  flex: 1;
  padding: 20px;
  display: flex;
  flex-direction: column;
  position: relative;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
}

/* 每行样式 - 修改为行内元素并添加下划线 */
.paper-line {
  position: relative;
  height: 32px;
  margin-bottom: 0;
  display: flex;
  align-items: flex-end;
}

/* 行内文字样式 */
.paper-text {
  position: absolute;
  left: 0;
  bottom: 2px;
  font-size: 16px;
  color: #7c4a1e;
  z-index: 2;
  white-space: pre;
  pointer-events: none;
  max-width: calc(100% - 16px); /* 确保文本不会超出纸张边界 */
  overflow: hidden;
}

/* 占位符样式 */
.paper-placeholder {
  position: absolute;
  left: 0;
  bottom: 2px;
  font-size: 16px;
  color: #a67c52;
  opacity: 0.6;
  z-index: 1;
  pointer-events: none;
}

/* 下划线样式 - 修改为每行单独显示 */
.paper-underline {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 1px;
  border-bottom: 2px solid rgba(166, 124, 82, 0.3);
}

/* 透明输入框样式 */
.paper-textarea {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: transparent;
  border: none;
  outline: none;
  resize: none;
  padding: 20px;
  font-size: 16px;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  color: transparent;
  caret-color: #7c4a1e;
  z-index: 10;
  box-sizing: border-box;
  overflow: hidden; /* 隐藏原生滚动条 */
  white-space: pre-wrap; /* 支持换行显示 */
  word-break: break-all; /* 在任意字符间断行 */
}

/* 署名按钮样式 */
.cuphead-sign-btn {
  background: #fffbe6;
  color: #7c4a1e;
  border: 3px solid #7c4a1e;
  border-radius: 16px;
  font-weight: bold;
  box-shadow: 
    0 4px 0 #7c4a1e,
    0 6px 8px rgba(0,0,0,0.15);
  padding: 6px 24px;
  font-size: 18px;
  transition: transform 0.1s, box-shadow 0.1s, background 0.2s;
  text-shadow: 1px 1px 0 #fffbe6;
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  cursor: pointer;
  outline: none;
  z-index: 20;
  position: absolute;
  right: 16px;
  bottom: 0px; /* 底部对齐下划线 */
  transform: translateY(45px); /* 稍微上移，更贴近下划线 */
}

/* 可拖拽可缩放弹窗外层 */
.draggable-resizable-dialog {
  position: fixed;
  z-index: 99999;
  box-shadow: 0 8px 32px rgba(80,60,30,0.18), 0 0 0 8px #c7a16b inset, 0 0 0 3px #7c4a1e;
  border-radius: 24px;
  background: transparent;
  user-select: none;
  transition: box-shadow 0.2s;
  min-width: 340px;
  min-height: 320px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: visible;
}

/* 拖动条（标题栏） */
.dialog-drag-bar {
  height: 56px;
  background: linear-gradient(90deg, #fffbe6 0%, #f5e1a4 100%);
  border-radius: 24px 24px 0 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
  padding: 0 20px;
  box-shadow: 0 2px 8px rgba(166,124,82,0.08);
  font-family: 'JiangxiZhuokai', cursive, sans-serif;
  font-size: 22px;
  font-weight: bold;
  color: #7c4a1e;
  user-select: none;
}

.drag-bar-title {
  flex: 1;
  font-size: 22px;
  font-weight: bold;
  color: #7c4a1e;
  text-shadow: 1px 1px 0 #f5e1a4;
  user-select: none;
  padding-left: 6px;
}

/* 内容区域 */
.dialog-content-area {
  width: 100%;
  height: calc(100% - 56px);
  background: transparent;
  border-radius: 0 0 24px 24px;
  overflow: hidden;
  position: relative;
}

/* 8个缩放手柄 */
.dialog-resize-handle {
  position: absolute;
  width: 16px;
  height: 16px;
  background: #a67c52;
  opacity: 0.7;
  border-radius: 50%;
  z-index: 10;
  cursor: pointer;
  transition: opacity 0.2s;
}
.dialog-resize-handle:hover {
  opacity: 1;
}
.dialog-resize-handle.br { right: -8px; bottom: -8px; cursor: nwse-resize; }
.dialog-resize-handle.bl { left: -8px; bottom: -8px; cursor: nesw-resize; }
.dialog-resize-handle.tr { right: -8px; top: -8px; cursor: nesw-resize; }
.dialog-resize-handle.tl { left: -8px; top: -8px; cursor: nwse-resize; }
.dialog-resize-handle.r  { right: -8px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
.dialog-resize-handle.l  { left: -8px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
.dialog-resize-handle.t  { top: -8px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
.dialog-resize-handle.b  { bottom: -8px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }

/* 修正弹窗内容区域高度自适应 */
.msg-chat-dialog {
  height: 100% !important;
  min-height: 320px;
  max-height: 100vh;
  overflow: hidden;
}
.chat-container {
  height: 100%;
  min-height: 260px;
  max-height: 100%;
  overflow: hidden;
}

/* 8个缩放手柄，默认隐藏，仅在鼠标悬停弹窗边界时显示 */
.draggable-resizable-dialog .dialog-resize-handle {
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
}

/* 鼠标悬停弹窗时显示所有手柄 */
.draggable-resizable-dialog:hover .dialog-resize-handle {
  opacity: 0.7;
  pointer-events: auto;
}
</style>
