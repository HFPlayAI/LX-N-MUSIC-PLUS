import { memo, useRef } from 'react'
import { View, TouchableOpacity } from 'react-native'
// import Button from '@/components/common/Button'
import Text from '@/components/common/Text'
import Badge, { type BadgeType } from '@/components/common/Badge'
import { Icon } from '@/components/common/Icon'
import PlayingIcon from '@/components/common/PlayingIcon'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { scaleSizeH } from '@/utils/pixelRatio'
import { LIST_ITEM_HEIGHT, LIST_ITEM_HEIGHT_HORIZONTAL } from '@/config/constant'
import { createStyle, type RowInfo } from '@/utils/tools'

const ITEM_HEIGHT_VERTICAL = scaleSizeH(LIST_ITEM_HEIGHT)
// 横屏行高：固定 40，配合两列布局显示更多歌曲
const ITEM_HEIGHT_HORIZONTAL = scaleSizeH(LIST_ITEM_HEIGHT_HORIZONTAL)
export const ITEM_HEIGHT = ITEM_HEIGHT_VERTICAL

const useQualityTag = (musicInfo: LX.Music.MusicInfoOnline) => {
  const t = useI18n()
  let info: { type: BadgeType | null, text: string } = { type: null, text: '' }
  // 容错：异常数据可能缺失 meta._qualitys
  const qualitys = (musicInfo.meta as any)?._qualitys ?? {}
  if (qualitys.flac24bit) {
    info.type = 'secondary'
    info.text = t('quality_lossless_24bit')
  } else if (qualitys.flac ?? qualitys.ape) {
    info.type = 'secondary'
    info.text = t('quality_lossless')
  } else if (qualitys['320k']) {
    info.type = 'tertiary'
    info.text = t('quality_high_quality')
  }

  return info
}

export default memo(({ item, index, showSource, onPress, onLongPress, onShowMenu, selectedList, rowInfo, isShowAlbumName, isShowInterval, playingId }: {
  item: LX.Music.MusicInfoOnline
  index: number
  showSource?: boolean
  onPress: (item: LX.Music.MusicInfoOnline, index: number) => void
  onLongPress: (item: LX.Music.MusicInfoOnline, index: number) => void
  onShowMenu: (item: LX.Music.MusicInfoOnline, index: number, position: { x: number, y: number, w: number, h: number }) => void
  selectedList: LX.Music.MusicInfoOnline[]
  rowInfo: RowInfo
  isShowAlbumName: boolean
  isShowInterval: boolean
  playingId?: string | null
}) => {
  const theme = useTheme()
  // 方向由列表 mount 时锁定的 rowInfo 提供，与 getItemLayout 用同一份布局信息
  const itemHeight = rowInfo.isHorizontal ? ITEM_HEIGHT_HORIZONTAL : ITEM_HEIGHT_VERTICAL

  const isSelected = selectedList.includes(item)
  const isPlaying = playingId != null && playingId === item.id

  const moreButtonRef = useRef<TouchableOpacity>(null)
  const handleShowMenu = () => {
    if (moreButtonRef.current?.measure) {
      moreButtonRef.current.measure((fx, fy, width, height, px, py) => {
        // console.log(fx, fy, width, height, px, py)
        onShowMenu(item, index, { x: Math.ceil(px), y: Math.ceil(py), w: Math.ceil(width), h: Math.ceil(height) })
      })
    }
  }
  const tagInfo = useQualityTag(item)

  const singer = `${item.singer}${isShowAlbumName && item.meta.albumName ? ` · ${item.meta.albumName}` : ''}`

  return (
    <View style={{ ...styles.listItem, width: rowInfo.rowWidth, height: itemHeight, backgroundColor: isSelected || isPlaying ? theme['c-primary-background-hover'] : 'rgba(0,0,0,0)' }}>
      <TouchableOpacity style={styles.listItemLeft} onPress={() => { onPress(item, index) }} onLongPress={() => { onLongPress(item, index) }}>
        <View style={styles.sn}>
          {isPlaying ? <PlayingIcon color={theme['c-primary-font']} /> : <Text style={styles.snText} size={13} color={theme['c-300']}>{index + 1}</Text>}
        </View>
        <View style={styles.itemInfo}>
          <Text numberOfLines={1} color={isPlaying ? theme['c-primary-font'] : theme['c-font']}>{item.name}</Text>
          <View style={styles.listItemSingle}>
            { tagInfo.type ? <Badge type={tagInfo.type}>{tagInfo.text}</Badge> : null }
            { showSource ? <Badge type="tertiary">{item.source}</Badge> : null }
            <Text style={styles.listItemSingleText} size={11} color={isPlaying ? theme['c-primary-alpha-200'] : theme['c-500']} numberOfLines={1}>{singer}</Text>
          </View>
        </View>
        {
          isShowInterval ? (
            <Text size={12} color={isPlaying ? theme['c-primary-alpha-200'] : theme['c-250']} numberOfLines={1}>{item.interval}</Text>
          ) : null
        }
      </TouchableOpacity>
     <TouchableOpacity onPress={handleShowMenu} ref={moreButtonRef} style={styles.moreButton}>
        <Icon name="dots-vertical" style={{ color: theme['c-350'] }} size={12} />
      </TouchableOpacity>
    </View>
  )
}, (prevProps, nextProps) => {
  return !!(prevProps.item === nextProps.item &&
    prevProps.index === nextProps.index &&
    prevProps.rowInfo === nextProps.rowInfo &&
    prevProps.isShowAlbumName === nextProps.isShowAlbumName &&
    prevProps.isShowInterval === nextProps.isShowInterval &&
    prevProps.playingId === nextProps.playingId &&
    nextProps.selectedList.includes(nextProps.item) == prevProps.selectedList.includes(nextProps.item)
  )
})

const styles = createStyle({
  listItem: {
    // width: '100%',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    // paddingLeft: 10,
    paddingRight: 2,
    alignItems: 'center',
    // borderBottomWidth: BorderWidths.normal,
  },
  listItemLeft: {
    flex: 1,
    flexGrow: 1,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sn: {
    width: 38,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 3,
    paddingRight: 3,
  },
  snText: {
    textAlign: 'center',
  },
  itemInfo: {
    flexGrow: 1,
    flexShrink: 1,
    paddingRight: 2,
    // paddingTop: 10,
    // paddingBottom: 10,
  },
  // listItemTitle: {
  //   // backgroundColor: 'rgba(0,0,0,0.2)',
  //   flexGrow: 0,
  //   flexShrink: 1,
  //   // fontSize: 15,
  // },
  listItemSingle: {
    paddingTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    // alignItems: 'flex-end',
    // backgroundColor: 'rgba(0,0,0,0.2)',
  },
  listItemTimeLabel: {
    marginRight: 5,
    fontWeight: '400',
  },
  listItemSingleText: {
    // fontSize: 13,
    // paddingTop: 2,
    flexGrow: 0,
    flexShrink: 1,
    fontWeight: '300',
  },
  listItemBadge: {
    // fontSize: 10,
    paddingLeft: 5,
    paddingTop: 2,
    alignSelf: 'flex-start',
  },
  listItemRight: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 'auto',
    justifyContent: 'center',
  },
  moreButton: {
    height: '80%',
    paddingLeft: 16,
    paddingRight: 16,
    // paddingTop: 10,
    // paddingBottom: 10,
    // backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
  },
})

