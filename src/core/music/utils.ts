import musicSdk, { findMusic } from '@/utils/musicSdk'
import {
  // getOtherSource as getOtherSourceFromStore,
  // saveOtherSource as saveOtherSourceFromStore,
  getMusicUrl as getStoreMusicUrl,
  getPlayerLyric as getStoreLyric,
} from '@/utils/data'
import { langS2T, toNewMusicInfo, toOldMusicInfo } from '@/utils'
import { assertApiSupport } from '@/utils/tools'
import settingState from '@/store/setting/state'
import { requestMsg } from '@/utils/message'
import BackgroundTimer from 'react-native-background-timer'
import { apis } from '@/utils/musicSdk/api-source'
import {
  initSourceHealth,
  isCoolingDown,
  healthScore,
  recordSuccess,
  recordFail,
  pushEvent,
  probeAudioUrl,
} from './sourceHealth'


export const currentApiSource = () => settingState.setting['common.apiSource'] || ''

const getOtherSourcePromises = new Map()
export const existTimeExp = /\[\d{1,2}:.*\d{1,4}\]/
const otherSourceCache = new Map<LX.Music.MusicInfo | LX.Download.ListItem, LX.Music.MusicInfoOnline[]>()

export const getOtherSource = async(musicInfo: LX.Music.MusicInfo | LX.Download.ListItem, isRefresh = false): Promise<LX.Music.MusicInfoOnline[]> => {
  // if (!isRefresh) {
  //   const cachedInfo = await getOtherSourceFromStore(musicInfo.id)
  //   if (cachedInfo.length) return cachedInfo
  // }
  // 失败换源依赖 isRefresh 强制重搜，否则会一直复用缓存里的旧候选
  if (isRefresh) otherSourceCache.delete(musicInfo)
  else if (otherSourceCache.has(musicInfo)) return otherSourceCache.get(musicInfo)!
  let key: string
  let searchMusicInfo: {
    name: string
    singer: string
    source: string
    albumName: string
    interval: string
  }
  if ('progress' in musicInfo) {
    key = `local_${musicInfo.id}`
    searchMusicInfo = {
      name: musicInfo.metadata.musicInfo.name,
      singer: musicInfo.metadata.musicInfo.singer,
      source: musicInfo.metadata.musicInfo.source,
      albumName: musicInfo.metadata.musicInfo.meta.albumName,
      interval: musicInfo.metadata.musicInfo.interval ?? '',
    }
  } else {
    key = `${musicInfo.source}_${musicInfo.id}`
    searchMusicInfo = {
      name: musicInfo.name,
      singer: musicInfo.singer,
      source: musicInfo.source,
      albumName: musicInfo.meta.albumName,
      interval: musicInfo.interval ?? '',
    }
  }
  if (getOtherSourcePromises.has(key)) return getOtherSourcePromises.get(key)

  const promise = new Promise<LX.Music.MusicInfoOnline[]>((resolve, reject) => {
    let timeout: null | number = BackgroundTimer.setTimeout(() => {
      timeout = null
      reject(new Error('find music timeout'))
    }, 12_000)
    findMusic(searchMusicInfo).then((otherSource) => {
      if (otherSourceCache.size > 10) otherSourceCache.clear()
      const source = otherSource.map(toNewMusicInfo) as LX.Music.MusicInfoOnline[]
      otherSourceCache.set(musicInfo, source)
      resolve(source)
    }).catch(reject).finally(() => {
      if (timeout) BackgroundTimer.clearTimeout(timeout)
    })
  }).then((otherSource) => {
    // if (otherSource.length) void saveOtherSourceFromStore(musicInfo.id, otherSource)
    return otherSource
  }).finally(() => {
    if (getOtherSourcePromises.has(key)) getOtherSourcePromises.delete(key)
  })
  getOtherSourcePromises.set(key, promise)
  return promise
}


