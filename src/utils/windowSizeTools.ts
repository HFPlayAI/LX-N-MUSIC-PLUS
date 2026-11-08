import { Dimensions, StatusBar } from 'react-native'
import { getWindowSize as getWindowSizeRaw } from './nativeModules/utils'
import { log } from './log'

export type SizeHandler = (size: { width: number, height: number }) => void
export type DirectionHandler = (isHorizontal: boolean) => void

/**
 * 旋转过程中 Android 会连续上报交替的竖屏/横屏尺寸。方向必须由全局唯一的
 * 一处做去抖确认：旧实现里每个 useHorizontalMode() 各自起一个 150ms 定时器，
 * 父子组件会在不同时刻确认方向——Home 树还停在竖屏时，列表已按横屏把
 * numColumns 从 1 改成 2，触发 RN 的
 * 「Changing numColumns on the fly is not supported」，错误边界随即重建页面
 * （表现为旋转时闪一下 / 日志里成对的 [render error] + [JS NONFATAL]）。
 * 统一到这里后，一次旋转只广播一次方向变化，所有组件同一时刻切换。
 */
const DIRECTION_CONFIRM_DELAY = 150
// 与 utils/tools.ts 的 isHorizontalMode 保持一致；内联以避免两个模块循环依赖
const isHorizontalSize = (width: number, height: number) => width / height > 1.2

let directionTimer: ReturnType<typeof setTimeout> | null = null

const logHandlerError = (scope: string, err: unknown) => {
  const message = err instanceof Error ? (err.stack ?? err.message) : String(err)
  console.log(`${scope} handler error:`, message)
  log.error(`[windowSizeTools] ${scope} handler error: ${message}`)
}

export const getWindowSize = async() => {
  return getWindowSizeRaw().then((size) => {
    const scale = Dimensions.get('window').scale
    size.width = size.width / scale
    size.height = size.height / scale
    return size
  })
}

export const windowSizeTools = {
  size: {
    width: 0,
    height: 0,
  },
  // 方向确认时锁定的尺寸快照。列表的列数/行宽/行高只认它，
  // 过渡态尺寸不参与布局计算。
  stableSize: {
    width: 0,
    height: 0,
  },
  // 全局唯一的稳定方向，所有组件通过 useHorizontalMode() 订阅同一个值
  stableHorizontal: false,
  listeners: [] as SizeHandler[],
  directionListeners: [] as DirectionHandler[],
  getSize() {
    return this.size
  },
  getStableSize() {
    return this.stableSize
  },
  getStableHorizontal() {
    return this.stableHorizontal
  },
  onSizeChanged(handler: SizeHandler) {
    this.listeners.push(handler)

    return () => {
      // 旋转时同一 handler 可能被重复注销；indexOf 为 -1 时 splice(-1, 1)
      // 会误删数组里最后一个（往往还没收到尺寸更新）的订阅者。
      const index = this.listeners.indexOf(handler)
      if (index >= 0) this.listeners.splice(index, 1)
    }
  },
  onDirectionChanged(handler: DirectionHandler) {
    this.directionListeners.push(handler)

    return () => {
      const index = this.directionListeners.indexOf(handler)
      if (index >= 0) this.directionListeners.splice(index, 1)
    }
  },
  // 与 size 订阅同样取快照并隔离异常：方向变化会让 Home / 设置页整棵树
  // 卸载重建，卸载过程又会注销订阅者，直接遍历原数组会漏掉后面的组件。
  notifyDirection() {
    for (const handler of this.directionListeners.slice()) {
      try {
        handler(this.stableHorizontal)
      } catch (err) {
        logHandlerError('direction', err)
      }
    }
  },
  confirmDirection() {
    const raw = isHorizontalSize(this.size.width, this.size.height)
    if (raw == this.stableHorizontal) {
      // 过渡态弹回原方向：撤销待确认的切换，只同步稳定尺寸
      if (directionTimer != null) {
        clearTimeout(directionTimer)
        directionTimer = null
      }
      this.stableSize = { ...this.size }
      return
    }
    if (directionTimer != null) clearTimeout(directionTimer)
    directionTimer = setTimeout(() => {
      directionTimer = null
      // 到期时重新以最新尺寸确认，避免用定时那一刻的中间态下结论
      const confirmed = isHorizontalSize(this.size.width, this.size.height)
      this.stableSize = { ...this.size }
      if (confirmed == this.stableHorizontal) return
      this.stableHorizontal = confirmed
      this.notifyDirection()
    }, DIRECTION_CONFIRM_DELAY)
  },
  async init() {
    // Dimensions.addEventListener('change', () => {
    //   void getWindowSize().then((size) => {
    //     if (!size.width) return
    //     const scale = Dimensions.get('screen').scale
    //     size.width = Math.round(size.width / scale)
    //     size.height = Math.round(size.height / scale) + (StatusBar.currentHeight ?? 0)
    //     this.size = size
    //     for (const handler of this.listeners) handler(size)
    //   })
    // })
    const size = await getWindowSize()
    // log.info('win size', size)
    if (size.width) {
      this.size = size
    } else {
      const window = Dimensions.get('window')
      // log.info('Dimensions window size', window)
      this.size = {
        width: Math.round(window.width),
        height: Math.round(window.height) + (StatusBar.currentHeight ?? 0),
      }
    }
    const prevDirection = this.stableHorizontal
    this.stableSize = { ...this.size }
    this.stableHorizontal = isHorizontalSize(this.size.width, this.size.height)
    if (prevDirection != this.stableHorizontal) this.notifyDirection()
    // console.log('init windowSizeTools')
    return size
  },
  setWindowSize(width: number, height: number) {
    this.size = {
      width: Math.round(width),
      height: Math.round(height),
    }
    this.confirmDirection()
    // 旋转时第一个 handler 触发 setState 会立刻卸载旧方向整棵组件树，
    // 卸载过程又会从 this.listeners 里移除订阅者。直接遍历原数组会导致
    // 后续订阅者被跳过（甚至 handler 为 undefined 抛错），使部分组件停留在
    // 旧尺寸/旧方向，表现为白屏且 React 错误边界捕获不到（异常在 Promise 回调里）。
    // 这里取快照并逐个隔离异常，保证每个订阅者都能拿到最新尺寸。
    for (const handler of this.listeners.slice()) {
      try {
        handler(this.size)
      } catch (err) {
        logHandlerError('window size', err)
      }
    }
  },
}
