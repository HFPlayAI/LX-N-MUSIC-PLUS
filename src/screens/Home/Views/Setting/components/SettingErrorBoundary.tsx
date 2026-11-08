import { Component, type ErrorInfo, type ReactNode } from 'react'
import { View } from 'react-native'

import Text from '@/components/common/Text'
import Button from './Button'
import { createStyle } from '@/utils/tools'
import { clearMergeResult } from '@/core/mergeSource/mergeSources'
import { log } from '@/utils/log'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * 设置页兜底：任一标签渲染抛错时不再让整个页面白屏，
 * 而是显示可读的错误信息，并提供「清除合并结果」这条最常用的恢复路径。
 */
export default class SettingErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.log('setting render error:', error?.message, info?.componentStack ?? '')
    log.error(`[setting render error] ${error?.stack ?? error?.message}\n${info?.componentStack ?? ''}`)
  }

  private readonly retry = () => {
    this.setState({ error: null })
  }

  private readonly clearAndRetry = () => {
    void clearMergeResult().then(this.retry, this.retry)
  }

  render() {
    const error = this.state.error
    if (!error) return this.props.children

    return (
      <View style={styles.container}>
        <Text size={15}>设置页渲染出错</Text>
        <Text size={11} style={styles.message}>{String(error?.message ?? error)}</Text>
        <Text size={11} style={styles.message}>可先点「清除合并结果并重试」；若仍出错，请把上面这行信息发我。</Text>
        <View style={styles.row}>
          <Button onPress={this.retry}>重试</Button>
          <Button onPress={this.clearAndRetry}>清除合并结果并重试</Button>
        </View>
      </View>
    )
  }
}

const styles = createStyle({
  container: {
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 16,
  },
  message: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    marginTop: 14,
  },
})
