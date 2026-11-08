import { memo, useEffect, useRef, useState, useCallback } from 'react'
import { View, TouchableOpacity, FlatList, Image, RefreshControl } from 'react-native'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import OnlineList, { type OnlineListType } from '@/components/OnlineList'
import MusicList, { type MusicListType } from '@/screens/SonglistDetail/MusicList'
import { ListInfoContext } from '@/screens/SonglistDetail/state'
import { type ListInfoItem } from '@/store/songlist/state'
import Text from '@/components/common/Text'
import { Icon } from '@/components/common/Icon'
import { createStyle, toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import { useI18n } from '@/lang'
import { handlePlay } from '@/screens/SonglistDetail/listAction'
import { getListDetail } from '@/core/songlist'
import musicSdk from '@/utils/musicSdk'
import { toNewMusicInfo } from '@/utils'
import { useWyUserState } from '@/store/user/hook'
import { useSettingValue } from '@/store/setting/hook'
import { usePlayerMusicInfo } from '@/store/player/hook'
import {
  getWyDailyRecCache,
  saveWyDailyRecCache,
  getWyPlaylistsCache,
  saveWyPlaylistsCache,
  getWyPlaylistSongsCache,
  saveWyPlaylistSongsCache,
} from '@/utils/data'
import { BorderWidths, BorderRadius } from '@/theme'

export type MyNeteaseTabId = 'dailyRec' | 'playlists'

const TABS: Array<{ id: MyNeteaseTabId }> = [
  { id: 'dailyRec' },
  { id: 'playlists' },
]

// ============ 歌曲列表 Tab（每日推荐 / 风格化推荐） ============

const SongTab = memo(({ type, componentId, onCookieStateChange }: { type: 'dailyRec', componentId?: string, onCookieStateChange?: (invalid: boolean) => void }) => {
  const listRef = useRef<OnlineListType>(null)
  const songsRef = useRef<LX.Music.MusicInfoOnline[]>([])
  const cookie = useSettingValue('common.wy_cookie')
  const theme = useTheme()
  const playerMusicInfo = usePlayerMusicInfo()
  // 「播放全部」按钮仅在歌曲列表成功获取后显示
  const [hasList, setHasList] = useState(false)
  // 从未获取过 cookie（无缓存数据兜底时）才提示登录
  const [noLogin, setNoLogin] = useState(false)

  useEffect(() => {
    if (!cookie) {
      setNoLogin(true)
      setHasList(false)
      return
    }
    setNoLogin(false)
    listRef.current?.setStatus('loading')
    setHasList(false)
    const api = musicSdk.wy.dailyRec.getList(cookie)
    api.then((result: { list: any[] }) => {
      // musicSdk 输出为旧格式（无 meta），必须转换为 UI 所需的新格式
      const list = result.list.map(m => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]
      songsRef.current = list
      listRef.current?.setList(list)
      listRef.current?.setStatus('end')
      setHasList(list.length > 0)
      // 成功数据写入缓存（cookie 失效时离线兜底）
      void saveWyDailyRecCache(list)
      onCookieStateChange?.(false)
    }).catch(async(err: Error) => {
      // cookie 失效等加载失败：回退到本地缓存填充列表（有缓存时不再弹错误提示）
      const cache = await getWyDailyRecCache().catch(() => null)
      if (cache?.list?.length) {
        songsRef.current = cache.list
        listRef.current?.setList(cache.list)
        listRef.current?.setStatus('end')
        setHasList(true)
      } else {
        toast(err.message)
        listRef.current?.setStatus('error')
        setHasList(false)
      }
      onCookieStateChange?.(true)
    })
  }, [cookie, type, onCookieStateChange])

  const handlePlayList = useCallback((index: number) => {
    void handlePlay(type, 'wy', songsRef.current, index)
  }, [type])

  const handlePlayAll = useCallback(() => {
    if (!songsRef.current.length) {
      toast('歌曲列表尚未加载完成')
      return
    }
    void handlePlay(type, 'wy', songsRef.current, 0)
  }, [type])

  return (
    <View style={styles.songTabContent}>
      {
        noLogin
          ? (
            <View style={styles.center}>
              <Text color={theme['c-font-label']}>请先登录网易云</Text>
            </View>
            )
          : (
            <>
              {
                hasList
                  ? (
                    <TouchableOpacity style={{ ...styles.playAllBtn, backgroundColor: theme['c-button-background'] }} onPress={handlePlayAll}>
                      <Text size={13} color={theme['c-button-font']}>{'▶ 播放全部'}</Text>
                    </TouchableOpacity>
                    )
                  : null
              }
              <OnlineList ref={listRef} componentId={componentId} playingId={playerMusicInfo.id} onPlayList={handlePlayList} onRefresh={() => { listRef.current?.setStatus('end') }} onLoadMore={() => { listRef.current?.setStatus('end') }} />
            </>
            )
      }
    </View>
  )
})

// ============ 歌单 / 歌手 / 专辑 Tab ============

interface ItemInfo {
  id: string
  name: string
  img: string
  sub: string
  kind: 'playlist' | 'artist' | 'album' | 'playlists' | 'artists' | 'albums'
  raw: any
}

const ItemCard = ({ item, onPress }: { item: ItemInfo, onPress: (item: ItemInfo) => void }) => {
  const theme = useTheme()
  return (
    <TouchableOpacity style={styles.card} onPress={() => { onPress(item) }}>
      {
        item.img
          ? <Image source={{ uri: item.img }} style={styles.cardImg} />
          : <View style={{ ...styles.cardImg, backgroundColor: theme['c-border-background'] }}><Icon name="music_album" size={22} color={theme['c-font-label']} /></View>
      }
      <View style={styles.cardText}>
        <Text size={13} numberOfLines={1}>{item.name}</Text>
        <Text size={11} color={theme['c-font-label']} numberOfLines={1}>{item.sub}</Text>
      </View>
    </TouchableOpacity>
  )
}

const InfoTab = ({ kind, onOpenDetail, onCookieStateChange }: { kind: 'playlists', onOpenDetail: (info: any) => void, onCookieStateChange?: (invalid: boolean) => void }) => {
  const theme = useTheme()
  const { wy_uid, wy_profile } = useWyUserState()
  const cookie = useSettingValue('common.wy_cookie')
  const [items, setItems] = useState<ItemInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // 本地缓存的歌单列表（cookie 失效 / 未登录时兜底展示）
  const [cacheItems, setCacheItems] = useState<ItemInfo[]>([])
  const [hasCache, setHasCache] = useState(false)

  useEffect(() => {
    void getWyPlaylistsCache().then((cache) => {
      if (cache?.playlists?.length) {
        setCacheItems(cache.playlists)
        setHasCache(true)
      }
    }).catch(() => {})
  }, [])

  useEffect(() => {
    const loadData = async() => {
      if (!cookie || !wy_uid) {
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        if (kind === 'playlists') {
          const playlists = await musicSdk.wy.user.getUserPlaylists(wy_uid, cookie)
          const mapped = (playlists as any[]).map((p: any) => ({
            id: String(p.id),
            name: p.name,
            img: p.coverImgUrl,
            sub: `${p.trackCount}首 · ${p.playCount ?? 0}次播放`,
            kind: 'playlist' as const,
            raw: p,
          }))
          setItems(mapped)
          // 成功数据写入缓存（cookie 失效时离线兜底）
          void saveWyPlaylistsCache(mapped)
          onCookieStateChange?.(false)
        } else if (kind === 'artists') {
          const result = await musicSdk.wy.user.getSublist()
          setItems(((result.artists ?? []) as any[]).map((a: any) => ({
            id: String(a.id),
            name: a.name,
            img: a.picUrl ?? a.img1v1Url,
            sub: `专辑 ${String(a.albumSize ?? 0)} · 音乐 ${String(a.musicSize ?? 0)}`,
            kind,
            raw: a,
          })))
        } else {
          const result = await musicSdk.wy.user.getSubAlbumList()
          setItems(((result.albums ?? []) as any[]).map((a: any) => ({
            id: String(a.id),
            name: a.name,
            img: a.picUrl,
            sub: (a.artists ?? []).map((x: any) => x.name).join(' / '),
            kind,
            raw: a,
          })))
        }
      } catch (err: any) {
        // 有缓存兜底时不再弹错误提示（避免 cookie 失效时反复弹 try max num）
        if (!hasCache) toast(String(err?.message ?? '加载失败'))
        // cookie 失效等加载失败：提示横幅（缓存兜底由渲染层的 cacheItems 处理）
        onCookieStateChange?.(true)
      } finally {
        setLoading(false)
      }
    }
    void loadData()
  }, [kind, cookie, wy_uid, wy_profile, onCookieStateChange])

  // 下拉刷新（与每日推荐一致）
  const handleRefresh = useCallback(async() => {
    if (!cookie || !wy_uid) return
    setRefreshing(true)
    try {
      if (kind === 'playlists') {
        const playlists = await musicSdk.wy.user.getUserPlaylists(wy_uid, cookie)
        const mapped = (playlists as any[]).map((p: any) => ({
          id: String(p.id),
          name: p.name,
          img: p.coverImgUrl,
          sub: `${p.trackCount}首 · ${p.playCount ?? 0}次播放`,
          kind: 'playlist' as const,
          raw: p,
        }))
        setItems(mapped)
        void saveWyPlaylistsCache(mapped)
        onCookieStateChange?.(false)
      } else if (kind === 'artists') {
        const result = await musicSdk.wy.user.getSublist()
        setItems(((result.artists ?? []) as any[]).map((a: any) => ({
          id: String(a.id),
          name: a.name,
          img: a.picUrl ?? a.img1v1Url,
          sub: `专辑 ${String(a.albumSize ?? 0)} · 音乐 ${String(a.musicSize ?? 0)}`,
          kind,
          raw: a,
        })))
      } else {
        const result = await musicSdk.wy.user.getSubAlbumList()
        setItems(((result.albums ?? []) as any[]).map((a: any) => ({
          id: String(a.id),
          name: a.name,
          img: a.picUrl,
          sub: (a.artists ?? []).map((x: any) => x.name).join(' / '),
          kind,
          raw: a,
        })))
      }
    } catch (err: any) {
      // 有缓存/已有数据时静默（cookie 失效时避免反复弹 try max num）
      if (!hasCache && !items.length) toast(String(err?.message ?? '刷新失败'))
      onCookieStateChange?.(true)
    } finally {
      setRefreshing(false)
    }
  }, [kind, cookie, wy_uid, onCookieStateChange])

  const handlePress = (item: ItemInfo) => {
    // 歌单在主窗口内打开详情（导航栏/播放栏保持常驻），不再 push 独立路由
    if (onOpenDetail) {
      onOpenDetail({
        id: item.id,
        source: 'wy',
        name: item.name,
        img: item.img,
        author: item.raw?.creator?.nickname ?? '',
        desc: item.raw?.description ?? '',
        play_count: String(item.raw?.playCount ?? ''),
      })
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <Text color={theme['c-font-label']}>loading...</Text>
      </View>
    )
  }
  // 未登录（从未获取过 cookie）且无缓存时才提示登录；有缓存则用缓存填充列表
  if (!cookie || !wy_uid) {
    if (hasCache && cacheItems.length) {
      return (
        <FlatList
          data={cacheItems}
          keyExtractor={item => item.id}
          renderItem={({ item }) => <ItemCard item={item} onPress={handlePress} />}
          contentContainerStyle={styles.listContent}
        />
      )
    }
    return (
      <View style={styles.center}>
        <Text color={theme['c-font-label']}>请先登录网易云</Text>
      </View>
    )
  }
  // cookie 失效等加载失败时用缓存兜底展示
  const displayItems = items.length ? items : cacheItems
  return (
    <FlatList
      data={displayItems}
      keyExtractor={item => item.id}
      renderItem={({ item }) => <ItemCard item={item} onPress={handlePress} />}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme['c-primary-font']}
          colors={[theme['c-primary-font']]}
          progressBackgroundColor={theme['c-content-background']}
        />
      }
    />
  )
}

