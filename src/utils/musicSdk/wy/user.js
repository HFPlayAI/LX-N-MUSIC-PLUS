import { httpFetch } from '../../request'
import { weapi } from './utils/crypto'
import { toMD5 } from '../utils'
import { appSetting } from './appSetting'
import { setWyVipType } from '@/store/user/action'

// Simple in-memory UID cache
const uidCache = new Map()
const getWyUidCache = async(hashedCookie) => uidCache.get(hashedCookie)
const saveWyUidCache = async(hashedCookie, uid, vipType, profile) => {
  uidCache.set(hashedCookie, { uid, vipType, profile })
}

// 从响应头提取 Cookie 键值对。RN 的 fetch headers.map 里 set-cookie 可能是数组，
// 多条 Set-Cookie 会被 ", " 合并，这里按 name=value 拆分并过滤掉 Path/Expires 等属性。
// 保留全量登录相关字段（MUSIC_U / MUSIC_R_T / MUSIC_A / __csrf / os ...），
// 供续期后回写，避免像扫码登录那样只留白名单字段。
const KEEP_COOKIE_NAME = /^(MUSIC_U|MUSIC_R_T|MUSIC_R_TT|MUSIC_A|__csrf|os|osver|appver|channel|deviceId|NMTID)$/i
const parseSetCookie = (headers) => {
  const setCookie = headers?.['set-cookie'] || headers?.['Set-Cookie']
  if (!setCookie) return {}
  const raw = Array.isArray(setCookie) ? setCookie.join(', ') : String(setCookie)
  const map = {}
  raw.split(/[;,]\s*/).forEach(pair => {
    const idx = pair.indexOf('=')
    if (idx <= 0) return
    const name = pair.slice(0, idx).trim()
    const value = pair.slice(idx + 1).trim()
    if (KEEP_COOKIE_NAME.test(name) && value && !map[name]) map[name] = value
  })
  return map
}

// 把新提取的 Cookie 字段合并进原字符串：同名覆盖，其余保留。
// 这样续期换了 MUSIC_U/__csrf 后，账号原有的 os/appver/deviceId 等不会丢。
const mergeCookieString = (oldCookie, patch) => {
  const map = new Map()
  String(oldCookie || '').split(';').forEach(pair => {
    const idx = pair.indexOf('=')
    if (idx <= 0) return
    const name = pair.slice(0, idx).trim()
    const value = pair.slice(idx + 1).trim()
    if (name && value) map.set(name, value)
  })
  for (const [name, value] of Object.entries(patch)) map.set(name, value)
  return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('; ')
}

