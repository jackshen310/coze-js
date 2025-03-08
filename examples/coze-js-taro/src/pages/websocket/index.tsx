/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';

import Taro, { useLoad } from '@tarojs/taro';
import { View, Text, Button } from '@tarojs/components';
import './index.css';
import { type CreateSpeechWsRes, WebsocketsEventType } from '@coze/api';

export default function WebSocketDemo() {
  const [connectionStatus, setConnectionStatus] = useState<string>('未连接');
  // const [messages, setMessages] = useState<string[]>([]);
  const [socketTask, setSocketTask] = useState<Taro.SocketTask | null>(null);

  const wsConfig = {
    url: 'wss://ws.coze.cn/v1/audio/speech', // 替换为实际的 WebSocket URL
    header: {
      Authorization: `Bearer ${process.env.TARO_APP_COZE_PAT}`,
    },
  };

  // 统一的消息处理函数
  const handleMessage = (data: string) => {
    // setMessages(prev => [...prev, data]);
    const event = JSON.parse(data) as CreateSpeechWsRes;
    console.log('收到消息:', data);

    if (event.event_type === WebsocketsEventType.SPEECH_AUDIO_UPDATE) {
      // const delta = event.data.delta;
    }
  };

  // 连接 WebSocket
  const connectWebSocket = () => {
    if (socketTask) {
      console.log('WebSocket 已经连接');
      return;
    }

    // H5 环境
    if (process.env.TARO_ENV === 'h5') {
      const ws = new WebSocket(
        `${wsConfig.url}?authorization=${wsConfig.header.Authorization}`,
      );

      ws.onopen = () => {
        console.log('H5 WebSocket 已连接');
        setConnectionStatus('已连接');

        ws.send(
          JSON.stringify({
            id: 'event_id',
            event_type: WebsocketsEventType.SPEECH_UPDATE,
            data: {
              output_audio: {
                codec: 'pcm',
                pcm_config: {
                  sample_rate: 24000,
                },
                speech_rate: 0,
                // voice_id: '',
              },
            },
          }),
        );
      };

      ws.onmessage = event => {
        handleMessage(event.data);
      };

      ws.onerror = error => {
        console.error('WebSocket 错误:', error);
        setConnectionStatus('连接错误');
      };

      ws.onclose = () => {
        console.log('WebSocket 已关闭');
        setConnectionStatus('已断开');
        setSocketTask(null);
      };

      setSocketTask(ws as any);
    }
    // 小程序环境
    else {
      Taro.connectSocket({
        url: wsConfig.url,
        header: wsConfig.header,
      })
        .then(task => {
          task.onOpen(() => {
            console.log('小程序 WebSocket 已连接');
            setConnectionStatus('已连接');
          });

          task.onMessage(res => {
            handleMessage(res.data);
          });

          task.onError(error => {
            console.error('WebSocket 错误:', error);
            setConnectionStatus('连接错误');
          });

          task.onClose(() => {
            console.log('WebSocket 已关闭');
            setConnectionStatus('已断开');
            setSocketTask(null);
          });

          setSocketTask(task);
        })
        .catch(error => {
          console.error('WebSocket 连接失败:', error);
          setConnectionStatus('连接失败');
        });
    }
  };

  // 关闭 WebSocket
  const closeWebSocket = () => {
    if (!socketTask) {
      console.log('WebSocket 未连接');
      return;
    }

    if (process.env.TARO_ENV === 'h5') {
      (socketTask as WebSocket).close();
    } else {
      socketTask.close();
    }
  };

  // 发送消息
  const sendMessage = () => {
    if (!socketTask) {
      console.log('WebSocket 未连接');
      return;
    }

    const message = JSON.stringify({
      id: 'event_id',
      event_type: WebsocketsEventType.INPUT_TEXT_BUFFER_APPEND,
      data: {
        delta: '我是小度，正在测试PCM音频格式语音播放',
      },
    });

    if (process.env.TARO_ENV === 'h5') {
      (socketTask as WebSocket).send(message);
    } else {
      socketTask.send({
        data: message,
        success: () => {
          console.log('消息发送成功');
        },
        fail: error => {
          console.error('消息发送失败:', error);
        },
      });
    }
  };

  // 组件卸载时清理
  useEffect(
    () => () => {
      if (socketTask) {
        closeWebSocket();
      }
    },
    [socketTask],
  );

  useLoad(() => {
    console.log('WebSocket page loaded');
  });

  return (
    <View className="websocket-container">
      <View className="control-panel">
        <Button onClick={connectWebSocket}>连接 WebSocket</Button>
        <Button onClick={closeWebSocket}>断开连接</Button>
        <Button onClick={sendMessage}>发送消息</Button>
      </View>

      <View className="status-panel">
        <Text>连接状态: {connectionStatus}</Text>
      </View>

      <View className="message-panel">
        <Text>接收到的消息:</Text>
        <View className="message-list">
          {messages.map((msg, index) => (
            <View key={index} className="message-item">
              {msg}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
