import React, { useState, useEffect } from 'react';

import {
  message,
  Form,
  Select,
  Badge,
  Space,
  Modal,
  Button,
  Upload,
  Input,
} from 'antd';
import { type CloneVoiceReq } from '@coze/api';
import {
  PlayCircleOutlined,
  CopyOutlined,
  UploadOutlined,
} from '@ant-design/icons';

import { type VoiceOption } from './use-coze-api';

const VoiceClone: React.FC<{
  visible: boolean;
  onClose: () => void;
  voice?: VoiceOption;
  cloneVoice: (params: CloneVoiceReq) => Promise<string>;
}> = ({ visible, onClose, voice, cloneVoice }) => {
  const [form] = Form.useForm();
  console.log('voice xx', voice);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const file = values.audio?.file;
      if (!file) {
        message.error('Please upload an audio file');
        return;
      }

      const audioFormat = file.name.split('.').pop()?.toLowerCase();
      const supportedFormats = ['wav', 'mp3', 'ogg', 'm4a', 'aac', 'pcm'];
      if (!supportedFormats.includes(audioFormat)) {
        message.error('Unsupported audio format');
        return;
      }

      const params: CloneVoiceReq = {
        voice_name: values.name,
        preview_text: values.preview_text,
        language: values.language,
        audio_format: audioFormat,
        file,
      };

      // Pass voice_id for non-first-time cloning
      if (
        voice?.is_system_voice === false &&
        voice?.available_training_times > 0
      ) {
        params.voice_id = voice.value;
      }

      await cloneVoice(params);
      message.success('Clone voice success');
      onClose();
    } catch (err) {
      console.error(err);
      message.error(`Clone voice failed: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="Clone Voice"
      open={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{
          name: voice?.name || '',
          preview_text:
            voice?.preview_text ||
            '你好，我是你的专属AI克隆声音，希望未来可以一起好好相处哦',
          language: voice?.language_code || 'zh',
        }}
      >
        <Form.Item
          name="name"
          label="Voice Name"
          rules={[{ required: true, message: 'Please enter voice name' }]}
        >
          <Input />
        </Form.Item>
        <Form.Item
          name="preview_text"
          label="Preview Text"
          rules={[{ required: true, message: 'Please enter preview text' }]}
        >
          <Input.TextArea />
        </Form.Item>
        <Form.Item
          name="language"
          label="Language"
          rules={[{ required: true, message: 'Please select a language' }]}
        >
          <Select>
            <Select.Option value="zh">Chinese</Select.Option>
            <Select.Option value="en">English</Select.Option>
            <Select.Option value="ja">Japanese</Select.Option>
            <Select.Option value="es">Spanish</Select.Option>
            <Select.Option value="id">Indonesian</Select.Option>
            <Select.Option value="pt">Portuguese</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item
          name="audio"
          label="Audio File"
          rules={[{ required: true, message: 'Please upload an audio file' }]}
        >
          <Upload
            maxCount={1}
            beforeUpload={() => false}
            accept=".wav,.mp3,.ogg,.m4a,.aac,.pcm"
          >
            <Button icon={<UploadOutlined />}>Upload Audio</Button>
          </Upload>
        </Form.Item>
      </Form>
    </Modal>
  );
};

const VoiceSelect: React.FC<{
  voices: VoiceOption[];
  loading: boolean;
  value?: string;
  onChange?: (value: string) => void;
  fetchAllVoices?: () => Promise<VoiceOption[]>;
  cloneVoice: (params: CloneVoiceReq) => Promise<string>;
}> = ({ voices, loading, value, onChange, fetchAllVoices, cloneVoice }) => {
  const [audioPlayer] = useState(new Audio());
  const [isPlaying, setIsPlaying] = useState(false);
  const [cloneModalVisible, setCloneModalVisible] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<VoiceOption>();

  const handleAudioError = (error: Event | string) => {
    message.error('Failed to play audio preview');
    console.error('Audio playback error:', error);
  };

  const handlePreview = (previewUrl: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioPlayer.src === previewUrl) {
      if (audioPlayer.paused) {
        audioPlayer.play();
        setIsPlaying(true);
      } else {
        audioPlayer.pause();
        setIsPlaying(false);
      }
    } else {
      audioPlayer.src = previewUrl;
      audioPlayer.onerror = handleAudioError;
      audioPlayer.play();
      setIsPlaying(true);
    }
  };

  const handleClone = (voice: VoiceOption, e: React.MouseEvent) => {
    e.stopPropagation();
    // Check if cloning is allowed
    if (
      voice.is_system_voice === false &&
      voice.available_training_times <= 0
    ) {
      message.error('This voice does not support cloning');
      return;
    }
    setSelectedVoice(voice);
    setCloneModalVisible(true);
  };

  useEffect(
    () => () => {
      audioPlayer.pause();
      audioPlayer.src = '';
    },
    [audioPlayer],
  );

  return (
    <>
      {!voices.some(v => !v.is_system_voice) && (
        <Button
          type="primary"
          icon={<CopyOutlined />}
          onClick={e => handleClone(voices[0], e)}
          style={{ marginBottom: 16 }}
        >
          Clone Voice
        </Button>
      )}
      <Select
        value={value}
        onChange={onChange}
        placeholder="Select a voice"
        allowClear
        style={{ width: '100%' }}
        loading={loading}
      >
        {voices.map(voice => (
          <Select.Option key={voice.value} value={voice.value}>
            <Space>
              {voice.name} ({voice.language_name})
              <Badge
                count={voice.is_system_voice ? 'System' : 'Custom'}
                style={{
                  backgroundColor: voice.is_system_voice
                    ? '#87d068'
                    : '#108ee9',
                }}
              />
              {voice?.preview_url && (
                <PlayCircleOutlined
                  onClick={e => handlePreview(voice.preview_url || '', e)}
                  aria-label={`Play ${voice.name} preview`}
                  role="button"
                  aria-pressed={
                    isPlaying && audioPlayer.src === voice.preview_url
                  }
                />
              )}
              {/* Only show clone button for custom voices with available training times */}
              {!voice.is_system_voice && voice.available_training_times > 0 && (
                <Button
                  type="link"
                  icon={<CopyOutlined />}
                  onClick={e => handleClone(voice, e)}
                  size="small"
                >
                  Clone
                </Button>
              )}
            </Space>
          </Select.Option>
        ))}
      </Select>
      <VoiceClone
        visible={cloneModalVisible}
        onClose={async () => {
          await fetchAllVoices?.();
          setCloneModalVisible(false);
        }}
        voice={selectedVoice}
        cloneVoice={cloneVoice}
      />
    </>
  );
};

export default VoiceSelect;
