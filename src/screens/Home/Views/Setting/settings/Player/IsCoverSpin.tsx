import { updateSetting } from '@/core/common'
import { useI18n } from '@/lang'
import { createStyle } from '@/utils/tools'
import { memo } from 'react'
import { View } from 'react-native'
import { useSettingValue } from '@/store/setting/hook'


import CheckBoxItem from '../../components/CheckBoxItem'

export default memo(() => {
  const t = useI18n()
  const isCoverSpin = useSettingValue('playDetail.isCoverSpin')
  const setIsCoverSpin = (isCoverSpin: boolean) => {
    updateSetting({ 'playDetail.isCoverSpin': isCoverSpin })
  }

  return (
    <View style={styles.content}>
      <CheckBoxItem check={isCoverSpin} label={'唱片旋转海报（关闭则显示静止海报）'} onChange={setIsCoverSpin} />
    </View>
  )
})


const styles = createStyle({
  content: {
    marginTop: 5,
  },
})
