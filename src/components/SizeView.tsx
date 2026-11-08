import { memo, useCallback, useRef, useEffect } from 'react'
import { type LayoutChangeEvent, StyleSheet, View, StatusBar, Dimensions } from 'react-native'
import commonState from '@/store/common/state'
import settingState from '@/store/setting/state'
import { setStatusbarHeight } from '@/core/common'
import { windowSizeTools, getWindowSize } from '@/utils/windowSizeTools'

const getStatusbarHeight = (winHeight: number, layoutHeight: number) => {
  const height = (!settingState.setting['common.alwaysKeepStatusbarHeight'] &&
          parseFloat(winHeight.toFixed(2)) >= parseFloat(layoutHeight.toFixed(2)))
    ? 0
    : (StatusBar.currentHeight ?? 0)

  return height
}

export default memo(() => {
  const currentHeightRef = useRef(commonState.statusbarHeight)
  const sizeRef = useRef([0, 0])
  const dimensionsChangedRef = useRef(true)
  const requestIdRef = useRef(0)
  const handleLayout = useCallback(({ nativeEvent: { layout } }: LayoutChangeEvent | { nativeEvent: { layout: { width: number, height: number } } }) => {
    // console.log('handleLayout')
    if (!dimensionsChangedRef.current) return
    // 旋转时 Dimensions change 与 onLayout 会连续触发多次，getWindowSize 是异步的，
    // 回调可能乱序返回。只接受最后一次请求的结果，避免旧尺寸覆盖新尺寸。
    const requestId = ++requestIdRef.current
    void getWindowSize().then(size => {
      if (requestId != requestIdRef.current) return
      dimensionsChangedRef.current = false
      // console.log(layout, size)
      sizeRef.current = [size.height, layout.height]
      const height = getStatusbarHeight(size.height, layout.height)

      if (currentHeightRef.current != height) {
        currentHeightRef.current = height
        setStatusbarHeight(height)
      }
      // 用原生窗口尺寸作为权威值。layout 是 React 视图在旋转重建过程中的
      // 中间态尺寸，把它写回 windowSizeTools 会形成「竖→横→竖→横」自激振荡：
      // 方向一变就卸载重建整棵 Home 树，重建又触发 onLayout 报回旧尺寸。
      // 真机表现为旋转白屏，并刷出大量方向切换日志。
      const width = Math.round(size.width)
      const winHeight = Math.round(size.height)
      const currentSize = windowSizeTools.getSize()
      if (currentSize.width != width || currentSize.height != winHeight) {
        windowSizeTools.setWindowSize(width, winHeight)
      }
    })
  }, [])
  useEffect(() => {
    // let timeout: NodeJS.Timeout | null = null
    const subscription = Dimensions.addEventListener('change', () => {
      dimensionsChangedRef.current = true
      // if (timeout) clearTimeout(timeout)
      // timeout = setTimeout(() => {
      //   timeout = null
      //   viewRef.current?.measureInWindow((x, y, width, height) => {
      //     handleLayout({ nativeEvent: { layout: { width, height } } })
      //   })
      // }, 100)
    })

    const handleSettingUpdate = (keys: Array<keyof LX.AppSetting>) => {
      if (!keys.includes('common.alwaysKeepStatusbarHeight') || !sizeRef.current[1]) return
      const height = getStatusbarHeight(sizeRef.current[0], sizeRef.current[1])

      if (currentHeightRef.current != height) {
        currentHeightRef.current = height
        setStatusbarHeight(height)
      }
    }
    global.state_event.on('configUpdated', handleSettingUpdate)

    return () => {
      subscription.remove()
      global.state_event.off('configUpdated', handleSettingUpdate)
    }
  }, [])
  return (<View style={StyleSheet.absoluteFill} onLayout={handleLayout} />)
}, () => true)

