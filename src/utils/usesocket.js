// src/composables/useSocket.js
import { io } from 'socket.io-client';
import { ref } from 'vue';

// 可以将 socket 实例包装为 ref 以保证响应性，也确保只初始化一次
const socket = ref(null);

export function useSocket() {
  // 单例模式，确保只建立一次连接
  if (!socket.value) {
    // 注意替换 URL 为你的后端 WebSocket 地址
    socket.value = io("http://117.72.108.239:3001", {
      // 可以增加额外配置项，如鉴权 token 等
      transports: ["websocket"],
    });
    console.log("WebSocket 已初始化");
  }

  // 提供一个加入房间的封装方法
  const joinRoom = (username) => {
    socket.value.emit('join', username);
  };

  // 可以封装其他操作，如断开连接
  const disconnect = () => {
    if (socket.value) {
      socket.value.disconnect();
      socket.value = null;
    }
  };

  return {
    socket,
    joinRoom,
    disconnect,
  };
}
