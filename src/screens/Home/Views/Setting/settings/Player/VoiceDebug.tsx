import { memo, useCallback, useEffect, useState } from 'react'
import { ScrollView, View } from 'react-native'
import Text from '@/components/common/Text'
import TextInput from '@/components/common/Input'
import Button from '../../components/Button'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import {
  getVoiceDebugLogs,
  getVoiceRegisteredAt,
  clearVoiceDebugLogs,
  sendVoiceTestBroadcast,
  reregisterVoice,
  type VoiceDebugItem,
} from '@/utils/nativeModules/voice'

/**
 * 车机语音调试面板：直接显示原生层收到的每一条广播、解析结果、是否送达 JS。
 * 车机上无法接 logcat，这个面板是判断"语音功能到底哪里断了"的唯一直观手段。
 */
export default memo(() => {
  const theme = useTheme()
  const [logs, setLogs] = useState<VoiceDebugItem[]>([])
  const [registeredAt, setRegisteredAt] = useState(0)
  const [keyword, setKeyword] = useState('稻香')

  const refresh = useCallback(async() => {
    const [list, at] = await Promise.all([getVoiceDebugLogs(), getVoiceRegisteredAt()])
    setLogs(list)
    setRegisteredAt(at)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleTest = () => {
    const raw = keyword.trim()
    if (!raw) {
      toast('请输入测试内容')
      return
    }
    // 支持「歌名-歌手」和「歌名 歌手」两种写法，和车机下发 name/singer 两个字段等价
    let name = raw
    let artist = ''
    const dash = raw.split('-')
    if (dash.length >= 2) {
      name = dash[0].trim()
      artist = dash.slice(1).join('-').trim()
    } else {
      const space = raw.split(/\s+/)
      if (space.length >= 2) {
        name = space[0]
        artist = space.slice(1).join(' ').trim()
      }
    }
    sendVoiceTestBroadcast(name, artist)
    toast(`已发出测试指令：${name}${artist ? ' / ' + artist : ''}，稍后点刷新查看日志`)
    setTimeout(() => { void refresh() }, 1500)
  }

  const handleClear = () => {
    clearVoiceDebugLogs()
    void refresh()
  }

  const handleReregister = () => {
    reregisterVoice()
    toast('已重新向小迪注册，稍后点刷新查看')
    setTimeout(() => { void refresh() }, 1500)
  }

  const regText = registeredAt
    ? `已注册：${new Date(registeredAt).toLocaleString()}`
    : '未注册（从未向小迪注册成功）'

  return (
    <View style={styles.content}>
      <Text size={13}>车机语音调试</Text>
      <Text size={12} color={theme['c-font-label']}>{regText}</Text>
      <Text size={12} color={theme['c-font-label']}>
        {'发语音后点刷新；若"收到"有而"已发JS"无，说明原生到 JS 链路断了'}
      </Text>

      <TextInput
        value={keyword}
        onChangeText={setKeyword}
        placeholder="歌名-歌手，如：燃-容祖儿"
        style={[styles.input, { borderColor: theme['c-border-background'], color: theme['c-font'] }]}
      />
      <View style={styles.btnRow}>
        <Button onPress={handleTest}>{'模拟点歌'}</Button>
        <Button onPress={handleReregister}>{'重新注册'}</Button>
        <Button onPress={() => { void refresh() }}>{'刷新'}</Button>
        <Button onPress={handleClear}>{'清空'}</Button>
      </View>

      <ScrollView style={styles.logBox} nestedScrollEnabled>
        {logs.length === 0
          ? <Text size={12} color={theme['c-font-label']}>（暂无语音日志，对着车机说一句「播放稻香」后点刷新）</Text>
          : logs.map((item, index) => (
            <Text key={`${item.t}-${index}`} size={11} color={theme['c-font']} style={styles.logLine}>
              {`${item.t} [${item.tag}] ${item.msg}`}
            </Text>
          ))}
      </ScrollView>
    </View>
  )
})

const styles = createStyle({
  content: {
    marginTop: 10,
    gap: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 36,
  },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  logBox: {
    maxHeight: 220,
    borderRadius: 4,
    padding: 6,
    backgroundColor: 'rgba(128,128,128,0.08)',
  },
  logLine: {
    lineHeight: 18,
  },
})
