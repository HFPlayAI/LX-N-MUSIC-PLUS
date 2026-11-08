import { createMusicuFetch, filterMusicInfoList } from './musicu'

/**
 * QQ 音乐专辑详情（albumMid）。
 * 上游 musicu.fcg 的 AlbumSongList/GetAlbumSongList 返回 { total, songs }，
 * 不同版本 songInfo 可能直接挂在条目上，filterMusicInfoList 已做兼容。
 * 取不到时由 detail.js 统一降级为「按专辑名搜索」。
 */
export default {
  async getAlbumDetail(id, page = 1, limit = 100) {
    const body = await createMusicuFetch({
      req: {
        module: 'music.musichallAlbum.AlbumSongList',
        method: 'GetAlbumSongList',
        param: {
          albumMid: id,
          begin: (page - 1) * limit,
          num: limit,
          order: 2,
        },
      },
    })
    const data = body.req?.data
    const raw = data?.songs ?? data?.songList ?? []
    const list = filterMusicInfoList(raw)
    if (!list.length) throw new Error('获取专辑歌曲失败')
    const first = list[0]
    return {
      source: 'tx',
      list,
      page,
      limit,
      total: data?.total ?? list.length,
      info: {
        name: first.albumName ?? '',
        img: first.img ?? '',
        desc: '',
        author: first.singer ?? '',
      },
    }
  },
}
