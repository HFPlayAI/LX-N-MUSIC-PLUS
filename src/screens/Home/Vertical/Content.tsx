import { useEffect, useRef } from 'react'
// import { getWindowSise, onDimensionChange } from '@/utils/tools'
import { View } from 'react-native'
import DrawerNav from './DrawerNav'
import Header from './Header'
import Main from './Main'
import DetailManager from '../DetailManager'
import { useHomeDetailStack } from '@/store/common/hook'
import { useSettingValue } from '@/store/setting/hook'
import { COMPONENT_IDS } from '@/config/constant'
import DrawerLayoutFixed, { type DrawerLayoutFixedType } from '@/components/common/DrawerLayoutFixed'
import { scaleSizeW } from '@/utils/pixelRatio'
import { createStyle } from '@/utils/tools'

const MAX_WIDTH = scaleSizeW(300)

const Content = () => {
  const drawer = useRef<DrawerLayoutFixedType>(null)
  const drawerLayoutPosition = useSettingValue('common.drawerLayoutPosition')
  const detailStack = useHomeDetailStack('home')
  // 详情打开时隐藏主内容：避免 Android 原生 PagerView 穿透到详情层之上（视觉重叠）
  const hasDetail = detailStack.length > 0

  useEffect(() => {
    const changeVisible = (visible: boolean) => {
      if (visible) {
        drawer.current?.openDrawer()
      } else {
        drawer.current?.closeDrawer()
      }
    }

    global.app_event.on('changeMenuVisible', changeVisible)

    return () => {
      global.app_event.off('changeMenuVisible', changeVisible)
    }
  }, [])

  const navigationView = () => <DrawerNav />
  // console.log('render drawer content')

  return (
    <DrawerLayoutFixed
      ref={drawer}
      widthPercentage={0.7}
      widthPercentageMax={MAX_WIDTH}
      visibleNavNames={[COMPONENT_IDS.home]}
      // drawerWidth={width}
      drawerPosition={drawerLayoutPosition}
      renderNavigationView={navigationView}
    >
      <Header />
      <View style={styles.mainWrap}>
        <View style={hasDetail ? styles.hidden : styles.fill}>
          <Main />
        </View>
        {/* 统一的详情层：覆盖内容区，保留顶栏/抽屉 */}
        <DetailManager host="home" />
      </View>
    </DrawerLayoutFixed>
  )
}

const styles = createStyle({
  mainWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  fill: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
})

// const styles = createStyle({
//   container: {
//     flex: 1,
//   },
// })

export default Content
