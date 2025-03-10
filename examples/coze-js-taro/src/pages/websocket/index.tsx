/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from 'react';

import Taro, { useLoad } from '@tarojs/taro';
import { View, Text, Button } from '@tarojs/components';
import './index.css';
import { type CreateSpeechWsRes, WebsocketsEventType } from '@coze/api';
import lamejs from '@breezystack/lamejs';
import { decode } from 'base64-arraybuffer';

const pcmList: string[] = [];

export default function WebSocketDemo() {
  const [connectionStatus, setConnectionStatus] = useState<string>('未连接');
  const [messages, setMessages] = useState<string[]>([]);
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
    console.log('收到消息:', event.event_type);

    if (event.event_type === WebsocketsEventType.SPEECH_AUDIO_UPDATE) {
      const delta = event.data.delta;
      pcmList.push(delta);
    } else if (
      event.event_type === WebsocketsEventType.SPEECH_AUDIO_COMPLETED
    ) {
      console.log('pcmList', pcmList);

      const base64String = pcmList.join('');
      const decodedContent = decode(base64String);

      // 直接使用 decodedContent 创建 Int16Array
      const pcmData = new Int16Array(decodedContent);
      handleAudio(pcmData);
      pcmList.length = 0;
    }
  };

  const handleAudio = (pcmData: Int16Array) => {
    // 建议添加音频数据校验
    // if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    //   console.error('无效的音频数据');
    //   return;
    // }

    const mp3Encoder = new lamejs.Mp3Encoder(1, 24000, 128);
    // const pcmData = new Int16Array(arrayBuffer);
    console.log('pcmData', pcmData);

    // 将 PCM 数据分块处理
    const blockSize = 1152;
    const mp3Data: Uint8Array[] = [];

    for (let i = 0; i < pcmData.length; i += blockSize) {
      const pcmBlock = pcmData.subarray(i, i + blockSize);
      const mp3Buffer = mp3Encoder.encodeBuffer(pcmBlock);
      if (mp3Buffer.length > 0) {
        mp3Data.push(mp3Buffer);
      }
    }

    // 完成编码
    const mp3Buffer = mp3Encoder.flush();
    // if (mp3Buffer.length > 0) {
    //   mp3Data.push(mp3Buffer);
    // }

    // 保存并播放 MP3 数据
    saveAndPlayMp3(mp3Data);
  };

  const saveAndPlayMp3 = (mp3Data: Uint8Array[]) => {
    // 建议添加文件大小限制检查
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    const totalLength = mp3Data.reduce((acc, curr) => acc + curr.length, 0);

    if (totalLength > MAX_FILE_SIZE) {
      console.error('音频文件过大');
      return;
    }

    // 创建一个新的 Uint8Array 来存储所有数据
    const mp3ArrayBuffer = new Uint8Array(totalLength);

    // 复制数据
    let offset = 0;
    mp3Data.forEach(data => {
      mp3ArrayBuffer.set(data, offset);
      offset += data.length;
    });

    // 获取文件系统管理器
    const fs = Taro.getFileSystemManager();

    // 生成临时文件路径
    const tempFilePath = `${Taro.env.USER_DATA_PATH}/temp_audio_${Date.now()}.mp3`;

    try {
      // 修改写入文件的方式
      fs.writeFileSync(tempFilePath, mp3ArrayBuffer.buffer, 'binary');

      // 播放音频
      playAudio(tempFilePath);
    } catch (error) {
      console.error('保存音频文件失败:', error);
    }
  };

  const playAudio = (filePath: string) => {
    // 创建音频上下文
    const audioContext = Taro.createInnerAudioContext();
    audioContext.autoplay = true;

    audioContext.volume = 1;

    console.log('filePath', filePath);
    // 设置音频源
    audioContext.src = filePath;

    // 监听播放事件
    audioContext.onPlay(() => {
      console.log('开始播放音频');
    });

    audioContext.onError(res => {
      console.error('音频播放错误:', res);
    });

    audioContext.onEnded(() => {
      console.log('音频播放结束');
      // 播放结束后释放资源
      audioContext.destroy();

      // 删除临时文件
      // Taro.getFileSystemManager().unlink({
      //   filePath,
      //   success: () => console.log('临时音频文件已删除'),
      //   fail: err => console.error('删除临时音频文件失败:', err),
      // });
    });

    // 开始播放
    audioContext.play();
  };

  // 连接 WebSocket
  const connectWebSocket = () => {
    if (socketTask) {
      console.log('WebSocket 已经连接');
      return;
    }

    console.log('wsConfig', wsConfig);

    Taro.connectSocket({
      url: wsConfig.url + '?authorization=' + wsConfig.header.Authorization,
      header: wsConfig.header,
    })
      .then(task => {
        task.onOpen(() => {
          console.log('小程序 WebSocket 已连接');
          setConnectionStatus('已连接');

          // 添加延迟确保连接完全建立
          // setTimeout(() => {
          //   // 连接成功后发送初始化消息
          //   task.send({
          //     data: JSON.stringify({
          //       id: 'event_id',
          //       event_type: WebsocketsEventType.SPEECH_UPDATE,
          //       data: {
          //         output_audio: {
          //           codec: 'pcm',
          //           pcm_config: {
          //             sample_rate: 24000,
          //           },
          //           speech_rate: 0,
          //         },
          //       },
          //     }),
          //     success: () => {
          //       console.log('初始化消息发送成功');
          //     },
          //     fail: error => {
          //       console.error('初始化消息发送失败:', error);
          //     },
          //   });
          // }, 500); // 500ms delay
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
  };

  // 关闭 WebSocket
  const closeWebSocket = () => {
    if (!socketTask) {
      console.log('WebSocket 未连接');
      return;
    }

    socketTask.close();
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
        delta: '我是小度你的亲密助手',
      },
    });

    socketTask.send({
      data: message,
      success: () => {
        console.log('消息发送成功');
      },
      fail: error => {
        console.error('消息发送失败:', error);
      },
    });

    socketTask.send({
      data: JSON.stringify({
        id: 'event_id',
        event_type: WebsocketsEventType.INPUT_TEXT_BUFFER_COMPLETE,
      }),
      success: () => {
        console.log('消息发送成功');
      },
      fail: error => {
        console.error('消息发送失败:', error);
      },
    });
  };

  // 组件卸载时清理
  useEffect(
    () => () => {
      if (socketTask) {
        closeWebSocket();
      }
      // 建议清理音频资源
      Taro.getFileSystemManager().removeSavedFile({
        filePath: `${Taro.env.USER_DATA_PATH}/temp_audio_*.mp3`,
      });
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
