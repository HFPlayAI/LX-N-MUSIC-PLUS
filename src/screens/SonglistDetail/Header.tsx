import { forwardRef, memo, useEffect, useImperativeHandle, useState } from 'react'
import { View } from 'react-native'
import { BorderWidths } from '@/theme'
import ButtonBar from './ActionBar'
import { useNavigationComponentDidAppear } from '@/navigation'
import { NAV_SHEAR_NATIVE_IDS } from '@/config/constant'
import { scaleSizeW } from '@/utils/pixelRatio'
import { useTheme } from '@/store/theme/hook'
import Text, { AnimatedText } from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import Image from '@/components/common/Image'
import { useListInfo } from './state'
import { useAnimateOnecNumber } from '@/utils/hooks/useAnimateNumber'
import { useStatusbarHeight } from '@/store/common/hook'
import { useHorizontalMode } from '@/utils/hooks'

const IMAGE_WIDTH = scaleSizeW(60)
// 海报固定高度 = 歌单名(14)一行 + 简介(12)三行
// 固定死高度：简介不足三行时海报也不会被压缩变形
const IMAGE_HEIGHT = Math.round(14 * 1.4 + 12 * 1.4 * 3)

const CountText = memo(({ count }: { count: string }) => {
  const [animFade] = useAnimateOnecNumber(0, 1, 250, false)
  const [animTranslateY] = useAnimateOnecNumber(10, 0, 250, false)
  return (
    <AnimatedText style={{
      ...styles.playCount,
      opacity: animFade,
      transform: [
        { translateY: animTranslateY },
      ],
    }} numberOfLines={ 1 }>{count}</AnimatedText>
  )
}, (prevProps, nextProps) => {
  return true
})

const Pic = ({ componentId, playCount, imgUrl }: {
  componentId: string
  playCount: string
  imgUrl?: string
}) => {
  const [pic, setPic] = useState(imgUrl)
  const [animated, setAnimated] = useState(false)
  const info = useListInfo()
  useEffect(() => {
    if (animated) setPic(imgUrl)
  }, [imgUrl, animated])

  useNavigationComponentDidAppear(componentId, () => {
    setAnimated(true)
  })

  return (
    <View style={{ ...styles.listItemImg, width: IMAGE_WIDTH, height: IMAGE_HEIGHT }}>
      <Image nativeID={`${NAV_SHEAR_NATIVE_IDS.songlistDetail_pic}_to_${info.id}`} url={pic} style={{ flex: 1, borderRadius: 4 }} />
      {
        playCount && animated ? <CountText count={playCount} /> : null
      }
    </View>
  )
}

export interface HeaderProps {
  componentId: string
  /** 嵌入模式（如我的网易云歌单详情）：不保留状态栏高度、返回走回调 */
  embed?: boolean
  onBack?: () => void
}

export interface HeaderType {
  setInfo: (info: DetailInfo) => void
}
export interface DetailInfo {
  name: string
  desc: string
  playCount: string
  imgUrl?: string
}

export default forwardRef<HeaderType, HeaderProps>(({ componentId, embed = false, onBack }: { componentId: string, embed?: boolean, onBack?: () => void }, ref) => {
  const statusBarHeight = useStatusbarHeight()
  const isHorizontal = useHorizontalMode()
  const theme = useTheme()
  const info = useListInfo()
  const [detailInfo, setDetailInfo] = useState<DetailInfo>({ name: '', desc: '', playCount: '', imgUrl: info.img })

  useImperativeHandle(ref, () => ({
    setInfo(info) {
      setDetailInfo(info)
    },
  }), [])

  return (
    <View style={{ ...styles.container, paddingTop: embed ? 0 : statusBarHeight, borderBottomColor: theme['c-border-background'] }}>
      {
        isHorizontal
          ? (
            /* 横屏：隐藏海报与简介，仅歌单名 + 操作按钮同行，最大化歌曲列表可视高度 */
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 6, paddingLeft: 12 }}>
              <Text size={14} numberOfLines={ 1 } style={{ flexGrow: 0, flexShrink: 1, flexBasis: 'auto', marginRight: 12 }}>{detailInfo.name}</Text>
              <ButtonBar onBack={onBack} inline />
            </View>
            )
          : (
            <>
              <View style={{ flexDirection: 'row', flexGrow: 0, flexShrink: 0, padding: 6, alignItems: 'flex-start' }}>
                <Pic componentId={componentId} playCount={detailInfo.playCount} imgUrl={detailInfo.imgUrl} />
                <View
                  style={{ flexDirection: 'column', flexGrow: 1, flexShrink: 1, paddingLeft: 8 }}
                  nativeID={NAV_SHEAR_NATIVE_IDS.songlistDetail_title}
                >
                  <Text size={14} numberOfLines={ 1 }>{detailInfo.name}</Text>
                  <View style={{ flexGrow: 0, flexShrink: 1 }}>
                    <Text size={12} color={theme['c-font-label']} numberOfLines={ 3 }>{detailInfo.desc}</Text>
                  </View>
                </View>
              </View>
              <ButtonBar onBack={onBack} />
            </>
            )
      }
      {/* <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View style={{ flexGrow: 0, flexShrink: 1, paddingTop: 5, paddingRight: 5 }}>
              <Text style={{ fontSize: 12, color: AppColors.normal20 }} numberOfLines={ 1 }>{playCount || '-'}</Text>
              <Text style={{ fontSize: 12, color: AppColors.normal30 }} numberOfLines={ 1 }>{this.props.selectListInfo.author || this.props.listDetailData.info.author}</Text>
            </View>
      </View> */}
    </View>
  )
})

const styles = createStyle({
  container: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    borderBottomWidth: BorderWidths.normal,
  },
  listItemImg: {
    // backgroundColor: '#eee',
    flexGrow: 0,
    flexShrink: 0,
    overflow: 'hidden',
    // width: 70,
    // height: 70,
    // ...Platform.select({
    //   ios: {
    //     shadowColor: '#000',
    //     shadowOffset: {
    //       width: 0,
    //       height: 1,
    //     },
    //     shadowOpacity: 0.20,
    //     shadowRadius: 1.41,
    //   },
    //   android: {
    //     elevation: 2,
    //   },
    // }),
  },
  playCount: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    fontSize: 12,
    paddingLeft: 3,
    paddingRight: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: '#fff',
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
})
