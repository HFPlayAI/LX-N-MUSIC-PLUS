import { memo, useCallback } from 'react'
import { toast } from '@/utils/tools'
import { useTheme } from '@/store/theme/hook'
import playerState from '@/store/player/state'
import settingState from '@/store/setting/state'
import { useWyUserState } from '@/store/user/hook'
import { toggleWyLikedSong } from '@/store/user/action'
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
import { toOldMusicInfo } from '@/utils'
import Btn from './Btn'

/**
 * 网易云红心按钮：播放详情页一键将 wy 源当前歌曲标记/取消「我喜欢的音乐」。
 * 仅在 wy 源歌曲且已登录时可用。
 */
export default memo(() => {
  const theme = useTheme()
  const { wy_liked_song_ids, wy_uid } = useWyUserState()

  const handlePress = useCallback(() => {
    let musicInfo = playerState.musicInfo as any
    // 自动换源后原 wy 歌曲可能保存在 toggleMusicInfo 中，尝试还原
    if (musicInfo && musicInfo.source !== 'wy' && musicInfo.meta?.toggleMusicInfo?.source === 'wy') {
      musicInfo = musicInfo.meta.toggleMusicInfo
    }
    if (!musicInfo || musicInfo.source !== 'wy') {
      toast('仅支持网易云源歌曲')
      return
    }
    if (!wy_uid || !settingState.setting['common.wy_cookie']) {
      toast('请先登录网易云')
      return
    }
    // playerState.musicInfo 为新格式，需转回旧格式取 songmid
    const songId = musicInfo.songmid
      ? String(musicInfo.songmid)
      : String(musicInfo.meta?.songId ?? '')
    if (!songId) return
    const liked = wy_liked_song_ids.has(songId)
    void toggleWyLikedSong(songId, !liked).then(() => {
      toast(liked ? '已取消红心' : '已红心同步到「我喜欢的音乐」')
    }).catch((err: Error) => {
      toast(err.message)
    })
  }, [wy_liked_song_ids, wy_uid])

  const musicInfoRaw = playerState.musicInfo as any
  let musicInfo = musicInfoRaw
  if (musicInfo && musicInfo.source !== 'wy' && musicInfo.meta?.toggleMusicInfo?.source === 'wy') {
    musicInfo = musicInfo.meta.toggleMusicInfo
  }
  const isWy = musicInfo?.source === 'wy'
  let currentSongId: string | null = null
  if (isWy) {
    try {
      if (musicInfo.songmid) {
        currentSongId = String(musicInfo.songmid)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        const oldInfo = toOldMusicInfo(musicInfo)
        currentSongId = String(oldInfo.songmid ?? oldInfo.meta?.songId)
      }
    } catch {}
  }
  const isLiked = isWy && currentSongId != null && wy_liked_song_ids.has(currentSongId)

  return <Btn icon="love" color={isLiked ? theme['c-primary'] : undefined} onPress={handlePress} />
})