// ============ 主界面 ============

/**
 * 后台全量缓存歌单歌曲：首屏只加载第一页（30首），
 * 这里直接调 musicSdk 整单拉取（单次最多1000首）覆盖缓存，
 * 使 cookie 失效时歌单内歌曲完整可用
 */
const cacheFullPlaylistSongs = async(playlistId: string) => {
  try {
    const detail = await musicSdk.wy.songList.getListDetail(playlistId, 1)
    const list = (detail?.list ?? []).map((m: any) => toNewMusicInfo(m)) as LX.Music.MusicInfoOnline[]
    if (list.length) await saveWyPlaylistSongsCache(playlistId, list)
  } catch { /* 首屏数据已缓存，静默失败 */ }
}

export default ({ componentId }: { componentId?: string }) => {
  const t = useI18n()
  const theme = useTheme()
  const pagerRef = useRef<PagerView>(null)
  const [activeId, setActiveId] = useState<MyNeteaseTabId>('dailyRec')
  const [detailInfo, setDetailInfo] = useState<ListInfoItem | null>(null)
  const detailListRef = useRef<MusicListType>(null)
  const playerMusicInfo = usePlayerMusicInfo()
  // cookie 失效横幅（网络加载失败且使用缓存兜底时显示）
  const { wy_profile } = useWyUserState()
  const [cookieInvalid, setCookieInvalid] = useState(false)

  // 重新登录后清除失效提示
  useEffect(() => {
    if (wy_profile) setCookieInvalid(false)
  }, [wy_profile])

  // 进入/切出歌单详情时加载列表
  useEffect(() => {
    if (detailInfo) {
      requestAnimationFrame(() => {
        detailListRef.current?.loadList(detailInfo.source, detailInfo.id)
      })
    }
  }, [detailInfo])


  const handlePageSelected = (e: PagerViewOnPageSelectedEvent) => {
    setActiveId(TABS[e.nativeEvent.position]?.id ?? 'dailyRec')
  }

  const handleTabPress = (id: MyNeteaseTabId) => {
    setActiveId(id)
    pagerRef.current?.setPage(TABS.findIndex(tab => tab.id === id))
  }

  // 歌单详情：嵌在主窗口内，MusicList 自带歌单信息头（封面+歌单名+收藏/播放全部/返回按钮行）
  // 不再重复显示「我的网易云」标题与Tab栏；「返回」回到我的歌单主页
  if (detailInfo) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <ListInfoContext.Provider value={detailInfo}>
            <MusicList
              ref={detailListRef}
              componentId={componentId}
              detailHost="home"
              playingId={playerMusicInfo.id}
              embed
              onBack={() => { setDetailInfo(null) }}
              onListLoaded={(list) => {
                // 成功数据写入缓存（cookie 失效时离线兜底）
                void saveWyPlaylistSongsCache(detailInfo.id, list)
                setCookieInvalid(false)
                // 后台拉取整单歌曲覆盖缓存（首屏仅第一页 30 首）
                void cacheFullPlaylistSongs(detailInfo.id)
              }}
              loadFallback={() => getWyPlaylistSongsCache(detailInfo.id).then(c => c?.list ?? null)}
              onLoadError={() => { setCookieInvalid(true) }}
            />
          </ListInfoContext.Provider>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* 页面标题由 Home 顶栏统一显示，不再重复渲染「我的网易云」标题 */}
      <View style={{ ...styles.tabBar, borderBottomColor: theme['c-border-background'] }}>
        {
          TABS.map(tab => (
            <TouchableOpacity key={tab.id} style={[styles.tabBtn, activeId === tab.id && { ...styles.tabBtnActive, backgroundColor: theme['c-primary-background-active'] }]} onPress={() => { handleTabPress(tab.id) }}>
              <Text size={13} color={activeId === tab.id ? theme['c-primary-font'] : theme['c-font']}>{t(`my_netease_tab_${tab.id}`)}</Text>
            </TouchableOpacity>
          ))
        }
        {
          cookieInvalid
            ? (
              <Text size={12} color={theme['c-font-label']} numberOfLines={1} style={styles.cookieTip}>
                当前网易云cookie已失效，请重新登录
              </Text>
              )
            : null
        }
      </View>
      <View style={styles.content}>
        {/* initialPage 动态取当前 Tab：从歌单详情返回重挂载时恢复到进入前的 Tab（如「我的歌单」） */}
        <PagerView ref={pagerRef} style={styles.pager} initialPage={Math.max(0, TABS.findIndex(tab => tab.id === activeId))} onPageSelected={handlePageSelected}>
          <View key="dailyRec"><SongTab type="dailyRec" componentId={componentId} onCookieStateChange={setCookieInvalid} /></View>
          <View key="playlists"><InfoTab kind="playlists" onOpenDetail={setDetailInfo} onCookieStateChange={setCookieInvalid} /></View>
        </PagerView>
      </View>
    </View>
  )
}

const styles = createStyle({
  container: {
    flex: 1,
  },
  songTabContent: {
    flex: 1,
  },
  playAllBtn: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 10,
    marginTop: 6,
    marginBottom: 2,
  },
  tabBar: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderBottomWidth: BorderWidths.normal,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.normal,
    marginRight: 8,
  },
  tabBtnActive: {},
  cookieTip: {
    flex: 1,
    textAlign: 'right',
    paddingHorizontal: 8,
  },
  content: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  cardImg: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 4,
    marginRight: 12,
  },
  cardText: {
    flex: 1,
  },
})
