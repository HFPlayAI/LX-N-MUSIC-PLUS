import { View } from 'react-native'
import Aside from './Aside'
import PlayerBar from '@/components/player/PlayerBar'
import StatusBar from '@/components/common/StatusBar'
import Header from './Header'
import Main from './Main'
import DetailManager from '../DetailManager'
import { useHomeDetailStack } from '@/store/common/hook'
import { createStyle } from '@/utils/tools'

const styles = createStyle({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    overflow: 'hidden',
  },
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

export default () => {
  const detailStack = useHomeDetailStack('home')
  // 详情打开时隐藏主内容：避免 Android 原生 PagerView 穿透到详情层之上（视觉重叠）
  const hasDetail = detailStack.length > 0
  return (
    <>
      <StatusBar />
      <View style={styles.container}>
        <Aside />
        <View style={styles.content}>
          <Header />
          <View style={styles.mainWrap}>
            <View style={hasDetail ? styles.hidden : styles.fill}>
              <Main />
            </View>
            {/* 统一的详情层：覆盖内容区，保留侧边栏/顶栏 */}
            <DetailManager host="home" />
          </View>
          <PlayerBar isHome />
        </View>
      </View>
    </>
  )
}
