import { memo, useEffect } from 'react'
import { View, AppState } from 'react-native'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import StatusBar from '@/components/common/StatusBar'
import MoreBtn from './MoreBtn'

import Header from './components/Header'
import { setComponentId } from '@/core/common'
import { COMPONENT_IDS } from '@/config/constant'
import PageContent from '@/components/PageContent'
import commonState, { type InitState as CommonState } from '@/store/common/state'

import Pic from './Pic'
// import ControlBtn from './ControlBtn'
import Lyric from './Lyric'
import Player from './Player'
import DetailManager from '@/screens/Home/DetailManager'
import { useHomeDetailStack, useStatusbarHeight } from '@/store/common/hook'
import { createStyle } from '@/utils/tools'
import { marginLeftRaw } from './constant'

import PlayerBar from '@/components/player/PlayerBar'
// import MoreBtn from './MoreBtn2'

export default memo(({ componentId }: { componentId: string }) => {
  const statusBarHeight = useStatusbarHeight()
  const detailStack = useHomeDetailStack('playDetail')
  // 详情打开时隐藏播放器内容：避免全屏内容穿透到详情层之上（视觉重叠）
  const hasDetail = detailStack.length > 0

  useEffect(() => {
    setComponentId(COMPONENT_IDS.playDetail, componentId)
    screenkeepAwake()
    let appstateListener = AppState.addEventListener('change', (state) => {
      switch (state) {
        case 'active':
          if (!commonState.componentIds.comment) screenkeepAwake()
          break
        case 'background':
          screenUnkeepAwake()
          break
      }
    })

    const handleComponentIdsChange = (ids: CommonState['componentIds']) => {
      if (ids.comment) screenUnkeepAwake()
      else if (AppState.currentState == 'active') screenkeepAwake()
    }

    global.state_event.on('componentIdsUpdated', handleComponentIdsChange)

    return () => {
      global.state_event.off('componentIdsUpdated', handleComponentIdsChange)
      appstateListener.remove()
      screenUnkeepAwake()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <PageContent>
      <StatusBar />
      <View style={styles.contentWrap}>
        <View style={hasDetail ? styles.hidden : styles.fill}>
          <View style={{ ...styles.container, paddingTop: statusBarHeight }}>
            <View style={styles.left}>
              <Header />
              <View style={styles.leftContent}>
                <MoreBtn componentId={componentId} />
                <Pic componentId={componentId} />
              </View>
              <Player />
              {/* <View style={styles.controlBtn} nativeID="pageIndicator">
                <MoreBtn />
                <ControlBtn />
              </View> */}
            </View>
            <View style={styles.right}>
              <Lyric />
            </View>
          </View>
        </View>
        {/* 详情层只覆盖内容区，底部播放条保留（与主窗口详情一致） */}
        <DetailManager host="playDetail" />
      </View>
      {hasDetail ? <PlayerBar disableNavigate /> : null}
    </PageContent>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  contentWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
  left: {
    flex: 1,
    width: '45%',
    paddingBottom: 10,
    // backgroundColor: 'rgba(0,0,0,0.1)',
  },
  leftContent: {
    flexShrink: 1,
    flexGrow: 0,
    marginLeft: marginLeftRaw,
    // flexDirection: 'row',
    // backgroundColor: 'rgba(0,0,0,0.1)',
    // alignItems: 'center',
  },
  right: {
    width: '55%',
    flexGrow: 0,
    flexShrink: 0,
  },
  controlBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // backgroundColor: '#eee',
  },
})