export const buildLyricInfo = async(lyricInfo: MakeOptional<LX.Player.LyricInfo, 'rawlrcInfo'>): Promise<LX.Player.LyricInfo> => {
  if (!settingState.setting['player.isS2t']) {
    // @ts-expect-error
    if (lyricInfo.rawlrcInfo) return lyricInfo
    return { ...lyricInfo, rawlrcInfo: { ...lyricInfo } }
  }

  if (settingState.setting['player.isS2t']) {
    const tasks = [
      lyricInfo.lyric ? langS2T(lyricInfo.lyric) : Promise.resolve(''),
      lyricInfo.tlyric ? langS2T(lyricInfo.tlyric) : Promise.resolve(''),
      lyricInfo.rlyric ? langS2T(lyricInfo.rlyric) : Promise.resolve(''),
      lyricInfo.lxlyric ? langS2T(lyricInfo.lxlyric) : Promise.resolve(''),
    ]
    if (lyricInfo.rawlrcInfo) {
      tasks.push(lyricInfo.lyric ? langS2T(lyricInfo.lyric) : Promise.resolve(''))
      tasks.push(lyricInfo.tlyric ? langS2T(lyricInfo.tlyric) : Promise.resolve(''))
      tasks.push(lyricInfo.rlyric ? langS2T(lyricInfo.rlyric) : Promise.resolve(''))
      tasks.push(lyricInfo.lxlyric ? langS2T(lyricInfo.lxlyric) : Promise.resolve(''))
    }
    return Promise.all(tasks).then(([lyric, tlyric, rlyric, lxlyric, lyric_raw, tlyric_raw, rlyric_raw, lxlyric_raw]) => {
      const rawlrcInfo = lyric_raw ? {
        lyric: lyric_raw,
        tlyric: tlyric_raw,
        rlyric: rlyric_raw,
        lxlyric: lxlyric_raw,
      } : {
        lyric,
        tlyric,
        rlyric,
        lxlyric,
      }
      return {
        lyric,
        tlyric,
        rlyric,
        lxlyric,
        rawlrcInfo,
      }
    })
  }

  // @ts-expect-error
  return lyricInfo.rawlrcInfo ? lyricInfo : { ...lyricInfo, rawlrcInfo: { ...lyricInfo } }
}

export const getCachedLyricInfo = async(musicInfo: LX.Music.MusicInfo): Promise<LX.Player.LyricInfo | null> => {
  let lrcInfo = await getStoreLyric(musicInfo)
  // lrcInfo = {}
  if (existTimeExp.test(lrcInfo.lyric) && lrcInfo.tlyric != null) {
    // if (musicInfo.lrc.startsWith('\ufeff[id:$00000000]')) {
    //   let str = musicInfo.lrc.replace('\ufeff[id:$00000000]\n', '')
    //   commit('setLrc', { musicInfo, lyric: str, tlyric: musicInfo.tlrc, lxlyric: musicInfo.tlrc })
    // } else if (musicInfo.lrc.startsWith('[id:$00000000]')) {
    //   let str = musicInfo.lrc.replace('[id:$00000000]\n', '')
    //   commit('setLrc', { musicInfo, lyric: str, tlyric: musicInfo.tlrc, lxlyric: musicInfo.tlrc })
    // }

    // if (lrcInfo.lxlyric == null) {
    //   switch (musicInfo.source) {
    //     case 'kg':
    //     case 'kw':
    //     case 'mg':
    //       break
    //     default:
    //       return lrcInfo
    //   }
    // } else
    if (lrcInfo.rlyric == null) {
      if (!['wy', 'kg'].includes(musicInfo.source)) return lrcInfo
    } else return lrcInfo
  }
  return null
}

