import { memo } from 'react'
import { View } from 'react-native'
import Button from '@/components/common/Button'

import { createStyle } from '@/utils/tools'
import { pop } from '@/navigation'
import { useTheme } from '@/store/theme/hook'
import commonState from '@/store/common/state'
import Text from '@/components/common/Text'
import { handleCollect, handlePlay } from './listAction'
import songlistState from '@/store/songlist/state'
import { useI18n } from '@/lang'
import { useListInfo } from './state'
// import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'

export default memo(({ onBack, inline = false }: { onBack?: () => void, inline?: boolean }) => {
  const theme = useTheme()
  const t = useI18n()
  const info = useListInfo()
  // 横屏紧凑模式：按钮组改为按内容宽度排列，与标题同行显示
  const containerStyle = inline ? [styles.container, styles.containerInline] : styles.container
  const btnStyle = inline ? [styles.controlBtn, styles.controlBtnInline] : styles.controlBtn

  const back = () => {
    // 嵌入式打开时由调用方提供返回回调
    if (onBack) {
      onBack()
      return
    }
    const componentId = commonState.componentIds.songlistDetail
    if (componentId) void pop(componentId)
  }

  const handlePlayAll = () => {
    if (!songlistState.listDetailInfo.info.name) return
    void handlePlay(info.id, info.source, songlistState.listDetailInfo.list)
  }

  const handleCollection = () => {
    if (!songlistState.listDetailInfo.info.name) return
    void handleCollect(info.id, info.source, songlistState.listDetailInfo.info.name || info.name)
  }

  return (
    <View style={containerStyle}>
      <Button onPress={back} style={btnStyle}>
        <Text style={{ ...styles.controlBtnText, color: theme['c-button-font'] }}>{t('back')}</Text>
      </Button>
      <Button onPress={handlePlayAll} style={btnStyle}>
        <Text style={{ ...styles.controlBtnText, color: theme['c-button-font'] }}>{t('play_all')}</Text>
      </Button>
      <Button onPress={handleCollection} style={btnStyle}>
        <Text style={{ ...styles.controlBtnText, color: theme['c-button-font'] }}>{t('collect_songlist')}</Text>
      </Button>
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'row',
    width: '100%',
    flexGrow: 0,
    flexShrink: 0,
  },
  controlBtn: {
    flexGrow: 1,
    flexShrink: 1,
    width: '33%',
    paddingTop: 12,
    paddingBottom: 12,
    paddingLeft: 10,
    paddingRight: 10,
  },
  controlBtnText: {
    fontSize: 13,
    textAlign: 'center',
  },
  // 横屏紧凑：按钮按内容宽度排列，纵向内边距收紧
  containerInline: {
    flexGrow: 0,
    flexShrink: 1,
    width: 'auto',
  },
  controlBtnInline: {
    flexGrow: 0,
    flexShrink: 0,
    width: 'auto',
    paddingTop: 5,
    paddingBottom: 5,
    paddingLeft: 10,
    paddingRight: 10,
  },
})

