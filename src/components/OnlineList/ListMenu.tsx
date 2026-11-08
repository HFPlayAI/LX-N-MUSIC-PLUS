import { useRef, useImperativeHandle, forwardRef, useState } from 'react'
import { useI18n } from '@/lang'
import Menu, { type MenuType, type Position } from '@/components/common/Menu'
import { hasDislike } from '@/core/dislikeList'
import { hasMusicUrlByMusic } from '@/utils/data'

// 菜单结构参考 C 项目 souvenp/lx-netease-music-mobile
export interface SelectInfo {
  musicInfo: LX.Music.MusicInfoOnline
  selectedList: LX.Music.MusicInfoOnline[]
  index: number
  single: boolean
}
const initSelectInfo = {}

const hasUrlCache = async(musicInfo: LX.Music.MusicInfo) => {
  return hasMusicUrlByMusic(musicInfo)
}

export interface ListMenuProps {
  onPlay: (selectInfo: SelectInfo) => void
  onPlayLater: (selectInfo: SelectInfo) => void
  onAdd: (selectInfo: SelectInfo) => void
  onMusicSourceDetail: (selectInfo: SelectInfo) => void
  onRemoveCache: (selectInfo: SelectInfo) => void
  onDislikeMusic: (selectInfo: SelectInfo) => void
  onLike?: (selectInfo: SelectInfo) => void
  onArtistDetail?: (selectInfo: SelectInfo) => void
  onAlbumDetail?: (selectInfo: SelectInfo) => void
  onSimilarSongs?: (selectInfo: SelectInfo) => void
  onPlayMv?: (selectInfo: SelectInfo) => void
  onMove?: (selectInfo: SelectInfo) => void
  onRemove?: (selectInfo: SelectInfo) => void
  isCreator?: boolean
}
export interface ListMenuType {
  show: (selectInfo: SelectInfo, position: Position) => void
}

export type { Position }

export default forwardRef<ListMenuType, ListMenuProps>((props: ListMenuProps, ref) => {
  const t = useI18n()
  const [visible, setVisible] = useState(false)
  const menuRef = useRef<MenuType>(null)
  const selectInfoRef = useRef<SelectInfo>(initSelectInfo as SelectInfo)
  const [menus, setMenus] = useState<Array<{ action: string, label: string, disabled?: boolean }>>([])

  useImperativeHandle(ref, () => ({
    show(newSelectInfo, position) {
      selectInfoRef.current = newSelectInfo
      handleSetMenu(newSelectInfo.musicInfo)
      if (visible) menuRef.current?.show(position)
      else {
        setVisible(true)
        requestAnimationFrame(() => {
          menuRef.current?.show(position)
        })
      }
    },
  }))

  const handleSetMenu = (musicInfo: LX.Music.MusicInfo) => {
    let has_url_cache = false
    const menu = [
      { action: 'playLater', label: t('play_later') },
      { action: 'add', label: t('add_to') },
      ...(props.isCreator ? [{ action: 'move', label: t('move_to') }] : []),
      // 网易云源增强菜单（参考C项目）
      ...(musicInfo.source == 'wy' && props.onLike ? [{ action: 'like', label: '网易云红心' }] : []),
      // 四个在线平台都支持歌手/专辑详情（无 ID 时详情页按名称搜索降级）；本地歌曲不支持
      ...(musicInfo.source != 'local' && props.onArtistDetail ? [{ action: 'artistDetail', label: t('artist_detail') }] : []),
      ...(musicInfo.source != 'local' && props.onAlbumDetail ? [{ action: 'albumDetail', label: t('album_detail') }] : []),
      ...(musicInfo.source == 'wy' && props.onSimilarSongs ? [{ action: 'similarSongs', label: t('similar_songs') }] : []),
      ...(musicInfo.source == 'wy' && props.onPlayMv && (musicInfo.meta as any)?.mv ? [{ action: 'playMv', label: t('play_mv') }] : []),
      { action: 'musicSourceDetail', label: t('music_source_detail') },
      { action: 'removeCache', disabled: !has_url_cache, label: t('list_remove_cache') },
      { action: 'dislike', label: t('dislike'), disabled: hasDislike(musicInfo) },
      ...(props.isCreator && props.onRemove ? [{ action: 'remove', label: '移除' }] : []),
    ]
    setMenus(menu)
    void hasUrlCache(musicInfo).then((_has_url_cache) => {
      let isUpdated = false
      if (has_url_cache != _has_url_cache) {
        has_url_cache = _has_url_cache
        menu[menu.findIndex(m => m.action == 'removeCache')].disabled = !has_url_cache
        isUpdated ||= true
      }

      if (isUpdated) setMenus([...menu])
    })
  }

  const handleMenuPress = ({ action }: typeof menus[number]) => {
    const selectInfo = selectInfoRef.current
    switch (action) {
      case 'play':
        props.onPlay(selectInfo)
        break
      case 'like':
        props.onLike?.(selectInfo)
        break
      case 'playLater':
        props.onPlayLater(selectInfo)
        break
      case 'add':
        props.onAdd(selectInfo)
        break
      case 'artistDetail':
        props.onArtistDetail?.(selectInfo)
        break
      case 'albumDetail':
        props.onAlbumDetail?.(selectInfo)
        break
      case 'similarSongs':
        props.onSimilarSongs?.(selectInfo)
        break
      case 'musicSourceDetail':
        props.onMusicSourceDetail(selectInfo)
        break
      case 'removeCache':
        props.onRemoveCache(selectInfo)
        break
      case 'dislike':
        props.onDislikeMusic(selectInfo)
        break
      case 'playMv':
        props.onPlayMv?.(selectInfo)
        break
      case 'move':
        props.onMove?.(selectInfo)
        break
      case 'remove':
        props.onRemove?.(selectInfo)
        break
      default:
        break
    }
  }

  return (
    visible
      ? <Menu ref={menuRef} menus={menus} onPress={handleMenuPress} />
      : null
  )
})
