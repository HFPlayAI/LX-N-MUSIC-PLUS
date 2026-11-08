import { useCallback, useEffect, useRef } from 'react'
import { View, StyleSheet } from 'react-native'

import { useHomeDetailStack } from '@/store/common/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import { useTheme } from '@/store/theme/hook'
import commonAction from '@/store/common/action'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { ListInfoContext } from '@/screens/SonglistDetail/state'
import MusicList, { type MusicListType } from '@/screens/SonglistDetail/MusicList'
import ArtistDetail from '@/screens/ArtistDetail'
import AlbumDetail from '@/screens/AlbumDetail'
import { createStyle } from '@/utils/tools'
import { type ListInfoItem } from '@/store/songlist/state'
import { type DetailHostType } from '@/store/common/state'

// 歌单详情条目：需在挂载后触发列表加载（MusicList 的 loadList 为命令式API）
const SonglistEntry = ({ info, host, onBack }: { info: ListInfoItem, host: DetailHostType, onBack: () => void }) => {
  const listRef = useRef<MusicListType>(null)
  const playerMusicInfo = usePlayerMusicInfo()

  useEffect(() => {
    requestAnimationFrame(() => {
      listRef.current?.loadList(info.source, info.id)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <ListInfoContext.Provider value={info}>
      <MusicList ref={listRef} playingId={playerMusicInfo.id} embed detailHost={host} onBack={onBack} />
    </ListInfoContext.Provider>
  )
}

/**
 * 统一的详情层（歌手详情 / 专辑详情 / 歌单详情 共用同一组件与交互）
 * - host = 'home'：宿主为主窗口，详情覆盖内容区，保留侧边导航 / 顶栏
 * - host = 'playDetail'：宿主为播放页，详情覆盖播放器，返回即回到播放器
 * 该层使用不透明背景；宿主在详情打开时应隐藏自身内容（见各宿主对 useHomeDetailStack 的读取），
 * 否则 Android 原生 PagerView / 全屏列表会因原生层叠顺序穿透显示，造成“与宿主页面重叠”。
 */
export default ({ host, onBack }: {
  host: DetailHostType
  // 由宿主提供的返回动作（默认弹出该宿主栈顶）
  onBack?: () => void
}) => {
  const stack = useHomeDetailStack(host)
  const theme = useTheme()

  const handleBack = useCallback(() => {
    if (onBack) onBack()
    else commonAction.popHomeDetail(host)
  }, [host, onBack])

  // 硬件返回：该宿主栈非空时逐层弹出并消费事件
  useBackHandler(useCallback(() => {
    if (!stack.length) return false
    handleBack()
    return true
  }, [stack.length, handleBack]))

  const top = stack[stack.length - 1]
  if (!top) return null

  switch (top.type) {
    case 'songlist':
      return (
        <View style={{ ...styles.container, backgroundColor: theme['c-main-background'] }} key={top.id}>
          <SonglistEntry info={top.info} host={host} onBack={handleBack} />
        </View>
      )
    case 'artist':
      return (
        <View style={{ ...styles.container, backgroundColor: theme['c-main-background'] }} key={top.id}>
          <ArtistDetail info={top.info} embed host={host} onBack={handleBack} />
        </View>
      )
    case 'album':
      return (
        <View style={{ ...styles.container, backgroundColor: theme['c-main-background'] }} key={top.id}>
          <AlbumDetail info={top.info} embed host={host} onBack={handleBack} />
        </View>
      )
    default:
      return null
  }
}

const styles = createStyle({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
})
