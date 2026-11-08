import musicSdk from '@/utils/musicSdk'
import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'
import userState from './state'
import {
  setWyUid,
  setWyVipType,
  setWyProfile,
  setWyLikedSongs,
  setWyLikedPlaylistId,
  setWyFollowedArtists,
  setWySubscribedAlbums,
  applyWyPlaylists,
  loadWyPlaylists,
} from './action'
import type { WyUserProfile, FollowedArtistInfo, SubscribedAlbumInfo } from './state'

/**
 * 网易云账号登录服务：Cookie 登录 / 扫码登录 / 多账号管理 / 退出登录 / 刷新信息
 * 数据持久化在设置中：common.wy_cookie（当前登录）、common.wy_accounts（已保存账号列表）
 */

const wyUser = () => musicSdk.wy.user

export const getSavedAccounts = (): LX.WyAccountInfo[] => {
  return settingState.setting['common.wy_accounts'] || []
}

export const getCurrentCookie = (): string => {
  return settingState.setting['common.wy_cookie'] || ''
}

/**
 * 使用 Cookie 拉取账号资料。失败时抛出异常（登录过期 / Cookie 无效）。
 */
export const fetchProfile = async(cookie: string): Promise<WyUserProfile> => {
  return wyUser().getProfile(cookie)
}

/**
 * 将账号信息写入已保存账号列表（去重，按 uid）
 */
const upsertAccount = (cookie: string, profile: WyUserProfile) => {
  const accounts = getSavedAccounts().filter(a => a.uid !== profile.uid)
  accounts.unshift({
    cookie,
    nickname: profile.nickname,
    avatarUrl: profile.avatarUrl,
    uid: profile.uid,
  })
  updateSetting({ 'common.wy_accounts': accounts })
}

/**
 * 拉取登录态相关数据（喜欢列表 / 喜欢歌单 ID / 关注歌手 / 收藏专辑 / 歌单）
 */
export const refreshUserData = async(cookie: string) => {
  const uid = settingState.setting['common.wy_cookie'] ? await wyUser().getUid(cookie) : null
  if (!uid) return
  // 喜欢（红心）列表
  try {
    const likedIds = await wyUser().getLikedSongList(uid, cookie)
    if (Array.isArray(likedIds)) setWyLikedSongs(likedIds.map((id: any) => String(id)))
  } catch (e) {
    console.warn('获取网易云喜欢列表失败', e)
  }
  // 「我喜欢的音乐」歌单 ID（specialType === 5）
  try {
    const playlists = await wyUser().getUserPlaylists(uid, cookie)
    if (playlists && playlists.length > 0) {
      const likedPlaylist = playlists.find((p: any) => p.specialType === 5) || playlists[0]
      setWyLikedPlaylistId(String(likedPlaylist.id))
      applyWyPlaylists(playlists as any[])
    }
  } catch (e) {
    console.warn('获取网易云歌单失败', e)
  }
  // 关注歌手
  try {
    const artists = await wyUser().getSublist()
    if (artists?.artists?.length) setWyFollowedArtists(artists.artists as FollowedArtistInfo[])
  } catch (e) {
    console.warn('获取关注歌手失败', e)
  }
  // 收藏专辑
  try {
    const albums = await wyUser().getSubAlbumList()
    if (albums?.albums?.length) setWySubscribedAlbums(albums.albums as SubscribedAlbumInfo[])
  } catch (e) {
    console.warn('获取收藏专辑失败', e)
  }
  // 歌单缓存
  void loadWyPlaylists()
}

/**
 * 清洗用户粘贴的 Cookie：
 * - 去掉 "Cookie:" 前缀、全角分号、换行/制表符
 * - 拆分为 name=value 对并按名称去重
 * - 只有裸 token 时自动包装为 MUSIC_U=token
 * - 缺少 os=pc 时补充（部分接口如红心需要 os=pc 才有效）
 */
export const sanitizeCookie = (raw: string): string => {
  let text = String(raw ?? '').trim()
  text = text.replace(/^cookie\s*:\s*/i, '')
  text = text.replace(/[\r\n\t]+/g, ' ').replace(/；/g, '; ')
  // 多个 Cookie 头粘贴在一起的情况（如 "MUSIC_U=xxx; ... Cookie: __csrf=yyy"）
  text = text.replace(/cookie\s*:\s*/gi, '')
  const pairs = text.split(';')
    .map(p => p.trim())
    .filter(p => p.includes('='))
  const map = new Map<string, string>()
  for (const pair of pairs) {
    const idx = pair.indexOf('=')
    const name = pair.slice(0, idx).trim()
    const value = pair.slice(idx + 1).trim()
    if (name && value && !map.has(name)) map.set(name, value)
  }
  // 裸 token（无 = 号且足够长）按 MUSIC_U 处理
  if (!map.has('MUSIC_U')) {
    const bare = text.replace(/[;\s]/g, '')
    if (!pairs.length && /^[A-Za-z0-9%_-]{32,}$/.test(bare)) {
      map.set('MUSIC_U', bare)
    }
  }
  if (!map.has('os')) {
    map.set('os', 'pc')
    map.set('osver', map.get('osver') ?? 'Microsoft-Windows-10-build-19045')
    map.set('appver', map.get('appver') ?? '2.10.13')
    map.set('channel', map.get('channel') ?? 'netease')
  }
  return Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('; ')
}

