import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'
import { setVoiceTipEnabled } from '@/utils/nativeModules/voice'


import CheckBoxItem from '../../components/CheckBoxItem'

export default memo(() => {
  const t = useI18n()
  const isShowVoiceTip = useSettingValue('player.isShowVoiceTip')
  const setShowVoiceTip = (isShowVoiceTip: boolean) => {
    updateSetting({ 'player.isShowVoiceTip': isShowVoiceTip })
    setVoiceTipEnabled(isShowVoiceTip)
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={isShowVoiceTip} label={t('setting_player_show_voice_tip')} onChange={setShowVoiceTip} />
    </View>
  )
})


const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
