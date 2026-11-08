import { LIST_IDS, COMPONENT_IDS } from '@/config/constant'
import { addListMusics, updateListMusics } from '@/core/list'
import { playList, playNext } from '@/core/player/player'
import { addTempPlayList } from '@/core/player/tempPlayList'
import settingState from '@/store/setting/state'
import { getListMusicSync } from '@/utils/listManage'
import listState from '@/store/list/state'
import { confirmDialog, openUrl, toast } from '@/utils/tools'
import { addDislikeInfo, hasDislike } from '@/core/dislikeList'
import playerState from '@/store/player/state'
import musicSdk from '@/utils/musicSdk'
import { toOldMusicInfo } from '@/utils'
import { clearMusicUrlByMusic } from '@/utils/data'
import commonState from '@/store/common/state'
import { type DetailHostType } from '@/store/common/state'
import commonAction from '@/store/common/action'
import userState from '@/store/user/state'
import { addWyLikedSong, removeWyLikedSong } from '@/store/user/action'
import wyApi from '@/utils/musicSdk/wy/user'
import { getMvUrl } from '@/utils/musicSdk/wy/mv'
import musicDetailApi from '@/utils/musicSdk/wy/musicDetail'
import { resolveTxSingerId, rememberTxSingerId } from '@/utils/musicSdk/singerId'

// ======== 以下增强功能参考 C 项目 souvenp/lx-netease-music-mobile ========

// 判断调用来源所在的详情宿主：播放页 -> 'playDetail'，其余（主窗口/框架内页面）-> 'home'
// componentId 为空或等于主窗口 componentId 时，视为框架内（home）
const resolveDetailHost = (componentId?: string): DetailHostType => {
  if (componentId && componentId === commonState.componentIds[COMPONENT_IDS.playDetail]) return 'playDetail'
  return 'home'
}
export const handleShowAlbumDetail = (componentId: string | undefined, musicInfo: LX.Music.MusicInfoOnline) => {
  const meta = musicInfo.meta as any
  const albumId = meta?.albumId ?? (musicInfo.source === 'tx' ? meta?.albumMid : null)
  const albumName = String(meta?.albumName ?? '')
  // 没有专辑 ID 时仍允许打开：详情页会用专辑名搜索兜底
  if (!albumId && !albumName) {
    toast('专辑信息不存在')
    return
  }
  const albumInfo = {
    id: albumId == null ? '' : String(albumId),
    name: albumName,
    author: musicInfo.singer,
    img: meta?.picUrl,
    source: musicInfo.source as LX.OnlineSource,
    raw: meta?.albumInfo,
  }
  commonAction.pushHomeDetail({ type: 'album', info: albumInfo }, resolveDetailHost(componentId))
}

/** 把反查到的 singerId 写回所有含这首歌的列表，老歌曲点开一次后就永久带上 ID */
const persistSingerId = (listId: string | undefined, musicInfo: LX.Music.MusicInfoOnline, singerId: string) => {
  const listIds = new Set<string>(listState.allList.map(l => l.id))
  if (listId) listIds.add(listId)
  const updates: Array<{ id: string, musicInfo: LX.Music.MusicInfo }> = []
  for (const id of listIds) {
    const target = getListMusicSync(id).find(m => m.id === musicInfo.id)
    if (target) {
      // 列表里的歌曲对象是内存引用，补上字段后再交给 updateListMusics 落盘
      Object.assign(target.meta, { singerId })
      updates.push({ id, musicInfo: target })
    }
  }
  // 歌曲只在内存里（例如临时列表尚未入 allList）时，至少把当前列表这份补上
  if (!updates.length && listId) {
    Object.assign(musicInfo.meta, { singerId })
    updates.push({ id: listId, musicInfo })
  }
  if (updates.length) void updateListMusics(updates).catch(() => {})
}