/**
 * Cookie 登录：校验 → 保存 Cookie 与账号 → 拉取用户数据
 */
export const loginWithCookie = async(cookie: string): Promise<WyUserProfile> => {
  const cleanCookie = sanitizeCookie(cookie)
  if (!/MUSIC_U=[^;]+/.test(cleanCookie)) {
    throw new Error('Cookie 无效：未找到 MUSIC_U 字段，请按说明重新提取')
  }
  const profile = await fetchProfile(cleanCookie)
  updateSetting({ 'common.wy_cookie': cleanCookie })
  upsertAccount(cleanCookie, profile)
  setWyUid(profile.uid)
  setWyVipType(profile.vipType)
  setWyProfile(profile)
  void refreshUserData(cleanCookie)
  return profile
}

/**
 * 切换到已保存账号
 */
export const switchAccount = async(account: LX.WyAccountInfo) => {
  await loginWithCookie(account.cookie)
}

/**
 * 删除已保存账号；若删除的是当前登录账号则同时退出登录
 */
export const removeAccount = (uid: string) => {
  const accounts = getSavedAccounts().filter(a => a.uid !== uid)
  updateSetting({ 'common.wy_accounts': accounts })
  // 当前账号被移除时登出
  const current = getCurrentProfile()
  if (current?.uid === uid) logout()
}

/**
 * 退出登录：清空登录态（保留已保存账号）
 */
export const logout = () => {
  updateSetting({ 'common.wy_cookie': '' })
  setWyUid(null)
  setWyProfile(null)
  setWyVipType(0)
  setWyLikedSongs([])
  setWyLikedPlaylistId(null)
  setWyFollowedArtists([])
  setWySubscribedAlbums([])
}

/**
 * 刷新信息：用当前 Cookie 重新拉取资料
 */
export const refreshProfile = async(): Promise<WyUserProfile> => {
  const cookie = getCurrentCookie()
  if (!cookie) throw new Error('未登录')
  const profile = await fetchProfile(cookie)
  upsertAccount(cookie, profile)
  setWyUid(profile.uid)
  setWyVipType(profile.vipType)
  setWyProfile(profile)
  void refreshUserData(cookie)
  return profile
}

export const getCurrentProfile = (): WyUserProfile | null => {
  return userState.wy_profile
}

// ============ 扫码登录 ============

export type QrLoginStatus = 'waiting' | 'scanned' | 'success' | 'expired' | 'error'

export interface QrLoginSession {
  key: string
  qrimg: string | null
  qrurl: string
  stopped: boolean
}

/**
 * 创建扫码登录会话（获取二维码）
 */
export const createQrSession = async(): Promise<QrLoginSession> => {
  const key = await wyUser().getQrKey()
  const { qrimg, qrurl } = await wyUser().createQr(key)
  return { key, qrimg, qrurl, stopped: false }
}

/**
 * 轮询扫码状态。resolve(cookie) 表示登录成功。
 * onStatus 回调用于 UI 显示：waiting / scanned / expired
 */
export const pollQrStatus = async(
  session: QrLoginSession,
  onStatus: (status: QrLoginStatus) => void,
  onLoginSuccess: (cookie: string) => Promise<void> | void,
  intervalMs = 1500,
  maxDurationMs = 120_000,
): Promise<void> => {
  const startTime = Date.now()
  return new Promise((resolve, reject) => {
    const poll = async() => {
      if (session.stopped) { resolve(); return }
      if (Date.now() - startTime > maxDurationMs) {
        onStatus('expired')
        resolve(); return
      }
      try {
        const result = await wyUser().checkQr(session.key)
        switch (result.code) {
          case 800: // 二维码过期
            onStatus('expired')
            resolve()
            return
          case 801: // 等待扫码
            onStatus('waiting')
            break
          case 802: // 已扫码待确认
            onStatus('scanned')
            break
          case 803: // 确认登录，返回 cookie
            onStatus('success')
            if (result.cookie) {
              await onLoginSuccess(String(result.cookie))
            }
            resolve()
            return
          default:
            onStatus('waiting')
            break
        }
        setTimeout(poll, intervalMs)
      } catch (err) {
        console.warn('轮询扫码状态失败', err)
        onStatus('error')
        setTimeout(poll, intervalMs * 2)
      }
    }
    void poll()
  })
}

/**
 * 终止扫码会话
 */
export const stopQrSession = (session: QrSessionLike) => {
  session.stopped = true
}

interface QrSessionLike {
  stopped: boolean
}
