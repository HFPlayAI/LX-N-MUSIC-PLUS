import { useHorizontalMode } from '@/utils/hooks'
import Vertical from './Vertical'
import Horizontal from './Horizontal'
import { useBackHandler } from '@/utils/hooks/useBackHandler'
import { useCallback } from 'react'
// import { AppColors } from '@/theme'
import commonState from '@/store/common/state'
import { setNavActiveId } from '@/core/common'
import SettingErrorBoundary from './components/SettingErrorBoundary'

export type { SettingScreenIds } from './Main'

export default () => {
  const isHorizontalMode = useHorizontalMode()
  useBackHandler(useCallback(() => {
    if (Object.keys(commonState.componentIds).length == 1 && commonState.navActiveId == 'nav_setting') {
      setNavActiveId(commonState.lastNavActiveId)
      return true
    }
    return false
  }, []))

  // key 随方向变化：旋转时彻底重建边界与子树，避免复用半旧状态；
  // 同时把 NavList 等原先在边界之外的组件也纳入兜底，异常时显示文字而非白屏。
  return (
    <SettingErrorBoundary key={isHorizontalMode ? 'horizontal' : 'vertical'}>
      {isHorizontalMode ? <Horizontal /> : <Vertical />}
    </SettingErrorBoundary>
  )
}
