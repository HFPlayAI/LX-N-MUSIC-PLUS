import { Component, type ErrorInfo, type ReactNode } from 'react'
import { TouchableOpacity, View } from 'react-native'
import Text from '@/components/common/Text'
import { createStyle } from '@/utils/tools'
import { log } from '@/utils/log'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 主界面兜底：设置页自己的边界只覆盖设置内容，
 * 旋转时 Home 根从 Vertical 切到 Horizontal 属于边界之外，
 * 一旦抛错就是整页白屏且没有任何提示。这里在最外层兜住整棵 Home 树。
 */
export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.log('home render error:', error?.message, info?.componentStack ?? '')
    log.error(`[render error] ${error?.stack ?? error?.message ?? String(error)}\n${info?.componentStack ?? ''}`)
  }

  private readonly retry = () => {
    this.setState({ error: null })
  }

  render() {
    const error = this.state.error
    if (!error) return this.props.children

    return (
      <View style={styles.container}>
        <Text size={15}>界面渲染出错</Text>
        <Text size={11} style={styles.message}>{String(error?.message ?? error)}</Text>
        <Text size={11} style={styles.message}>完整堆栈已写入「设置 → 其他 → 查看日志」，请把这行信息发我。</Text>
        <TouchableOpacity onPress={this.retry} style={styles.btn}>
          <Text size={12}>重试</Text>
        </TouchableOpacity>
      </View>
    )
  }
}

const styles = createStyle({
  container: {
    flex: 1,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 24,
  },
  message: {
    marginTop: 10,
  },
  btn: {
    alignSelf: 'flex-start',
    marginTop: 18,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
    borderWidth: 1,
    borderRadius: 4,
  },
})
