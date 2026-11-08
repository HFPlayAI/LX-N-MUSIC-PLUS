import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import musicSdk from '@/utils/musicSdk'
import { toOldMusicInfo } from '@/utils'

/**
 * 网易云播放历史同步（歌曲打点）：
 * 曲目自然切换 / 播放队列结束时，若歌曲播放超过一半且开启开关并已登录，
 * 将 wy 源歌曲上报到网易云播放记录。
 */
let prevSongId: string | null = null

const canScrobble = (): boolean => {
  const cookie = settingState.setting['common.wy_cookie']
  const scrobbleEnabled = settingState.setting['common.wy_scrobble']
  return !!(cookie && scrobbleEnabled)
}

const reportScrobble = async(songId: string, duration: number) => {
  try {
    await musicSdk.wy.user.scrobble(String(songId), 'listen', Math.min(Math.floor(duration), 14400))
    console.log('wy scrobble success:', songId)
  } catch (err) {
    console.warn('wy scrobble failed:', err)
  }
}

const getCurrentSongId = (): string | null => {
  const musicInfo = playerState.musicInfo as any
  if (!musicInfo || musicInfo.source !== 'wy') return null
  try {
    // playerState.musicInfo 为新格式，转回旧格式取 songmid
    const oldInfo = toOldMusicInfo(musicInfo as any)
    const songId = oldInfo.songmid ?? oldInfo.meta?.songId
    return songId ? String(songId) : null
  } catch {
    return null
  }
}

/**
 * 记录当前歌曲（用于切换时判定）
 */
export const trackCurrentSong = () => {
  prevSongId = getCurrentSongId()
}

/**
 * 曲目切换时：若上一首播放超过一半，上报播放记录
 */
export const handleTrackChanged = () => {
  const songId = getCurrentSongId()
  const prev = prevSongId
  prevSongId = songId
  if (!prev || !canScrobble()) return
  // 切换后的 songId 与上一首相同（重播等场景）不重复上报
  if (songId === prev) return
  const { nowPlayTime, maxPlayTime } = playerState.progress
  // 播放时长超过一半（或无法判定时长但已播放一段时间）视为有效播放
  if (maxPlayTime > 0 ? nowPlayTime >= maxPlayTime * 0.5 : nowPlayTime > 30) {
    void reportScrobble(prev, Number(maxPlayTime > 0 ? maxPlayTime : nowPlayTime))
  }
}

/**
 * 播放队列结束时：上报最后一首
 */
export const handleQueueEnded = () => {
  const songId = getCurrentSongId()
  if (!songId || !canScrobble()) return
  if (songId === prevSongId) return
  const { nowPlayTime, maxPlayTime } = playerState.progress
  if (maxPlayTime > 0 ? nowPlayTime >= maxPlayTime * 0.5 : nowPlayTime > 30) {
    void reportScrobble(songId, Number(maxPlayTime > 0 ? maxPlayTime : nowPlayTime))
  }
}
