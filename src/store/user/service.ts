import musicSdk from '@/utils/musicSdk'
import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'
import { saveData } from '@/plugins/storage'
import { storageDataPrefix } from '@/config/constant'
import { toast } from '@/utils/tools'
import BackgroundTimer from 'react-native-background-timer'
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
  initWyUser,
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

export const getCookieAt = (): number => {
  return settingState.setting['common.wy_cookie_at'] || 0
}

/**
 * 设置更新是 throttle 落盘的（100ms）。续期后的新 Cookie 是关键凭证，
 * 必须立即写盘，否则用户马上杀进程会丢失续期结果、退回旧凭证。
 */
const saveSettingNow = async() => {
  await saveData(storageDataPrefix.setting, settingState.setting)
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
const upsertAccount = (cookie: string, profile: WyUserProfile, cookieAt?: number) => {
  const accounts = getSavedAccounts().filter(a => a.uid !== profile.uid)
  accounts.unshift({
    cookie,
    nickname: profile.nickname,
    avatarUrl: profile.avatarUrl,
    uid: profile.uid,
    cookieAt: cookieAt ?? Date.now(),
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
  const now = Date.now()
  updateSetting({ 'common.wy_cookie': cleanCookie, 'common.wy_cookie_at': now })
  await saveSettingNow()
  upsertAccount(cleanCookie, profile, now)
  setWyUid(profile.uid)
  setWyVipType(profile.vipType)
  setWyProfile(profile)
  void refreshUserData(cleanCookie)
  return profile
}

/**
 * 续期当前登录态：用尚未过期的 MUSIC_U 调 token/refresh 换新凭证。
 *
 * 关键点：必须在旧凭证过期前调用。服务端用当前凭证校验，一旦过期就救不回来，
 * 只能重新登录。所以由调用方（启动探活 / 定时任务）在到期前提前触发。
 *
 * 成功后新 Cookie 与原 Cookie 合并（保留 os/appver/deviceId 等），
 * 更新签发时间、同步已保存账号列表，并立即落盘。
 *
 * 返回 true 表示续期成功；false 表示无需续期（未登录/开关关闭）。
 * 失败抛异常，由调用方决定是否提示重新登录。
 */
export const refreshLoginCookie = async(): Promise<boolean> => {
  const cookie = getCurrentCookie()
  if (!cookie) return false
  if (!settingState.setting['common.wy_auto_refresh']) return false

  const result = await wyUser().refreshToken(cookie)
  const now = Date.now()
  updateSetting({ 'common.wy_cookie': result.cookie, 'common.wy_cookie_at': now })

  // 同步已保存账号列表里同一 uid 的 cookie，避免"当前源续期了、账号列表还是旧的"
  const uid = userState.wy_uid
  if (uid) {
    const accounts = getSavedAccounts().map(a =>
      a.uid === uid ? { ...a, cookie: result.cookie, cookieAt: now } : a,
    )
    updateSetting({ 'common.wy_accounts': accounts })
  }
  await saveSettingNow()
  return result.changed
}

/**
 * 判断 Cookie 是否需要续期。基于签发时间 + 固定周期。
 *
 * 网易 web MUSIC_U 实际寿命约 7~30 天（观察值约 10 天）。为了在过期前
 * 留出充足余量，默认 REFRESH_INTERVAL = 3 天就主动续一次；即使某次失败，
 * 之后每次启动/定时都会重试，仍有 7 天窗口。
 */
const REFRESH_INTERVAL = 3 * 24 * 60 * 60 * 1000
export const isCookieRefreshDue = (): boolean => {
  if (!getCurrentCookie()) return false
  if (!settingState.setting['common.wy_auto_refresh']) return false
  const at = getCookieAt()
  if (!at) return true // 老存档没有签发时间，启动时先续一次以建立基准
  return Date.now() - at >= REFRESH_INTERVAL
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

// ============ 登录态保活：启动探活 + 定时续期 ============

// 定时检查间隔：6 小时。配合 REFRESH_INTERVAL（3 天）判断是否需要续期，
// 即使某次续期失败，一天内仍有 4 次重试机会，远早于 Cookie 到期（约 10 天）。
const AUTO_REFRESH_CHECK_INTERVAL = 6 * 60 * 60 * 1000
let refreshTimer: ReturnType<typeof BackgroundTimer.setInterval> | null = null
const refreshState = { running: false }

/**
 * 执行一次保活检查：需要续期时续期，随后（重新）拉取用户资料。
 * 续期失败不阻断资料拉取——旧 Cookie 可能仍有效，让它有机会继续工作；
 * 只有当后续 getUid 也失败时，才判定真正过期并提示用户。
 */
const runKeepAlive = async() => {
  if (refreshState.running) return
  refreshState.running = true
  try {
    if (isCookieRefreshDue() && getCurrentCookie()) {
      try {
        await refreshLoginCookie()
        console.log('[wy] cookie 续期成功')
      } catch (err: any) {
        // 续期失败不致命，保留旧 Cookie 继续尝试拉资料
        console.warn('[wy] cookie 续期失败，尝试用现有凭证:', err?.message ?? err)
      }
    }
    await initWyUser()
  } finally {
    refreshState.running = false
  }
}

/**
 * 应用启动时调用：先做一次保活检查（含必要时续期），再挂定时任务。
 * 替代原来「仅冷启动拉一次资料、失败静默」的行为。
 */
export const initWyUserWithRefresh = async() => {
  if (!getCurrentCookie()) return // 未登录不启动保活

  await runKeepAlive()

  if (refreshTimer != null) {
    BackgroundTimer.clearInterval(refreshTimer)
    refreshTimer = null
  }
  if (!settingState.setting['common.wy_auto_refresh']) return
  refreshTimer = BackgroundTimer.setInterval(() => {
    void runKeepAlive()
  }, AUTO_REFRESH_CHECK_INTERVAL)
}

/**
 * 供 UI「立即刷新凭证」按钮调用：强制续期一次（忽略周期判断）。
 * 返回是否成功；失败时 toast 提示。
 */
export const refreshNow = async(): Promise<boolean> => {
  if (!getCurrentCookie()) {
    toast('未登录，无法续期')
    return false
  }
  try {
    await refreshLoginCookie()
    toast('登录凭证已刷新')
    return true
  } catch (err: any) {
    toast(`凭证刷新失败：${err?.message ?? err}`)
    return false
  }
}
