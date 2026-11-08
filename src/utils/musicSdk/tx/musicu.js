import { httpFetch } from '../../request'
import { formatPlayTime, sizeFormate } from '../../index'
import { formatSingerName } from '../utils'

/**
 * QQ 音乐 musicu.fcg 通用请求（POST JSON）。
 * 参考桌面版 B 项目 tx/singer.js 与本项目 tx/songList.js 的 getListDetail2 写法。
 */
export const createMusicuFetch = async(data, retryNum = 0) => {
  if (retryNum > 2) throw new Error('try max num')
  try {
    const { statusCode, body } = await httpFetch('https://u.y.qq.com/cgi-bin/musicu.fcg', {
      method: 'post',
      headers: {
        Origin: 'https://y.qq.com',
        Referer: 'https://y.qq.com/',
      },
      body: {
        comm: {
          cv: 4747474,
          ct: 24,
          format: 'json',
          inCharset: 'utf-8',
          outCharset: 'utf-8',
          platform: 'yqq.json',
          needNewCode: 1,
          uin: 0,
        },
        ...data,
      },
    }).promise
    if (statusCode !== 200 || !body || body.code !== 0) throw new Error('musicu response error')
    return body
  } catch (err) {
    return createMusicuFetch(data, retryNum + 1)
  }
}

/** 把 QQ 音乐的 songInfo 转成项目内统一的 oldMusicInfo */
export const filterMusicInfoItem = item => {
  if (!item) return null
  const file = item.file ?? {}
  const types = []
  const _types = {}
  if (file.size_128mp3) {
    const size = sizeFormate(file.size_128mp3)
    types.push({ type: '128k', size })
    _types['128k'] = { size }
  }
  if (file.size_320mp3) {
    const size = sizeFormate(file.size_320mp3)
    types.push({ type: '320k', size })
    _types['320k'] = { size }
  }
  if (file.size_flac) {
    const size = sizeFormate(file.size_flac)
    types.push({ type: 'flac', size })
    _types.flac = { size }
  }
  if (file.size_hires) {
    const size = sizeFormate(file.size_hires)
    types.push({ type: 'flac24bit', size })
    _types.flac24bit = { size }
  }

  const albumMid = item.album?.mid ?? ''
  const albumName = item.album?.name ?? ''
  return {
    source: 'tx',
    singer: formatSingerName(item.singer, 'name'),
    singerId: item.singer?.[0]?.mid ?? '',
    name: item.title ?? item.name ?? '',
    albumName,
    albumId: albumMid,
    albumMid,
    interval: item.interval ? formatPlayTime(item.interval) : null,
    songId: item.id,
    songmid: item.mid,
    strMediaMid: file.media_mid ?? '',
    img: albumMid
      ? `https://y.gtimg.cn/music/photo_new/T002R500x500M000${albumMid}.jpg`
      : item.singer?.length ? `https://y.gtimg.cn/music/photo_new/T001R500x500M000${item.singer[0].mid}.jpg` : '',
    types,
    _types,
    typeUrl: {},
  }
}

export const filterMusicInfoList = raw => raw
  .map(item => filterMusicInfoItem(item?.songInfo ?? item))
  .filter(Boolean)
