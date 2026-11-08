import { useEffect, useState } from 'react'
import { windowSizeTools } from '@/utils/windowSizeTools'

/**
 * 订阅全局唯一的稳定方向（去抖确认在 windowSizeTools 里完成）。
 *
 * 以前每个组件自己用 useWindowSize() + 150ms 定时器确认方向，结果同一次
 * 旋转里各组件在不同时刻切换：Home 树还是竖屏时，子列表已经按横屏把
 * numColumns 改成 2，触发 RN 的 numColumns invariant 并由错误边界重建页面。
 * 现在所有组件读同一个值、在同一次广播里更新，不存在半新半旧的中间态。
 */
export default () => {
  const [isHorizontal, setIsHorizontal] = useState(() => windowSizeTools.getStableHorizontal())

  useEffect(() => windowSizeTools.onDirectionChanged(setIsHorizontal), [])

  return isHorizontal
}
