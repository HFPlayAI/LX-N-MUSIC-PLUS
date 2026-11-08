import { memo, useState, useRef, useMemo, useEffect } from 'react'
import { View, AppState } from 'react-native'

import Header from './components/Header'
// import Aside from './components/Aside'
// import Main from './components/Main'
import Player from './Player'
import PagerView, { type PagerViewOnPageSelectedEvent } from 'react-native-pager-view'
import Pic from './Pic'
import Lyric from './Lyric'
import DetailManager from '@/screens/Home/DetailManager'
import { useHomeDetailStack } from '@/store/common/hook'
import { screenkeepAwake, screenUnkeepAwake } from '@/utils/nativeModules/utils'
import commonState, { type InitState as CommonState } from '@/store/common/state'
import { createStyle } from '@/utils/tools'
import PlayerBar from '@/components/player/PlayerBar'
// import { useTheme } from '@/store/theme/hook'

const LyricPage = ({ activeIndex }: { activeIndex: number }) => {
  const initedRef = useRef(false)
  const lyric = useMemo(() => <Lyric />, [])
  switch (activeIndex) {
    // case 3:
    case 1:
      if (!initedRef.current) initedRef.current = true
      return lyric
    default:
      return initedRef.current ? lyric : null
  }
  // return activeIndex == 0 || activeIndex == 1 ? setting : null
}

// global.iskeep = false
export default memo(({ componentId }: { componentId: string }) => {
  // const theme = useTheme()
  const [pageIndex, setPageIndex] = useState(0)
  const showLyricRef = useRef(false)
  const detailStack = useHomeDetailStack('playDetail')
  // 详情打开时隐藏播放器内容：避免全屏原生列表穿透到详情层之上（视觉重叠）
  const hasDetail = detailStack.length > 0

  const onPageSelected = ({ nativeEvent }: PagerViewOnPageSelectedEvent) => {
    setPageIndex(nativeEvent.position)
    showLyricRef.current = nativeEvent.position == 1
    if (showLyricRef.current) {
      screenkeepAwake()
    } else {
      screenUnkeepAwake()
    }
  }

  useEffect(() => {
    let appstateListener = AppState.addEventListener('change', (state) => {
      switch (state) {
        case 'active':
          if (showLyricRef.current && !commonState.componentIds.comment) screenkeepAwake()
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
    <>
      <View style={styles.contentWrap}>
        <View style={hasDetail ? styles.hidden : styles.fill}>
          <Header />
          <View style={styles.container}>
            <PagerView
              onPageSelected={onPageSelected}
              // onPageScrollStateChanged={onPageScrollStateChanged}
              style={styles.pagerView}
            >
              <View collapsable={false}>
                <Pic componentId={componentId} />
              </View>
              <View collapsable={false}>
                <LyricPage activeIndex={pageIndex} />
              </View>
            </PagerView>
            {/* <View style={styles.pageIndicator} nativeID={NAV_SHEAR_NATIVE_IDS.playDetail_pageIndicator}>
              <View style={{ ...styles.pageIndicatorItem, backgroundColor: pageIndex == 0 ? theme['c-primary-light-100-alpha-700'] : theme['c-primary-alpha-900'] }}></View>
              <View style={{ ...styles.pageIndicatorItem, backgroundColor: pageIndex == 1 ? theme['c-primary-light-100-alpha-700'] : theme['c-primary-alpha-900'] }}></View>
            </View> */}
            <Player />
          </View>
        </View>
        {/* 详情层只覆盖内容区，底部播放条保留（与主窗口详情一致） */}
        <DetailManager host="playDetail" />
      </View>
      {hasDetail ? <PlayerBar disableNavigate /> : null}
    </>
  )
})

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'column',
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
  pagerView: {
    flex: 1,
  },
  // pageIndicator: {
  //   flex: 0,
  //   flexDirection: 'row',
  //   justifyContent: 'center',
  //   paddingTop: 10,
  //   // backgroundColor: 'rgba(0,0,0,0.1)',
  // },
  // pageIndicatorItem: {
  //   height: 3,
  //   width: '5%',
  //   marginLeft: 2,
  //   marginRight: 2,
  //   borderRadius: 2,
  // },
})
