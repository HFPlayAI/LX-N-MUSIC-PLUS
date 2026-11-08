import getTxMusicInfo from './tx/musicInfo'

/**
 * 旧版本（v1.9.37 之前）入库的 QQ 音乐歌曲没有 meta.singerId：
 * 当时列表解析没有采集 singer[0].mid，本地数据里也就无从恢复。
 * 这里按歌曲的 song_mid 调 QQ 音乐单曲详情反查，让老歌曲也能走歌手详情的精确接口。
 *
 * 结果按 song_mid 缓存在内存（含失败结果），避免每次点开都发请求。
 */

const cache = new Map()
const TIMEOUT_MS = 3000

const withTimeout = promise => Promise.race([
  promise,
  new Promise((_resolve, reject) => {
    setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS)
  }),
])

const songMidOf = musicInfo => String(
  musicInfo?.meta?.songId ?? musicInfo?.meta?.songmid ?? musicInfo?.songmid ?? '',
)

export const resolveTxSingerId = async musicInfo => {
  const songMid = songMidOf(musicInfo)
  if (!songMid) return ''
  const key = `tx:${songMid}`
  if (cache.has(key)) return cache.get(key)

  try {
    const info = await withTimeout(Promise.resolve(getTxMusicInfo(songMid)))
    const id = String(info?.singerId ?? info?.singerIds?.[0]?.id ?? '')
    cache.set(key, id)
    return id
  } catch (err) {
    console.log('resolve tx singerId failed:', songMid, err?.message)
    cache.set(key, '')
    return ''
  }
}

/** 从任意一份携带 singerId 的歌曲数据里登记缓存，减少重复请求 */
export const rememberTxSingerId = (musicInfo, id) => {
  const songMid = songMidOf(musicInfo)
  if (songMid && id) cache.set(`tx:${songMid}`, String(id))
}