export const getOnlineOtherSourceMusicUrlByLocal = async(musicInfo: LX.Music.MusicInfoLocal, isRefresh: boolean): Promise<{
  url: string
  quality: LX.Quality
  isFromCache: boolean
}> => {
  if (!await global.lx.apiInitPromise[0]) throw new Error('source init failed')

  const quality = '128k'

  const cachedUrl = await getStoreMusicUrl(musicInfo, quality)
  if (cachedUrl && !isRefresh) return { url: cachedUrl, quality, isFromCache: true }

  let reqPromise
  try {
    reqPromise = apis('local').getMusicUrl(toOldMusicInfo(musicInfo), null).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then(({ url }: { url: string }) => {
    return { url, quality, isFromCache: false }
  })
}

export const getOnlineOtherSourceLyricByLocal = async(musicInfo: LX.Music.MusicInfoLocal, isRefresh: boolean): Promise<{
  lyricInfo: LX.Music.LyricInfo
  isFromCache: boolean
}> => {
  if (!await global.lx.apiInitPromise[0]) throw new Error('source init failed')

  const lyricInfo = await getCachedLyricInfo(musicInfo)
  if (lyricInfo && !isRefresh) return { lyricInfo, isFromCache: true }

  let reqPromise
  try {
    reqPromise = apis('local').getLyric(toOldMusicInfo(musicInfo)).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then((lyricInfo: LX.Music.LyricInfo) => {
    return { lyricInfo, isFromCache: false }
  })
}

export const getOnlineOtherSourcePicByLocal = async(musicInfo: LX.Music.MusicInfoLocal): Promise<{
  url: string
}> => {
  if (!await global.lx.apiInitPromise[0]) throw new Error('source init failed')

  let reqPromise
  try {
    reqPromise = apis('local').getPic(toOldMusicInfo(musicInfo)).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }

  return reqPromise.then((url: string) => {
    return { url }
  })
}

export const TRY_QUALITYS_LIST = ['flac24bit', 'flac', '320k'] as const
type TryQualityType = typeof TRY_QUALITYS_LIST[number]
export const getPlayQuality = (highQuality: LX.Quality, musicInfo: LX.Music.MusicInfoOnline): LX.Quality => {
  let type: LX.Quality = '128k'
  if (TRY_QUALITYS_LIST.includes(highQuality as TryQualityType)) {
    let list = global.lx.qualityList[musicInfo.source]

    let t = TRY_QUALITYS_LIST
      .slice(TRY_QUALITYS_LIST.indexOf(highQuality as TryQualityType))
      .find(q => (musicInfo.meta as any)?._qualitys?.[q] && list?.includes(q))

    if (t) type = t
  }
  return type
}

export const getOnlineOtherSourceMusicUrl = async({ musicInfos, quality, onToggleSource, isRefresh, retryedSource = [] }: {
  musicInfos: LX.Music.MusicInfoOnline[]
  quality?: LX.Quality
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: LX.OnlineSource[]
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  isFromCache: boolean
}> => {
  if (!await global.lx.apiInitPromise[0]) throw new Error('source init failed')

  let musicInfo: LX.Music.MusicInfoOnline | null = null
  let itemQuality: LX.Quality | null = null
  // eslint-disable-next-line no-cond-assign
  while (musicInfo = (musicInfos.shift()!)) {
    if (retryedSource.includes(musicInfo.source)) continue
    retryedSource.push(musicInfo.source)
    if (!assertApiSupport(musicInfo.source)) continue
    itemQuality = quality ?? getPlayQuality(settingState.setting['player.playQuality'], musicInfo)
    if (!(musicInfo.meta as any)?._qualitys?.[itemQuality]) continue

    console.log('try toggle to: ', musicInfo.source, musicInfo.name, musicInfo.singer, musicInfo.interval)
    onToggleSource(musicInfo)
    break
  }
  if (!musicInfo || !itemQuality) throw new Error(global.i18n.t('toggle_source_failed'))

  const cachedUrl = await getStoreMusicUrl(musicInfo, itemQuality)
  if (cachedUrl && !isRefresh) return { url: cachedUrl, musicInfo, quality: itemQuality, isFromCache: true }

  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getMusicUrl(toOldMusicInfo(musicInfo), itemQuality).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // retryedSource.includes(musicInfo.source)
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  return reqPromise.then(({ url, type }: { url: string, type: LX.Quality }) => {
    return { musicInfo, url, quality: type, isFromCache: false }
    // eslint-disable-next-line @typescript-eslint/promise-function-async
  }).catch((err: any) => {
    if (err.message == requestMsg.tooManyRequests) throw err
    console.log(err)
    return getOnlineOtherSourceMusicUrl({ musicInfos, quality, onToggleSource, isRefresh, retryedSource })
  })
}

// ======== 并行竞速换源（移植自 ALXMusic，按本项目适配） ========

interface RaceResult {
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  isFromCache: boolean
}

/**
 * 竞速调度器：initial 立即发起，loadMore 在后台并行搜索后追加候选。
 * - ok（Range 探活 200/206 且非网页）第一个返回就直接胜出；
 * - suspect（403 / 网络错误 / 超时）暂存兜底，全部结束后仍无 ok 才放行，避免防盗链链接被误杀；
 * - dead（明确返回网页/JSON）淘汰；
 * - 所有候选都失败才 reject。
 * 失败/报错换源把 maxParallel 截断后的数组作为 initial、loadMore 为空。
 */
const raceDynamic = async({ initial, loadMore, quality, onToggleSource, apiSource, label }: {
  initial: LX.Music.MusicInfoOnline[]
  loadMore?: () => Promise<LX.Music.MusicInfoOnline[]>
  quality?: LX.Quality
  onToggleSource?: (musicInfo?: LX.Music.MusicInfoOnline) => void
  apiSource: string
  label: string
}): Promise<RaceResult> => new Promise((resolve, reject) => {
  let settled = false
  let pending = 0
  let searchDone = !loadMore
  let lastErr: any = null
  const tried = new Set<string>()
  const suspects: RaceResult[] = []

  const finishAll = () => {
    if (settled || !searchDone || pending > 0) return
    settled = true
    if (suspects.length) {
      pushEvent(`${label}: 无强验证链接，放行 ${suspects[0].musicInfo.source}`)
      onToggleSource?.(suspects[0].musicInfo)
      resolve(suspects[0])
    } else {
      pushEvent(`${label}: 全部失败`)
      reject(lastErr ?? new Error(global.i18n.t('toggle_source_failed')))
    }
  }
  const oneDone = () => {
    pending--
    finishAll()
  }

  const attempt = (mi: LX.Music.MusicInfoOnline) => {
    if (settled || tried.has(mi.source)) return
    if (!assertApiSupport(mi.source)) return
    if (isCoolingDown(apiSource, mi.source)) {
      pushEvent(`${label}: ${mi.source} 冷却中，跳过`)
      return
    }
    const q = quality ?? getPlayQuality(settingState.setting['player.playQuality'], mi)
    if (!(mi.meta as any)?._qualitys?.[q]) return
    tried.add(mi.source)
    pending++
    const t0 = Date.now()
    let reqPromise: Promise<{ url: string, type: LX.Quality }>
    try {
      reqPromise = musicSdk[mi.source].getMusicUrl(toOldMusicInfo(mi), q).promise
    } catch (err) {
      reqPromise = Promise.reject(err)
    }
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    reqPromise.then(async({ url, type }) => {
      if (settled) return
      const verdict = await probeAudioUrl(url)
      if (settled) return
      const ms = Date.now() - t0
      const result: RaceResult = { url, musicInfo: mi, quality: type, isFromCache: false }
      if (verdict === 'dead') {
        recordFail(apiSource, mi.source, ms, 'url probe dead')
        pushEvent(`${label}: ${mi.source} 返回网页，判死链`)
        oneDone()
        return
      }
      if (verdict === 'ok') {
        settled = true
        recordSuccess(apiSource, mi.source, ms)
        pushEvent(`${label}: ${mi.source} 命中 ${type} ${ms}ms`)
        onToggleSource?.(mi)
        resolve(result)
        return
      }
      suspects.push(result)
      oneDone()
    }).catch((err: any) => {
      if (settled) return
      lastErr = err
      recordFail(apiSource, mi.source, Date.now() - t0, err)
      oneDone()
    })
  }

  for (const mi of initial) attempt(mi)
  if (loadMore) {
    void loadMore().then(list => {
      for (const mi of list) attempt(mi)
      searchDone = true
      finishAll()
    }).catch(() => {
      searchDone = true
      finishAll()
    })
  } else finishAll()
})

/** 失败/报错时换源：最多 4 路健康候选并行竞速 */
export const raceOtherSourceMusicUrl = async({ musicInfos, quality, onToggleSource, maxParallel = 4 }: {
  musicInfos: LX.Music.MusicInfoOnline[]
  quality?: LX.Quality
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  maxParallel?: number
}): Promise<RaceResult> => {
  await initSourceHealth()
  const apiSource = currentApiSource()
  const candidates: LX.Music.MusicInfoOnline[] = []
  for (const mi of musicInfos) {
    if (!assertApiSupport(mi.source)) continue
    if (isCoolingDown(apiSource, mi.source)) continue
    const q = quality ?? getPlayQuality(settingState.setting['player.playQuality'], mi)
    if (!(mi.meta as any)?._qualitys?.[q]) continue
    candidates.push(mi)
  }
  if (!candidates.length) throw new Error(global.i18n.t('toggle_source_failed'))
  candidates.sort((a, b) => healthScore(apiSource, b.source) - healthScore(apiSource, a.source))
  const batch = candidates.slice(0, maxParallel)
  pushEvent(`开始竞速: ${batch.map(m => m.source).join(' / ')}`)
  return raceDynamic({ initial: batch, quality, onToggleSource, apiSource, label: '竞速' })
}

/** 播放器报错后强制从「别的源」取链接，不再刷新当前死链 */
export const getMusicUrlFromOtherSources = async({ musicInfo, quality }: {
  musicInfo: LX.Music.MusicInfoOnline
  quality?: LX.Quality
}): Promise<{ url: string, quality: LX.Quality, source: string }> => {
  const otherSource = await getOtherSource(musicInfo, true)
  const list = otherSource.filter(item => item.source != musicInfo.source)
  if (!list.length) throw new Error(global.i18n.t('toggle_source_failed'))
  const result = await raceOtherSourceMusicUrl({ musicInfos: list, quality, onToggleSource: () => {} })
  return { url: result.url, quality: result.quality, source: result.musicInfo.source }
}


/**
 * 获取在线音乐URL
 */
export const handleGetOnlineMusicUrl = async({ musicInfo, quality, onToggleSource, isRefresh, allowToggleSource }: {
  musicInfo: LX.Music.MusicInfoOnline
  quality?: LX.Quality
  isRefresh: boolean
  allowToggleSource: boolean
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  quality: LX.Quality
  isFromCache: boolean
}> => {
  if (!await global.lx.apiInitPromise[0]) throw new Error('source init failed')
  // console.log(musicInfo.source)
  const targetQuality = quality ?? getPlayQuality(settingState.setting['player.playQuality'], musicInfo)

  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getMusicUrl(toOldMusicInfo(musicInfo), targetQuality).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  return reqPromise.then(({ url, type }: { url: string, type: LX.Quality }) => {
    return { musicInfo, url, quality: type, isFromCache: false }
  }).catch(async(err: any) => {
    console.log(err)
    if (!allowToggleSource || err.message == requestMsg.tooManyRequests) throw err
    onToggleSource()
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return getOtherSource(musicInfo).then(otherSource => {
      // console.log('find otherSource', otherSource.length)
      if (otherSource.length) {
        // 先并行竞速（最多 4 路 + Range 探活），全灭再退回原串行换源
        return raceOtherSourceMusicUrl({
          musicInfos: otherSource.filter(item => item.source != musicInfo.source),
          onToggleSource,
          quality,
        }).catch(async() => {
          return getOnlineOtherSourceMusicUrl({
            musicInfos: [...otherSource],
            onToggleSource,
            quality,
            isRefresh,
            retryedSource: [musicInfo.source],
          })
        })
      }
      throw err
    })
  })
}


export const getOnlineOtherSourcePicUrl = async({ musicInfos, onToggleSource, isRefresh, retryedSource = [] }: {
  musicInfos: LX.Music.MusicInfoOnline[]
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: LX.OnlineSource[]
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  let musicInfo: LX.Music.MusicInfoOnline | null = null
  // eslint-disable-next-line no-cond-assign
  while (musicInfo = (musicInfos.shift()!)) {
    if (retryedSource.includes(musicInfo.source)) continue
    retryedSource.push(musicInfo.source)
    // if (!assertApiSupport(musicInfo.source)) continue
    console.log('try toggle to: ', musicInfo.source, musicInfo.name, musicInfo.singer, musicInfo.interval)
    onToggleSource(musicInfo)
    break
  }
  if (!musicInfo) throw new Error(global.i18n.t('toggle_source_failed'))

  if (musicInfo.meta.picUrl && !isRefresh) return { musicInfo, url: musicInfo.meta.picUrl, isFromCache: true }

  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getPic(toOldMusicInfo(musicInfo))
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // retryedSource.includes(musicInfo.source)
  return reqPromise.then((url: string) => {
    return { musicInfo, url, isFromCache: false }
    // eslint-disable-next-line @typescript-eslint/promise-function-async
  }).catch((err: any) => {
    console.log(err)
    return getOnlineOtherSourcePicUrl({ musicInfos, onToggleSource, isRefresh, retryedSource })
  })
}

/**
 * 获取在线歌曲封面
 */
export const handleGetOnlinePicUrl = async({ musicInfo, isRefresh, onToggleSource, allowToggleSource }: {
  musicInfo: LX.Music.MusicInfoOnline
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  allowToggleSource: boolean
}): Promise<{
  url: string
  musicInfo: LX.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  // console.log(musicInfo.source)
  let reqPromise
  try {
    reqPromise = musicSdk[musicInfo.source].getPic(toOldMusicInfo(musicInfo))
  } catch (err) {
    reqPromise = Promise.reject(err)
  }
  return reqPromise.then((url: string) => {
    return { musicInfo, url, isFromCache: false }
  }).catch(async(err: any) => {
    console.log(err)
    if (!allowToggleSource) throw err
    onToggleSource()
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return getOtherSource(musicInfo).then(otherSource => {
      // console.log('find otherSource', otherSource.length)
      if (otherSource.length) {
        return getOnlineOtherSourcePicUrl({
          musicInfos: [...otherSource],
          onToggleSource,
          isRefresh,
          retryedSource: [musicInfo.source],
        })
      }
      throw err
    })
  })
}


export const getOnlineOtherSourceLyricInfo = async({ musicInfos, onToggleSource, isRefresh, retryedSource = [] }: {
  musicInfos: LX.Music.MusicInfoOnline[]
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  retryedSource?: LX.OnlineSource[]
}): Promise<{
  lyricInfo: LX.Music.LyricInfo | LX.Player.LyricInfo
  musicInfo: LX.Music.MusicInfoOnline
  isFromCache: boolean
}> => {
  let musicInfo: LX.Music.MusicInfoOnline | null = null
  // eslint-disable-next-line no-cond-assign
  while (musicInfo = (musicInfos.shift()!)) {
    if (retryedSource.includes(musicInfo.source)) continue
    retryedSource.push(musicInfo.source)
    // if (!assertApiSupport(musicInfo.source)) continue
    console.log('try toggle to: ', musicInfo.source, musicInfo.name, musicInfo.singer, musicInfo.interval)
    onToggleSource(musicInfo)
    break
  }
  if (!musicInfo) throw new Error(global.i18n.t('toggle_source_failed'))

  if (!isRefresh) {
    const lyricInfo = await getCachedLyricInfo(musicInfo)
    if (lyricInfo) return { musicInfo, lyricInfo, isFromCache: true }
  }

  let reqPromise
  try {
    // TODO: remove any type
    reqPromise = (musicSdk[musicInfo.source].getLyric(toOldMusicInfo(musicInfo))).promise
  } catch (err: any) {
    reqPromise = Promise.reject(err)
  }
  // retryedSource.includes(musicInfo.source)
  return reqPromise.then(async(lyricInfo: LX.Music.LyricInfo) => {
    return existTimeExp.test(lyricInfo.lyric) ? {
      lyricInfo,
      musicInfo,
      isFromCache: false,
    } : Promise.reject(new Error('failed'))
    // eslint-disable-next-line @typescript-eslint/promise-function-async
  }).catch((err: any) => {
    console.log(err)
    return getOnlineOtherSourceLyricInfo({ musicInfos, onToggleSource, isRefresh, retryedSource })
  })
}

/**
 * 获取在线歌词信息
 */
export const handleGetOnlineLyricInfo = async({ musicInfo, onToggleSource, isRefresh, allowToggleSource }: {
  musicInfo: LX.Music.MusicInfoOnline
  onToggleSource: (musicInfo?: LX.Music.MusicInfoOnline) => void
  isRefresh: boolean
  allowToggleSource: boolean
}): Promise<{
  musicInfo: LX.Music.MusicInfoOnline
  lyricInfo: LX.Music.LyricInfo | LX.Player.LyricInfo
  isFromCache: boolean
}> => {
  // console.log(musicInfo.source)
  let reqPromise
  try {
    // TODO: remove any type
    reqPromise = (musicSdk[musicInfo.source].getLyric(toOldMusicInfo(musicInfo))).promise
  } catch (err) {
    reqPromise = Promise.reject(err)
  }
  return reqPromise.then(async(lyricInfo: LX.Music.LyricInfo) => {
    return existTimeExp.test(lyricInfo.lyric) ? {
      musicInfo,
      lyricInfo,
      isFromCache: false,
    } : Promise.reject(new Error('failed'))
  }).catch(async(err: any) => {
    console.log(err)
    if (!allowToggleSource) throw err

    onToggleSource()
    // eslint-disable-next-line @typescript-eslint/promise-function-async
    return getOtherSource(musicInfo).then(otherSource => {
      // console.log('find otherSource', otherSource.length)
      if (otherSource.length) {
        return getOnlineOtherSourceLyricInfo({
          musicInfos: [...otherSource],
          onToggleSource,
          isRefresh,
          retryedSource: [musicInfo.source],
        })
      }
      throw err
    })
  })
}
