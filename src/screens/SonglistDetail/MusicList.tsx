import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import OnlineList, { type OnlineListType, type OnlineListProps } from '@/components/OnlineList'
import { clearListDetail, getListDetail, setListDetail, setListDetailInfo } from '@/core/songlist'
import songlistState from '@/store/songlist/state'
import { handlePlay } from './listAction'
import Header, { type HeaderType } from './Header'
import { useListInfo } from './state'
import { type DetailHostType } from '@/store/common/state'

export interface MusicListProps {
  /** RNN 组件ID：仅作为独立页面时传入；内嵌模式保持 undefined，列表菜单将回退主窗口ID */
  componentId?: string
  playingId?: string | null
  /** 嵌入模式（我的网易云歌单详情）：头部不保留状态栏高度 */
  embed?: boolean
  /** 嵌入模式返回回调 */
  onBack?: () => void
  /** 列表加载成功（网络）后的回调（用于缓存数据） */
  onListLoaded?: (list: LX.Music.MusicInfoOnline[]) => void
  /** 网络加载失败时的兜底数据源（如本地缓存），返回 null 则显示错误状态 */
  loadFallback?: () => Promise<LX.Music.MusicInfoOnline[] | null>
  /** 网络加载失败回调（如提示 cookie 失效） */
  onLoadError?: () => void
  /** 详情宿主：'home' 主窗口 / 'playDetail' 播放页（用于列表菜单打开详情时正确定位宿主） */
  detailHost?: DetailHostType
}

export interface MusicListType {
  loadList: (source: LX.OnlineSource, listId: string) => void
}

export default forwardRef<MusicListType, MusicListProps>(({ componentId, playingId, embed = false, onBack, onListLoaded, loadFallback, onLoadError, detailHost }, ref) => {
  const listRef = useRef<OnlineListType>(null)
  const headerRef = useRef<HeaderType>(null)
  const isUnmountedRef = useRef(false)
  const info = useListInfo()

  // 加载失败时的兜底：尝试本地缓存，命中则直接填充列表
  const handleLoadError = async(page: number) => {
    if (songlistState.listDetailInfo.list.length && page == 1) clearListDetail()
    onLoadError?.()
    let fallback: LX.Music.MusicInfoOnline[] | null = null
    if (loadFallback) {
      try {
        fallback = await loadFallback()
      } catch {}
    }
    if (isUnmountedRef.current) return
    if (fallback?.length) {
      listRef.current?.setList(fallback)
      listRef.current?.setStatus('end')
      // 关键：回填全局歌单状态，使点击歌曲/播放全部能基于此列表联网播放
      setListDetail({
        list: fallback,
        source: info.source,
        total: fallback.length,
        limit: fallback.length,
        page: 1,
        maxPage: 1,
        key: null,
        id: info.id,
        info: {
          name: info.name ?? '',
          desc: info.desc ?? '',
          play_count: info.play_count ?? '',
          img: info.img,
        },
      }, info.id, 1)
    } else {
      listRef.current?.setStatus('error')
    }
  }

  useImperativeHandle(ref, () => ({
    async loadList(source, id) {
      clearListDetail()
      const listDetailInfo = songlistState.listDetailInfo
      listRef.current?.setList([])
      if (listDetailInfo.id == id && listDetailInfo.source == source && listDetailInfo.list.length) {
        requestAnimationFrame(() => {
          listRef.current?.setList(listDetailInfo.list)
          headerRef.current?.setInfo({
            name: (info.name || listDetailInfo.info.name) ?? '',
            // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
            desc: listDetailInfo.info.desc || info.desc || '',
            playCount: (info.play_count ?? listDetailInfo.info.play_count) ?? '',
            imgUrl: info.img ?? listDetailInfo.info.img,
          })
          onListLoaded?.(listDetailInfo.list)
        })
      } else {
        listRef.current?.setStatus('loading')
        const page = 1
        setListDetailInfo(info.source, info.id)
        headerRef.current?.setInfo({
          name: (info.name || listDetailInfo.info.name) ?? '',
          // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
          desc: listDetailInfo.info.desc || info.desc || '',
          playCount: (info.play_count ?? listDetailInfo.info.play_count) ?? '',
          imgUrl: info.img ?? listDetailInfo.info.img,
        })
        return getListDetail(id, source, page).then((listDetail) => {
          const result = setListDetail(listDetail, id, page)
          if (isUnmountedRef.current) return
          requestAnimationFrame(() => {
            headerRef.current?.setInfo({
              name: (info.name || listDetailInfo.info.name) ?? '',
              // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
              desc: listDetailInfo.info.desc || info.desc || '',
              playCount: (info.play_count ?? listDetailInfo.info.play_count) ?? '',
              imgUrl: info.img ?? listDetailInfo.info.img,
            })
            listRef.current?.setList(result.list)
            listRef.current?.setStatus(songlistState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
            onListLoaded?.(result.list)
          })
        }).catch(() => {
          if (isUnmountedRef.current) return
          void handleLoadError(page)
        })
      }
    },
  }))

  useEffect(() => {
    isUnmountedRef.current = false
    return () => {
      isUnmountedRef.current = true
    }
  }, [])


  const handlePlayList: OnlineListProps['onPlayList'] = (index) => {
    const listDetailInfo = songlistState.listDetailInfo
    // console.log(songlistState.listDetailInfo)
    void handlePlay(listDetailInfo.id, listDetailInfo.source, listDetailInfo.list, index)
  }
  const handleRefresh: OnlineListProps['onRefresh'] = () => {
    const page = 1
    listRef.current?.setStatus('refreshing')
    getListDetail(songlistState.listDetailInfo.id, songlistState.listDetailInfo.source, page, true).then((listDetail) => {
      const result = setListDetail(listDetail, songlistState.listDetailInfo.id, page)
      if (isUnmountedRef.current) return
      listRef.current?.setList(result.list)
      listRef.current?.setStatus(songlistState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
      onListLoaded?.(result.list)
    }).catch(() => {
      if (songlistState.listDetailInfo.list.length && page == 1) clearListDetail()
      onLoadError?.()
      listRef.current?.setStatus('error')
    })
  }
  const handleLoadMore: OnlineListProps['onLoadMore'] = () => {
    listRef.current?.setStatus('loading')
    const page = songlistState.listDetailInfo.list.length ? songlistState.listDetailInfo.page + 1 : 1
    getListDetail(songlistState.listDetailInfo.id, songlistState.listDetailInfo.source, page).then((listDetail) => {
      const result = setListDetail(listDetail, songlistState.listDetailInfo.id, page)
      if (isUnmountedRef.current) return
      listRef.current?.setList(result.list, true)
      listRef.current?.setStatus(songlistState.listDetailInfo.maxPage <= page ? 'end' : 'idle')
    }).catch(() => {
      if (songlistState.listDetailInfo.list.length && page == 1) clearListDetail()
      listRef.current?.setStatus('error')
    })
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const header = useMemo(() => <Header ref={headerRef} componentId={componentId ?? ''} embed={embed} onBack={onBack} />, [embed, onBack])

  return <OnlineList
    ref={listRef}
    componentId={componentId}
    detailHost={detailHost}
    onPlayList={handlePlayList}
    onRefresh={handleRefresh}
    onLoadMore={handleLoadMore}
    ListHeaderComponent={header}
    playingId={playingId}
    // progressViewOffset={}
   />
})