export default {
  async getUid(cookie, retryNum = 0) {
    if (!cookie) throw new Error('Cookie is required to get UID')
    const maxRetries = 3
    const retryDelay = 200

    try {
      const hashedCookie = toMD5(cookie)
      const cachedData = await getWyUidCache(hashedCookie)
      if (cachedData) {
        setWyVipType(cachedData.vipType)
        return cachedData.uid
      }

      const csrfToken = (cookie.match(/_csrf=([^(;|$)]+)/) || [])[1]
      const request = httpFetch('https://music.163.com/weapi/nuser/account/get', {
        method: 'post',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
          origin: 'https://music.163.com',
          Referer: 'https://music.163.com',
          cookie,
        },
        form: weapi({
          csrf_token: csrfToken || '',
        }),
      })
      const { body, statusCode } = await request.promise

      if (statusCode !== 200 || body.code !== 200) throw new Error(`获取UID失败(服务端code ${body != null ? body.code : statusCode})`)
      if (!body.account) {
        console.warn('登录已过期或Cookie无效', body)
        throw new Error(`登录已过期或Cookie无效(服务端code ${body != null ? body.code : 'unknown'})`)
      }

      const uid = body.account.id
      setWyVipType(body.account.vipType)
      await saveWyUidCache(hashedCookie, String(uid), body.account.vipType)
      return uid
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.getUid(cookie, retryNum + 1)
      } else {
        console.error('获取UID失败 (重试次数已达上限)', error)
        throw error
      }
    }
  },

  // 获取账号资料（uid / 昵称 / 头像）。与 getUid 同一接口，额外返回 profile 供 UI 显示头像。
  async getProfile(cookie, retryNum = 0) {
    if (!cookie) throw new Error('Cookie is required to get profile')
    const maxRetries = 3
    const retryDelay = 200

    try {
      const hashedCookie = toMD5(cookie)
      const cachedData = await getWyUidCache(hashedCookie)
      if (cachedData?.profile) return cachedData.profile

      const csrfToken = (cookie.match(/_csrf=([^(;|$)]+)/) || [])[1]
      const request = httpFetch('https://music.163.com/weapi/nuser/account/get', {
        method: 'post',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
          origin: 'https://music.163.com',
          Referer: 'https://music.163.com',
          cookie,
        },
        form: weapi({
          csrf_token: csrfToken || '',
        }),
      })
      const { body, statusCode } = await request.promise

      if (statusCode !== 200 || body.code !== 200) throw new Error(`获取账号资料失败(服务端code ${body != null ? body.code : statusCode})`)
      if (!body.account) {
        console.warn('登录已过期或Cookie无效', body)
        throw new Error(`登录已过期或Cookie无效(服务端code ${body != null ? body.code : 'unknown'})`)
      }

      const uid = String(body.account.id)
      const profile = {
        uid,
        nickname: body.profile?.nickname || '',
        avatarUrl: body.profile?.avatarUrl || '',
        vipType: body.account.vipType || 0,
      }
      setWyVipType(body.account.vipType)
      await saveWyUidCache(hashedCookie, uid, body.account.vipType, profile)
      return profile
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.getProfile(cookie, retryNum + 1)
      } else {
        console.error('获取账号资料失败 (重试次数已达上限)', error)
        throw error
      }
    }
  },

  async likeSong(songId, like, retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200
    const cookie = appSetting['common.wy_cookie']
    if (!cookie) return Promise.reject(new Error('未设置Cookie'))

    const csrfToken = (cookie.match(/_csrf=([^(;|$)]+)/) || [])[1]
    const data = {
      trackId: songId,
      like,
      time: 3,
      alg: 'itembased',
      csrf_token: csrfToken || '',
    }

    const requestObj = httpFetch('https://music.163.com/weapi/song/like', {
      method: 'post',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
        origin: 'https://music.163.com',
        Referer: 'https://music.163.com',
        cookie,
      },
      form: weapi(data),
    })

    try {
      const { body, statusCode } = await requestObj.promise
      if (statusCode !== 200 || body.code !== 200) {
        throw new Error((body && body.message) || '操作失败')
      }
      return body
    } catch (error) {
      if (retryNum < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.likeSong(songId, like, retryNum + 1)
      } else {
        throw error
      }
    }
  },

  async getLikedSongList(uid, cookie, retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200

    try {
      const csrfToken = (cookie.match(/_csrf=([^(;|$)]+)/) || [])[1]
      const request = httpFetch('https://music.163.com/weapi/song/like/get', {
        method: 'post',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.0.0',
          origin: 'https://music.163.com',
          Referer: 'https://music.163.com',
          cookie,
        },
        form: weapi({
          uid: String(uid),
          csrf_token: csrfToken || '',
        }),
      })
      const { body, statusCode } = await request.promise
      if (statusCode !== 200 || body.code !== 200) throw new Error('获取喜欢列表歌曲失败')
      return body.ids || []
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.getLikedSongList(uid, cookie, retryNum + 1)
      } else {
        console.error('获取喜欢列表歌曲失败 (重试次数已达上限)', error)
        throw error
      }
    }
  },

  async getUserPlaylists(uid, cookie, retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200
    try {
      const csrfToken = (cookie.match(/_csrf=([^(;|$)]+)/) || [])[1]
      const requestObj = httpFetch('https://music.163.com/weapi/user/playlist', {
        method: 'post',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
          origin: 'https://music.163.com',
          Referer: `https://music.163.com/user/home?id=${uid}`,
          cookie,
        },
        form: weapi({
          uid,
          limit: 1000,
          offset: 0,
          includeVideo: true,
          csrf_token: csrfToken || '',
        }),
      })
      const { body } = await requestObj.promise
      if (body.code !== 200) throw new Error('获取用户歌单失败')
      return body.playlist
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.getUserPlaylists(uid, cookie, retryNum + 1)
      } else {
        console.error('获取用户歌单失败 (重试次数已达上限)', error)
        throw error
      }
    }
  },

  async createPlaylist(name, privacy = '10', retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200
    try {
      const data = {
        name,
        privacy,
        type: 'NORMAL',
      }
      const cookie = appSetting['common.wy_cookie']
      const csrfToken = (cookie.match(/_csrf=([^(;|$)]+)/) || [])[1]
      const { body } = await httpFetch('https://music.163.com/weapi/playlist/create', {
        method: 'post',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
          origin: 'https://music.163.com',
          Referer: 'https://music.163.com',
          cookie,
        },
        form: weapi({ ...data, csrf_token: csrfToken || '' }),
      }).promise
      if (body.code !== 200) throw new Error(body.message || '创建歌单失败')
      return body.playlist
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.createPlaylist(name, privacy, retryNum + 1)
      } else {
        console.error('创建歌单失败 (重试次数已达上限)', error)
        throw error
      }
    }
  },

  async deletePlaylist(id, retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200
    try {
      const data = {
        ids: '[' + id + ']',
      }
      const cookie = appSetting['common.wy_cookie']
      const csrfToken = (cookie.match(/_csrf=([^(;|$)]+)/) || [])[1]
      const { body } = await httpFetch('https://music.163.com/weapi/playlist/remove', {
        method: 'post',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
          origin: 'https://music.163.com',
          Referer: 'https://music.163.com',
          cookie,
        },
        form: weapi({ ...data, csrf_token: csrfToken || '' }),
      }).promise
      if (body.code !== 200) throw new Error(body.message || '删除歌单失败')
      return body
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.deletePlaylist(id, retryNum + 1)
      } else {
        console.error('删除歌单失败 (重试次数已达上限)', error)
        throw error
      }
    }
  },

  async updatePlaylist(id, name, desc = '', retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200
    try {
      const data = {
        '/api/playlist/desc/update': `{"id":${id},"desc":"${desc}"}`,
        '/api/playlist/update/name': `{"id":${id},"name":"${name}"}`,
      }
      const cookie = appSetting['common.wy_cookie']
      const csrfToken = (cookie.match(/_csrf=([^(;|$)]+)/) || [])[1]
      const { body } = await httpFetch('https://music.163.com/weapi/batch', {
        method: 'post',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/108.0.1462.54',
          origin: 'https://music.163.com',
          Referer: 'https://music.163.com',
          cookie,
        },
        form: weapi({ ...data, csrf_token: csrfToken || '' }),
      }).promise
      if (body.code !== 200) throw new Error(body.message || '编辑歌单失败')
      return body
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.updatePlaylist(id, name, desc, retryNum + 1)
      } else {
        console.error('编辑歌单失败 (重试次数已达上限)', error)
        throw error
      }
    }
  },

  async manipulatePlaylistTracks(op, pid, tracks, retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200

    const trackIds = Array.isArray(tracks) ? tracks.map(String) : [String(tracks)]
    const data = {
      op,
      pid,
      trackIds: JSON.stringify(trackIds),
      imme: 'true',
    }
    const cookie = appSetting['common.wy_cookie']

    const doRequest = (requestData) => {
      return httpFetch('https://music.163.com/weapi/playlist/manipulate/tracks', {
        method: 'post',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
          origin: 'https://music.163.com',
          Referer: 'https://music.163.com',
          cookie,
        },
        form: weapi(requestData),
      }).promise
    }

    try {
      const { body } = await doRequest(data).catch(error => {
        if (error.body && error.body.code === 512) {
          const doubleTrackIdsData = { ...data, trackIds: JSON.stringify([...trackIds, ...trackIds]) }
          return doRequest(doubleTrackIdsData)
        }
        throw error
      })

      if (body.code !== 200 && body.code !== 201) throw new Error(body.message || '操作失败')
      return body
    } catch (error) {
      console.error(`歌曲操作失败 (尝试 ${retryNum + 1}/${maxRetries}):`, error)
      if (retryNum < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.manipulatePlaylistTracks(op, pid, tracks, retryNum + 1)
      } else {
        console.error('歌曲操作失败 (已达最大重试次数)', error)
        throw error
      }
    }
  },

  async getSublist(limit = 100, offset = 0, retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200
    try {
      const cookie = appSetting['common.wy_cookie']
      if (!cookie) throw new Error('请先设置网易云 Cookie')
      const csrfToken = (cookie.match(/_csrf=([^(;|$)]+)/) || [])[1]
      const requestObj = httpFetch('https://music.163.com/weapi/artist/sublist', {
        method: 'post',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
          origin: 'https://music.163.com',
          Referer: 'https://music.163.com',
          cookie,
        },
        form: weapi({
          limit,
          offset,
          total: true,
          csrf_token: csrfToken || '',
        }),
      })
      const { body } = await requestObj.promise
      if (body.code !== 200) throw new Error('获取关注歌手列表失败')
      // /weapi/artist/sublist 返回的 body.data 直接就是歌手数组（与手机魔改版一致），
      // 但部分版本可能嵌套在 data.data，这里做兼容处理。
      const raw = body.data
      const list = Array.isArray(raw) ? raw : (raw?.data || [])
      return {
        artists: list,
        total: Array.isArray(raw) ? list.length : (raw?.total || list.length),
        hasMore: Array.isArray(raw) ? false : !!raw?.hasMore,
      }
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.getSublist(limit, offset, retryNum + 1)
      } else {
        console.error('获取关注歌手列表失败 (重试次数已达上限)', error)
        throw error
      }
    }
  },

  async getSubAlbumList(limit = 100, offset = 0, retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200
    try {
      const cookie = appSetting['common.wy_cookie']
      if (!cookie) throw new Error('请先设置网易云 Cookie')
      const csrfToken = (cookie.match(/_csrf=([^(;|$)]+)/) || [])[1]
      const requestObj = httpFetch('https://music.163.com/weapi/album/sublist', {
        method: 'post',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
          origin: 'https://music.163.com',
          Referer: 'https://music.163.com',
          cookie,
        },
        form: weapi({
          limit,
          offset,
          total: true,
          csrf_token: csrfToken || '',
        }),
      })
      const { body } = await requestObj.promise
      if (body.code !== 200) throw new Error('获取收藏专辑列表失败')
      // /weapi/album/sublist 返回的 body.data 直接就是专辑数组（与手机魔改版一致），
      // 但部分版本可能嵌套在 data.data，这里做兼容处理。
      const raw = body.data
      const list = Array.isArray(raw) ? raw : (raw?.data || [])
      return {
        albums: list,
        total: Array.isArray(raw) ? list.length : (raw?.total || list.length),
        hasMore: Array.isArray(raw) ? false : !!raw?.hasMore,
      }
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.getSubAlbumList(limit, offset, retryNum + 1)
      } else {
        console.error('获取收藏专辑列表失败 (重试次数已达上限)', error)
        throw error
      }
    }
  },

  async getAllSublist() {
    let allArtists = []
    let offset = 0
    const limit = 100
    while (true) {
      const result = await this.getSublist(limit, offset)
      const artists = result.artists || []
      allArtists = allArtists.concat(artists)
      if (artists.length < limit) break
      offset += limit
    }
    return allArtists
  },

  async getAllSubAlbumList() {
    let allAlbums = []
    let offset = 0
    const limit = 100
    while (true) {
      const result = await this.getSubAlbumList(limit, offset)
      const albums = result.albums || []
      allAlbums = allAlbums.concat(albums)
      if (albums.length < limit) break
      offset += limit
    }
    return allAlbums
  },

  async followSinger(id, isFollow, retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200
    const cookie = appSetting['common.wy_cookie']
    if (!cookie) return Promise.reject(new Error('未设置Cookie'))

    const action = isFollow ? 'sub' : 'unsub'
    const requestObj = httpFetch(`https://music.163.com/weapi/artist/${action}`, {
      method: 'post',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
        origin: 'https://music.163.com',
        Referer: 'https://music.163.com',
        cookie,
      },
      form: weapi({
        artistId: id,
        artistIds: `['${id}']`,
      }),
    })

    try {
      const { body, statusCode } = await requestObj.promise
      if (statusCode !== 200 || body.code !== 200) {
        throw new Error((body && body.message) || '操作失败')
      }
      return body
    } catch (error) {
      if (retryNum < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.followSinger(id, isFollow, retryNum + 1)
      } else {
        throw error
      }
    }
  },

  async subAlbum(id, isSub, retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200
    const cookie = appSetting['common.wy_cookie']
    if (!cookie) return Promise.reject(new Error('未设置Cookie'))

    const action = isSub ? 'sub' : 'unsub'
    const requestObj = httpFetch(`https://music.163.com/weapi/album/${action}`, {
      method: 'post',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
        origin: 'https://music.163.com',
        Referer: 'https://music.163.com',
        cookie,
      },
      form: weapi({
        id,
      }),
    })

    try {
      const { body, statusCode } = await requestObj.promise
      if (statusCode !== 200 || body.code !== 200) {
        throw new Error((body && body.message) || '操作失败')
      }
      return body
    } catch (error) {
      if (retryNum < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.subAlbum(id, isSub, retryNum + 1)
      } else {
        throw error
      }
    }
  },

  async subPlaylist(id, isSub, retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200
    const cookie = appSetting['common.wy_cookie']
    if (!cookie) return Promise.reject(new Error('未设置Cookie'))

    const csrfToken = (cookie.match(/_csrf=([^(;|$)]+)/) || [])[1]
    const action = isSub ? 'subscribe' : 'unsubscribe'
    const requestObj = httpFetch(`https://music.163.com/weapi/playlist/${action}`, {
      method: 'post',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
        origin: 'https://music.163.com',
        Referer: 'https://music.163.com',
        cookie,
      },
      form: weapi({
        id,
        csrf_token: csrfToken || '',
      }),
    })

    try {
      const { body, statusCode } = await requestObj.promise
      if (statusCode !== 200 || body.code !== 200) {
        throw new Error((body && body.message) || '操作失败')
      }
      return body
    } catch (error) {
      if (retryNum < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.subPlaylist(id, isSub, retryNum + 1)
      } else {
        throw error
      }
    }
  },

  async scrobble(songId, sourceId, duration, retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 500

    const cookie = appSetting['common.wy_cookie']
    if (!cookie) return Promise.reject(new Error('未设置Cookie'))
    const csrfToken = (cookie.match(/_csrf=([^(;|$)]+)/) || [])[1]
    const payload = {
      logs: JSON.stringify([{
        action: 'play',
        json: {
          id: songId,
          download: 0,
          type: 'song',
          sourceId: String(sourceId),
          time: Math.floor(duration),
          end: 'playend',
          wifi: 0,
        },
      }]),
    }

    const requestObj = httpFetch('https://music.163.com/weapi/feedback/weblog', {
      method: 'post',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
        origin: 'https://music.163.com',
        Referer: 'https://music.163.com',
        cookie,
      },
      form: weapi({
        ...payload,
        csrf_token: csrfToken || '',
      }),
    })

    try {
      const { body, statusCode } = await requestObj.promise
      if (statusCode !== 200 || body.code !== 200) {
        throw new Error((body && body.message) || '歌曲打点失败')
      }
      console.log('歌曲打点成功:', songId)
      return body
    } catch (error) {
      console.error(`歌曲打点失败 (尝试 ${retryNum + 1}/${maxRetries}):`, error)
      if (retryNum < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.scrobble(songId, sourceId, duration, retryNum + 1)
      } else {
        console.error('歌曲打点失败 (已达最大重试次数)', error)
        throw error
      }
    }
  },

  // 二维码登录相关接口
  async getQrKey(retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200
    try {
      const { body, statusCode } = await httpFetch('https://music.163.com/weapi/login/qrcode/unikey', {
        method: 'post',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
          origin: 'https://music.163.com',
          Referer: 'https://music.163.com',
        },
        form: weapi({ type: 1 }),
      }).promise
      if (statusCode !== 200 || body.code !== 200) throw new Error(body.message || '获取二维码密钥失败')
      return body.unikey || body.data?.unikey
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.getQrKey(retryNum + 1)
      }
      throw error
    }
  },

  async createQr(key, retryNum = 0) {
    // 网易没有独立的二维码生成接口（/weapi/login/qrcode/create 已实测 404）：
    // 二维码内容按官方 Web 扫码流程本地构造（codekey 格式）。
    // 2024+ 风控要求：二维码 URL 必须携带 chainId（格式 v1_设备ID_web_login_时间戳），
    // 否则手机端"授权成功"后不会绑定到该 key，轮询将永远停留在 801
    const deviceId = `unknown-${Math.floor(Math.random() * 1e6)}`
    const chainId = `v1_${deviceId}_web_login_${Date.now()}`
    return {
      qrimg: null,
      qrurl: `https://music.163.com/login?codekey=${key}&chainId=${chainId}`,
    }
  },

  async checkQr(key, retryNum = 0) {
    const maxRetries = 3
    const retryDelay = 200
    try {
      const { body, statusCode, headers } = await httpFetch('https://music.163.com/weapi/login/qrcode/client/login', {
        method: 'post',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.54',
          origin: 'https://music.163.com',
          Referer: 'https://music.163.com',
        },
        form: weapi({ key, type: 1 }),
      }).promise
      // 从响应头中提取 cookie（复用续期用的通用解析）
      const cookieMap = parseSetCookie(headers)
      const cookies = Object.keys(cookieMap).length
        ? Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join('; ')
        : null
      return {
        code: statusCode === 200 && body.code === 803 ? 803 : body.code,
        message: body.message || '',
        cookie: body.cookie || cookies,
        body,
      }
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.checkQr(key, retryNum + 1)
      }
      throw error
    }
  },

  /**
   * 续期：用当前仍有效的 MUSIC_U 调 token/refresh 换取新的登录凭证。
   * 必须在旧凭证过期前调用（服务端用当前凭证校验，过期则无法续期）。
   * 响应体可能为空，新凭证在 Set-Cookie 里；提取后与原 Cookie 合并回写。
   * 返回 { cookie, changed } —— changed 表示 MUSIC_U 是否真的变了。
   */
  async refreshToken(cookie, retryNum = 0) {
    const maxRetries = 2
    const retryDelay = 300
    if (!cookie) throw new Error('Cookie is required to refresh token')
    try {
      const { body, statusCode, headers } = await httpFetch('https://music.163.com/weapi/login/token/refresh', {
        method: 'post',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
          origin: 'https://music.163.com',
          Referer: 'https://music.163.com',
          cookie,
        },
        form: weapi({}),
      }).promise

      if (statusCode !== 200) throw new Error(`续期请求失败(HTTP ${statusCode})`)
      // body 可能为空字符串或 { code: 200 }，也可能返回业务错误码
      if (body && typeof body === 'object' && body.code && body.code !== 200) {
        // 301 / -462 等视为登录态失效，交给上层触发重新登录
        throw new Error(`续期失败(服务端code ${body.code})`)
      }

      const patch = parseSetCookie(headers)
      const newMusicU = patch.MUSIC_U
      if (!newMusicU) throw new Error('续期响应未返回新 MUSIC_U（凭证可能已过期，需重新登录）')

      const oldMusicU = (cookie.match(/MUSIC_U=([^;]+)/) || [])[1]
      const mergedCookie = mergeCookieString(cookie, patch)
      // 清掉 uid 缓存，避免续期后仍命中旧的 profile
      if (oldMusicU && oldMusicU !== newMusicU) uidCache.delete(toMD5(cookie))
      return { cookie: mergedCookie, changed: oldMusicU !== newMusicU }
    } catch (error) {
      if (retryNum < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
        return this.refreshToken(cookie, retryNum + 1)
      }
      throw error
    }
  },
}
