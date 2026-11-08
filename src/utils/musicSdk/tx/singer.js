import { createMusicuFetch, filterMusicInfoList } from './musicu'

/**
 * QQ 音乐歌手详情。
 * 移植自桌面版 B 项目 tx/singer.js，并修正其 filterSongList 未 return、
 * getInfo 把 body.req_2 当数字比较等问题。
 */
export default {
  async getInfo(id) {
    const body = await createMusicuFetch({
      req: {
        module: 'music.musichallSinger.SingerInfoInter',
        method: 'GetSingerDetail',
        param: {
          singer_mid: [id],
          ex_singer: 1,
          wiki_singer: 1,
          group_singer: 0,
          pic: 1,
          photos: 0,
        },
      },
    })
    const info = body.req?.data?.singer_list?.[0]
    if (!info) throw new Error('获取歌手信息失败')
    return {
      source: 'tx',
      id,
      info: {
        name: info.basic_info?.name ?? '',
        desc: info.ex_info?.desc ?? '',
        img: info.pic?.pic ?? '',
      },
    }
  },

  async getSongList(id, page = 1, limit = 100) {
    const body = await createMusicuFetch({
      req: {
        module: 'musichall.song_list_server',
        method: 'GetSingerSongList',
        param: {
          singerMid: id,
          order: 1,
          begin: (page - 1) * limit,
          num: limit,
        },
      },
    })
    const data = body.req?.data
    if (!data) throw new Error('获取歌手歌曲失败')
    return {
      source: 'tx',
      list: filterMusicInfoList(data.songList ?? []),
      limit,
      page,
      total: data.totalNum ?? 0,
      hasMore: data.totalNum > page * limit,
    }
  },
}
