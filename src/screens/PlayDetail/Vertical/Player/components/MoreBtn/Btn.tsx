import { TouchableOpacity } from 'react-native'
import { Icon } from '@/components/common/Icon'
import { createStyle } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeW } from '@/utils/pixelRatio'
import { forwardRef } from 'react'

export const BTN_WIDTH = scaleSizeW(36)
export const BTN_ICON_SIZE = 24

// 支持 ref 转发（用于弹出定位菜单，参考C项目）
const Btn = forwardRef<TouchableOpacity, {
  icon: string
  color?: string
  onPress: () => void
  onLongPress?: () => void
}>(({ icon, color, onPress, onLongPress }, ref) => {
  const theme = useTheme()
  return (
    <TouchableOpacity ref={ref} style={{ ...styles.cotrolBtn, width: BTN_WIDTH, height: BTN_WIDTH }} activeOpacity={0.5} onPress={onPress} onLongPress={onLongPress}>
      <Icon name={icon} color={color ?? theme['c-font-label']} size={BTN_ICON_SIZE} />
    </TouchableOpacity>
  )
})

export default Btn

const styles = createStyle({
  cotrolBtn: {
    marginLeft: 5,
    justifyContent: 'center',
    alignItems: 'center',

    // backgroundColor: '#ccc',
    shadowOpacity: 1,
    textShadowRadius: 1,
  },
})
