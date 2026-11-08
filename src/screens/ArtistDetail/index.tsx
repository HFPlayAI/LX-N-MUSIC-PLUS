import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Image, TouchableOpacity } from 'react-native'
import PageContent from '@/components/PageContent'
import StatusBar from '@/components/common/StatusBar'
import PlayerBar from '@/components/player/PlayerBar'
import OnlineList, { type OnlineListType } from '@/components/OnlineList'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import { type DetailHostType } from '@/store/common/state'
import { handlePlay } from '@/screens/SonglistDetail/listAction'
import { getArtistDetail } from '@/utils/musicSdk/detail'
import { toNewMusicInfo } from '@/utils'
import { BorderWidths, BorderRadius } from '@/theme'
import { useHorizontalMode } from '@/utils/hooks'

export interface ArtistDetailParams {
  id: string
  name: string
  img?: string
  raw?: any
  source?: LX.OnlineSource
}

// 海报固定高度 = 歌手名(16)一行 + 简介(11/lineHeight15)三行 + 间距
// 固定死高度：简介不足三行时海报也不会被压缩变形
const POSTER_HEIGHT = Math.round(16 * 1.4 + 3 + 15 * 3)

export default ({ componentId, info, embed = false, onBack, host }: { componentId?: string, info: ArtistDetailParams, embed?: boolean, onBack?: () => void, host?: DetailHostType }) => {
  const theme = useTheme()
  const isHorizontal = useHorizontalMode()
  const listRef = useRef<OnlineListType>(null)
  const songsRef = useRef<LX.Music.MusicInfoOnline[]>([])
  const [detail, setDetail] = useState<{ name: string, img: string, desc: string, author: string } | null>(null)
  const source = info.source ?? 'wy'

  useEffect(() => {
    // 仅作为独立 RNN 页面时注册组件ID；内嵌模式跳过（避免覆盖全局注册）
    if (componentId) setComponentId(COMPONENT_IDS.songlistDetail, componentId)
  }, [componentId])

  useEffect(() => {
    listRef.current?.setStatus('loading')
    getArtistDetail(source, { id: info.id, name: info.name }).then(result => {
      setDetail(result.info)
      songsRef.current = result.list.map((m: any) => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]
      listRef.current?.setList(songsRef.current)
      listRef.current?.setStatus(result.hasMore ? 'idle' : 'end')
    }).catch((err: Error) => {
      toast(err.message)
      listRef.current?.setStatus('error')
    })
  }, [info.id, info.name, source])

  // 按名搜索降级时 id 为空，用名称补齐，避免不同歌手共用同一个临时列表 id
  const listKey = `artist_${source}_${info.id || info.name}`
  const handlePlayList = useCallback((index: number) => {
    void handlePlay(listKey, source, songsRef.current, index)
  }, [listKey, source])

  const handlePlayAll = useCallback(() => {
    if (!songsRef.current.length) {
      toast('歌曲列表尚未加载完成')
      return
    }
    void handlePlay(listKey, source, songsRef.current, 0)
  }, [listKey, source])

  const avatar = info.img ?? detail?.img ?? ''

  // 返回 / 播放全部按钮：竖屏独占一行，横屏与歌手名同行
  const actionBtns = embed && onBack
    ? (
      <>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme['c-primary-background-active'] }]} onPress={onBack}>
          <Icon name="chevron-left" size={14} color={theme['c-primary-font']} style={styles.backIcon} />
          <Text size={12} color={theme['c-primary-font']}>返回</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.playAllBtn, { backgroundColor: theme['c-primary-background-active'] }]} onPress={handlePlayAll}>
          <Text size={12} color={theme['c-primary-font']}>{'▶ 播放全部'}</Text>
        </TouchableOpacity>
      </>
      )
    : null

  const content = (
    <View style={styles.contentWrap}>
      <View style={[styles.header, { backgroundColor: theme['c-content-background'], borderBottomColor: theme['c-border-background'] }]}>
        {
          isHorizontal
            ? (
              /* 横屏：隐藏海报与简介，仅歌手名 + 按钮同行，最大化歌曲列表可视高度 */
              <View style={styles.compactRow}>
                <Text size={14} numberOfLines={1} style={styles.compactName}>{info.name}</Text>
                {actionBtns}
              </View>
              )
            : (
              <>
                <View style={styles.infoRow}>
                  <View style={styles.leftCol}>
                    {
                      avatar
                        ? <Image source={{ uri: avatar }} style={styles.avatar} />
                        : <View style={[styles.avatar, { backgroundColor: theme['c-border-background'] }]} />
                    }
                  </View>
                  <View style={styles.headerInfo}>
                    <Text size={16} numberOfLines={1}>{info.name}</Text>
                    {
                      detail?.desc
                        ? <Text size={11} color={theme['c-font-label']} numberOfLines={3} style={styles.desc}>{detail.desc}</Text>
                        : null
                    }
                  </View>
                </View>
                {actionBtns ? <View style={styles.btnRow}>{actionBtns}</View> : null}
              </>
              )
        }
      </View>
      <View style={styles.content}>
        <OnlineList ref={listRef} componentId={componentId} detailHost={host} onPlayList={handlePlayList} onRefresh={() => { listRef.current?.setStatus('end') }} onLoadMore={() => { listRef.current?.setStatus('end') }} />
      </View>
    </View>
  )

  if (embed) return content

  return (
    <PageContent>
      <StatusBar />
      {content}
      <PlayerBar />
    </PageContent>
  )
}

const styles = createStyle({
  contentWrap: {
    flex: 1,
  },
  header: {
    paddingTop: 6,
    paddingBottom: 6,
    paddingHorizontal: 12,
    borderBottomWidth: BorderWidths.normal,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  backIcon: {
    marginRight: 3,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.normal,
    marginRight: 10,
  },
  playAllBtn: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: BorderRadius.normal,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  // 横屏紧凑头部：歌手名与操作按钮同行（按钮紧贴名称，不留大间距）
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactName: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: 'auto',
    marginRight: 12,
  },
  leftCol: {
    marginRight: 12,
  },
  avatar: {
    // 固定高度 = 歌手名一行 + 简介三行（简介不足三行时也不变形）
    width: 64,
    height: POSTER_HEIGHT,
    borderRadius: BorderRadius.normal,
  },
  headerInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  desc: {
    marginTop: 3,
    lineHeight: 15,
  },
  content: {
    flex: 1,
  },
})