export const handleShowArtistDetail = async(componentId: string | undefined, musicInfo: LX.Music.MusicInfoOnline, listId?: string) => {
  const meta = musicInfo.meta as any
  const host = resolveDetailHost(componentId)
  const source = musicInfo.source as LX.OnlineSource
  const firstSingerName = String(musicInfo.singer ?? '').split(/[、,，/&]/)[0].trim()

  const openArtist = (id: string, name: string) => {
    // id 为空时详情页会按歌手名搜索降级（kw 歌手详情及旧数据均走此路径）
    commonAction.pushHomeDetail({ type: 'artist', info: { id, name, source } }, host)
  }

  // 网易云：优先用歌曲自带的歌手数组，多歌手时弹选择器
  if (source === 'wy') {
    let artists: Array<{ id: string | number, name: string }> | undefined | null = (musicInfo as any).artists ?? meta?.artists
    if (!artists?.length) {
      const songId = String(meta?.songId ?? (musicInfo as any).songmid ?? '')
      if (songId) {
        try {
          const detail = await musicDetailApi.getList([songId])
          artists = detail.list[0]?.artists
        } catch { /* 走下面的名称兜底 */ }
      }
    }
    if (artists?.length) {
      const onSelect = (artist: { id: string | number, name: string }) => { openArtist(String(artist.id), artist.name) }
      if (artists.length > 1) global.app_event.showArtistSelector(artists, onSelect)
      else onSelect(artists[0])
      return
    }
  } else {
    // tx / kw / kg：用列表数据里带的歌手 ID（tx 是 singer mid）
    let singerId = meta?.singerId
    if (source === 'tx') {
      if (singerId != null && singerId !== '' && String(singerId) !== '0') {
        rememberTxSingerId(musicInfo, singerId)
      } else {
        // v1.9.37 之前入库的 QQ 音乐歌曲没有采集 singer[0].mid，
        // 按 song_mid 反查单曲详情补齐，并写回当前列表，之后无需再请求。
        singerId = await resolveTxSingerId(musicInfo)
        if (singerId) persistSingerId(listId, musicInfo, String(singerId))
      }
    }
    if (singerId != null && singerId !== '' && String(singerId) !== '0') {
      openArtist(String(singerId), firstSingerName || String(musicInfo.singer ?? ''))
      return
    }
  }

  if (!firstSingerName) {
    toast('未找到该歌曲的歌手信息')
    return
  }
  openArtist('', firstSingerName)
}

export const handleLikeMusic = async(musicInfo: LX.Music.MusicInfoOnline) => {
  const cookie = settingState.setting['common.wy_cookie']
  if (!cookie) {
    toast('请先登录网易云')
    return
  }
  if (musicInfo.source !== 'wy') {
    toast('非网易云音源无法执行此操作')
    return
  }

  const songId = String((musicInfo.meta as any)?.songId ?? (musicInfo as any).songmid ?? '')
  if (!songId) {
    toast('未找到歌曲ID')
    return
  }
  const isLiked = userState.wy_liked_song_ids.has(String(songId))
  const like = !isLiked

  try {
    await wyApi.likeSong(songId, like)
    if (like) {
      toast('喜欢成功')
      addWyLikedSong(songId)
    } else {
      toast('取消喜欢成功')
      removeWyLikedSong(songId)
    }
  } catch (error: any) {
    toast(`操作失败: ${error.message}`)
  }
}

export const handlePlayMv = (musicInfo: LX.Music.MusicInfoOnline) => {
  const mvId = String((musicInfo.meta as any)?.mv ?? '')
  if (!mvId) {
    toast('该歌曲没有MV')
    return
  }
  getMvUrl(mvId).then((data: { url: string }) => {
    global.app_event.showVideoPlayer(data.url)
  }).catch((err: Error) => {
    toast(err.message || '获取MV失败')
  })
}


export const handlePlay = (musicInfo: LX.Music.MusicInfoOnline) => {
  void addListMusics(LIST_IDS.DEFAULT, [musicInfo], settingState.setting['list.addMusicLocationType']).then(() => {
    const index = getListMusicSync(LIST_IDS.DEFAULT).findIndex(m => m.id == musicInfo.id)
    if (index < 0) return
    void playList(LIST_IDS.DEFAULT, index)
  })
}
export const handlePlayLater = (musicInfo: LX.Music.MusicInfoOnline, selectedList: LX.Music.MusicInfoOnline[], onCancelSelect: () => void) => {
  if (selectedList.length) {
    addTempPlayList(selectedList.map(s => ({ listId: '', musicInfo: s })))
    onCancelSelect()
  } else {
    addTempPlayList([{ listId: '', musicInfo }])
  }
}


export const handleShowMusicSourceDetail = async(minfo: LX.Music.MusicInfoOnline) => {
  const url = musicSdk[minfo.source as LX.OnlineSource]?.getMusicDetailPageUrl(toOldMusicInfo(minfo))
  if (!url) return
  void openUrl(url)
}

export const clearMusicUrl = async(musicInfo: LX.Music.MusicInfoOnline) => {
  try {
    await clearMusicUrlByMusic(musicInfo)
  } catch (error) {
    toast(global.i18n.t('list_remove_cache_fail_tip', { msg: (error as Error).message }))
    return
  }
  toast(global.i18n.t('list_remove_cache_success_tip'))
}

export const handleDislikeMusic = async(musicInfo: LX.Music.MusicInfoOnline) => {
  const confirm = await confirmDialog({
    message: musicInfo.singer ? global.i18n.t('lists_dislike_music_singer_tip', { name: musicInfo.name, singer: musicInfo.singer }) : global.i18n.t('lists_dislike_music_tip', { name: musicInfo.name }),
    cancelButtonText: global.i18n.t('cancel_button_text_2'),
    confirmButtonText: global.i18n.t('confirm_button_text'),
    bgClose: false,
  })
  if (!confirm) return
  await addDislikeInfo([{ name: musicInfo.name, singer: musicInfo.singer }])
  toast(global.i18n.t('lists_dislike_music_add_tip'))
  if (hasDislike(playerState.playMusicInfo.musicInfo)) {
    void playNext(true)
  }
}

