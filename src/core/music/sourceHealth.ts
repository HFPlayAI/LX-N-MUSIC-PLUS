// 音源健康统计 + 链接探活（移植自 ALXMusic，按本项目需求做了两点适配）
// 适配 1：探活改用 XMLHttpRequest 在 HEADERS_RECEIVED 阶段取状态码后立刻 abort，
//         RN 的 fetch polyfill 通常没有 Response.body，await fetch() 会把整首歌下载完才返回。
// 适配 2：探活结果改为三态 ok / suspect / dead。403、网络错误、超时一律「存疑放行」，
//         只有明确返回网页/JSON/纯文本才判死链，避免防盗链链接被误杀。
import { getData, saveData } from '@/plugins/storage'
import { log } from '@/utils/log'

const STORAGE_KEY = '@alx_source_health_v1'
const MAX_EVENTS = 40
const FAIL_THRESHOLD = 3 // 连续失败次数达到后进入冷却
const BASE_COOLDOWN = 60 * 1000
const MAX_COOLDOWN = 30 * 60 * 1000

export interface SourceStat {
  key: string
  source: string
  apiSource: string
  attempts: number
  success: number
  avgMs: number
  lastOkAt: number
  lastFailAt: number
  lastError: string
  consecutiveFails: number
  cooldownUntil: number
}

export interface HealthEvent {
  at: number
  text: string
}

export type UrlProbeResult = 'ok' | 'suspect' | 'dead'

const stats = new Map<string, SourceStat>()
const events: HealthEvent[] = []
let initPromise: Promise<void> | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null

export const buildKey = (apiSource: string, source: string) => `${apiSource || 'builtin'}::${source}`

const scheduleSave = () => {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void saveData(STORAGE_KEY, [...stats.values()]).catch(err => {
      log.warn('[source health] save failed', err)
    })
  }, 800)
}

export const initSourceHealth = async() => {
  if (initPromise) return initPromise
  initPromise = (async() => {
    try {
      const saved = await getData<SourceStat[]>(STORAGE_KEY)
      if (Array.isArray(saved)) {
        for (const s of saved) {
          if (!s || !s.key) continue
          // 重启后冷却清空，但成败统计保留
          stats.set(s.key, { ...s, cooldownUntil: 0 })
        }
      }
    } catch (err) {
      log.warn('[source health] load failed', err)
    }
  })()
  return initPromise
}

const ensure = (apiSource: string, source: string): SourceStat => {
  const key = buildKey(apiSource, source)
  let st = stats.get(key)
  if (!st) {
    st = {
      key, source, apiSource,
      attempts: 0, success: 0, avgMs: 0,
      lastOkAt: 0, lastFailAt: 0, lastError: '',
      consecutiveFails: 0, cooldownUntil: 0,
    }
    stats.set(key, st)
  }
  return st
}

export const pushEvent = (text: string) => {
  events.unshift({ at: Date.now(), text })
  if (events.length > MAX_EVENTS) events.length = MAX_EVENTS
}
export const getEvents = () => events.slice()

export const recordSuccess = (apiSource: string, source: string, ms: number) => {
  const st = ensure(apiSource, source)
  st.attempts++
  st.success++
  st.avgMs = st.avgMs ? Math.round(st.avgMs * 0.7 + ms * 0.3) : ms
  st.lastOkAt = Date.now()
  st.consecutiveFails = 0
  st.cooldownUntil = 0
  scheduleSave()
}

export const recordFail = (apiSource: string, source: string, ms: number, err: unknown) => {
  const st = ensure(apiSource, source)
  st.attempts++
  st.lastFailAt = Date.now()
  st.lastError = String((err as any)?.message ?? err ?? '').slice(0, 120)
  st.consecutiveFails++
  if (st.consecutiveFails >= FAIL_THRESHOLD) {
    const level = st.consecutiveFails - FAIL_THRESHOLD
    st.cooldownUntil = Date.now() + Math.min(BASE_COOLDOWN * Math.pow(2, level), MAX_COOLDOWN)
  }
  scheduleSave()
}

export const isCoolingDown = (apiSource: string, source: string) => {
  const st = stats.get(buildKey(apiSource, source))
  return !!st && st.cooldownUntil > Date.now()
}

export const getCooldownLeft = (apiSource: string, source: string) => {
  const st = stats.get(buildKey(apiSource, source))
  return st ? Math.max(0, st.cooldownUntil - Date.now()) : 0
}

// 健康分：成功率为主，延迟为辅；没数据的源给 0.5 的探索分
export const healthScore = (apiSource: string, source: string) => {
  const st = stats.get(buildKey(apiSource, source))
  if (!st || !st.attempts) return 0.5
  const rate = st.success / st.attempts
  const speed = st.avgMs ? Math.min(1, 1500 / Math.max(st.avgMs, 1)) : 0.5
  return rate * 0.75 + speed * 0.25
}

export const getStats = () => [...stats.values()].sort((a, b) => b.attempts - a.attempts)

export const clearStats = async() => {
  stats.clear()
  events.length = 0
  await saveData(STORAGE_KEY, []).catch(() => {})
}

/**
 * Range 探活：只取响应头，绝不下载响应体。
 * ok      = 200/206 且非网页类 content-type
 * dead    = 明确返回 html / json / text/plain（音源把错误页当成链接返回）
 * suspect = 403 / 404 / 5xx / 网络错误 / 超时 / 非 http(s) —— 存疑放行，交给播放器裁决
 */
export const probeAudioUrl = (url: string, timeout = 4000): Promise<UrlProbeResult> => new Promise(resolve => {
  if (!/^https?:/i.test(url)) {
    resolve('suspect')
    return
  }
  let settled = false
  let timer: ReturnType<typeof setTimeout>
  const finish = (result: UrlProbeResult) => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    try { xhr.abort() } catch {}
    resolve(result)
  }
  const xhr = new XMLHttpRequest()
  timer = setTimeout(() => finish('suspect'), timeout)

  xhr.onreadystatechange = () => {
    if (xhr.readyState < 2) return
    let status = 0
    let ct = ''
    try {
      status = xhr.status
      ct = (xhr.getResponseHeader('content-type') || '').toLowerCase()
    } catch {}
    // 部分实现要到 LOADING 才填 status，继续等
    if (!status) return
    if (/html|json|text\/plain/.test(ct)) {
      finish('dead')
      return
    }
    finish(status === 200 || status === 206 ? 'ok' : 'suspect')
  }
  xhr.onerror = () => finish('suspect')
  xhr.ontimeout = () => finish('suspect')
  try {
    xhr.open('GET', url, true)
    xhr.setRequestHeader('Range', 'bytes=0-2047')
    xhr.send()
  } catch {
    finish('suspect')
  }
})
