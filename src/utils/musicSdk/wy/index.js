import leaderboard from './leaderboard'
import { apis } from '../api-source'
import getLyric from './lyric'
import getMusicInfo from './musicInfo'
import musicSearch from './musicSearch'
import songList from './songList'
import hotSearch from './hotSearch'
import comment from './comment'
import dailyRec from './dailyRec'
import * as apiCookie from './api-cookie'
import artist from './artist'
import album from './album'
import user from './user'
import { appSetting } from './appSetting'
import musicDetail from './musicDetail'
import { getMvUrl } from './mv'
import { getMusicQualityInfo, getBatchMusicQualityInfo } from './quality_detail'
// import tipSearch from './tipSearch'

const wy = {
  // tipSearch,
  leaderboard,
  musicSearch,
  songList,
  hotSearch,
  comment,
  artist,
  album,
  dailyRec,
  cookie: apiCookie,
  user,
  musicDetail,
  mv: { getMvUrl },
  quality: { getMusicQualityInfo, getBatchMusicQualityInfo },
  getMusicUrl(songInfo, type) {
    // 播放链接一律优先交给当前自定义源（含合并优质源），避免普通账号被官方接口
    // 拦住 VIP 歌曲。Cookie 只在两种情况下参与解析：
    //   A. isCloudSong（歌单返回里带 pc 字段）：用户上传到网易云音乐云盘的歌曲，
    //      公开解析源里根本不存在，只有该账号 Cookie 能取到链接。
    //   B. 解析源明确失败时兜底重试一次，用来覆盖早期入库、没有标记的历史云盘歌曲。
    const hasCookie = !!appSetting['common.wy_cookie']
    const isCloudSong = !!songInfo.isCloudSong

    if (isCloudSong && !hasCookie) {
      return {
        promise: Promise.reject(new Error('该歌曲为网易云云盘上传歌曲，请登录网易云账号后播放')),
        cancelHttp: () => {},
      }
    }
    // A：云盘歌曲直接走 Cookie，省掉一次注定失败的解析源请求
    if (isCloudSong && hasCookie) return apiCookie.getMusicUrl(songInfo, type)

    const requestObj = {
      cancelHttp: () => {},
      promise: null,
    }
    const fallbackToCookie = err => {
      if (!hasCookie) return Promise.reject(err)
      const fallback = apiCookie.getMusicUrl(songInfo, type)
      requestObj.cancelHttp = fallback.cancelHttp || (() => {})
      return fallback.promise
    }

    try {
      const sourceReq = apis('wy').getMusicUrl(songInfo, type)
      requestObj.cancelHttp = sourceReq.cancelHttp || (() => {})
      // B：仅解析源失败才回退，正常命中解析源的 VIP 歌曲不受影响
      requestObj.promise = Promise.resolve(sourceReq.promise).catch(fallbackToCookie)
    } catch (err) {
      requestObj.promise = fallbackToCookie(err)
    }
    return requestObj
  },
  getLyric(songInfo) {
    return getLyric(songInfo.songmid)
  },
  getPic(songInfo) {
    const requestObj = getMusicInfo(songInfo.songmid)
    return requestObj.promise.then(info => info.al.picUrl)
  },
  getMusicDetailPageUrl(songInfo) {
    return `https://music.163.com/#/song?id=${songInfo.songmid}`
  },
}

export default wy
