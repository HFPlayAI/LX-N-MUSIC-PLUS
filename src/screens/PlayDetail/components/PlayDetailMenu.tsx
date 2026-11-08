import { useMemo, useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import Menu, { type MenuType, type Position, type Menus } from '@/components/common/Menu'
import userState from '@/store/user/state'

// 播放器「⋮」菜单（参考C项目 souvenp/lx-netease-music-mobile，去除下载/OneDrive部分）
export interface SelectInfo {
  musicInfo: LX.Music.MusicInfo
}

const initSelectInfo = {}

export interface PlayDetailMenuProps {
  onMusicSourceDetail: (selectInfo: SelectInfo) => void
  onArtistDetail: (selectInfo: SelectInfo) => void
  onAlbumDetail: (selectInfo: SelectInfo) => void
  onSimilarSongs: (selectInfo: SelectInfo) => void
  onLike: (selectInfo: SelectInfo) => void
  onPlayMv: (selectInfo: SelectInfo) => void
  onDislikeMusic: (selectInfo: SelectInfo) => void
}

export interface PlayDetailMenuType {
  show: (selectInfo: SelectInfo, position: Position) => void
}

export type { Position }

export default forwardRef<PlayDetailMenuType, PlayDetailMenuProps>((props, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const menuRef = useRef<MenuType>(null)
  const selectInfoRef = useRef<SelectInfo>(initSelectInfo as SelectInfo)
  const [isLiked, setIsLiked] = useState(false)

  useImperativeHandle(ref, () => ({
    show(selectInfo, position) {
      selectInfoRef.current = selectInfo
      if (selectInfo.musicInfo.source === 'wy') {
        setIsLiked(userState.wy_liked_song_ids.has(String((selectInfo.musicInfo.meta as any)?.songId ?? '')))
      }
      if (visible) {
        menuRef.current?.show(position)
      } else {
        setVisible(true)
        requestAnimationFrame(() => {
          menuRef.current?.show(position)
        })
      }
    },
  }))

  const menus = useMemo((): Menus => {
    const musicInfo = selectInfoRef.current.musicInfo
    const menuItems: Array<Menus[number]> = []
    menuItems.push({ action: 'like', label: isLiked ? '❤️ 取消喜欢' : '🤍 喜欢' })

    // 歌手/专辑详情四个在线平台都可用（无 ID 时详情页按名称搜索降级）
    if (musicInfo && musicInfo.source !== 'local') {
      menuItems.push({ action: 'artistDetail', label: t('artist_detail') })
      menuItems.push({ action: 'albumDetail', label: t('album_detail') })
    }

    if (musicInfo?.source === 'wy') {
      menuItems.push({ action: 'similarSongs', label: t('similar_songs') })
      if ((musicInfo.meta as any)?.mv) {
        menuItems.push({ action: 'playMv', label: t('play_mv') })
      }
    }

    if (musicInfo && musicInfo.source !== 'local') {
      menuItems.push({ action: 'musicSourceDetail', label: t('music_source_detail') })
    }
    menuItems.push({ action: 'dislike', label: t('dislike_music') })

    return menuItems
  }, [t, isLiked, selectInfoRef.current.musicInfo])

  const handleMenuPress = ({ action }: (typeof menus)[number]) => {
    const selectInfo = selectInfoRef.current
    switch (action) {
      case 'like':
        props.onLike(selectInfo)
        break
      case 'playMv':
        props.onPlayMv(selectInfo)
        break
      case 'artistDetail':
        props.onArtistDetail(selectInfo)
        break
      case 'albumDetail':
        props.onAlbumDetail(selectInfo)
        break
      case 'similarSongs':
        props.onSimilarSongs(selectInfo)
        break
      case 'musicSourceDetail':
        props.onMusicSourceDetail(selectInfo)
        break
      case 'dislike':
        props.onDislikeMusic(selectInfo)
        break
      default:
        break
    }
  }

  return visible ? <Menu ref={menuRef} menus={menus} onPress={handleMenuPress} /> : null
})
