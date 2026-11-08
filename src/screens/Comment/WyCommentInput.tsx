import { useCallback, useState } from 'react'
import { View, TouchableOpacity } from 'react-native'
import Text from '@/components/common/Text'
import TextInput from '@/components/common/Input'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import music from '@/utils/musicSdk'
import settingState from '@/store/setting/state'
import { BorderWidths } from '@/theme'

/**
 * 网易云评论发送输入框：wy 源歌曲评论页底部显示。
 * 发送后刷新由用户下拉或点击刷新按钮完成。
 */
export const CommentSendInput = ({ songmid, onSent }: {
  songmid: string
  onSent?: () => void
}) => {
  const theme = useTheme()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  const handleSend = useCallback(() => {
    const content = text.trim()
    if (!content || sending) return
    if (!settingState.setting['common.wy_cookie']) {
      toast('请先登录网易云')
      return
    }
    setSending(true)
    music.wy.comment.sendComment({ songmid }, content).then(() => {
      toast('评论发送成功')
      setText('')
      onSent?.()
    }).catch((err: Error) => {
      toast(err.message)
    }).finally(() => {
      setSending(false)
    })
  }, [text, sending, songmid, onSent])

  return (
    <View style={{ ...styles.container, borderTopColor: theme['c-border-background'] }}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="写下你的评论..."
        placeholderTextColor={theme['c-font-label']}
        style={{ ...styles.input, backgroundColor: theme['c-main-background'], color: theme['c-font'] }}
        returnKeyType="send"
        onSubmitEditing={handleSend}
      />
      <TouchableOpacity style={{ ...styles.sendBtn, backgroundColor: theme['c-button-background'] }} onPress={handleSend} disabled={sending}>
        <Text size={13} color={theme['c-button-font']}>{sending ? '发送中' : '发送'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = createStyle({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: BorderWidths.normal,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  input: {
    flexGrow: 1,
    flexShrink: 1,
    borderRadius: 15,
    paddingHorizontal: 12,
    paddingVertical: 4,
    fontSize: 13,
  },
  sendBtn: {
    marginLeft: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
})
