import { useEffect } from 'react'
import { useHorizontalMode } from '@/utils/hooks'
import { windowSizeTools } from '@/utils/windowSizeTools'
import { log } from '@/utils/log'
import AppErrorBoundary from '@/components/common/AppErrorBoundary'
import PageContent from '@/components/PageContent'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import Vertical from './Vertical'
import Horizontal from './Horizontal'
import { navigations } from '@/navigation'
import settingState from '@/store/setting/state'
import ArtistSelectorManager from '@/components/ArtistSelectorManager'
import VideoPlayerManager from '@/components/VideoPlayerManager'


interface Props {
  componentId: string
}

// 模块级记录：只在稳定方向真正变化时写一条，避免旋转期间刷屏
let lastLoggedDirection: boolean | null = null


export default ({ componentId }: Props) => {
  const isHorizontalMode = useHorizontalMode()
  useEffect(() => {
    setComponentId(COMPONENT_IDS.home, componentId)
    // eslint-disable-next-line react-hooks/exhaustive-deps

    if (settingState.setting['player.startupPushPlayDetailScreen']) {
      navigations.pushPlayDetailScreen(componentId, true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 记录方向切换是否真的传到了 JS 层，便于在「设置 → 其他 → 查看日志」里
  // 区分「JS 未收到尺寸事件」和「收到了但渲染抛错」两类白屏。
  useEffect(() => {
    if (lastLoggedDirection === isHorizontalMode) return
    lastLoggedDirection = isHorizontalMode
    const size = windowSizeTools.getSize()
    log.info(`[orientation] ${isHorizontalMode ? '横屏' : '竖屏'} ${size.width}x${size.height}`)
  }, [isHorizontalMode])

  return (
    // key 随方向变化：旋转时重建边界，避免沿用旧方向残留的错误状态。
    <AppErrorBoundary key={isHorizontalMode ? 'home-horizontal' : 'home-vertical'}>
      <PageContent>
        {
          isHorizontalMode
            ? <Horizontal />
            : <Vertical />
        }
        <ArtistSelectorManager />
        <VideoPlayerManager />
      </PageContent>
    </AppErrorBoundary>
  )
}
