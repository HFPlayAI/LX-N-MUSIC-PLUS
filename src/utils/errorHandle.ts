import { Alert } from 'react-native'
// import { exitApp } from '@/utils/common'
import { setJSExceptionHandler, setNativeExceptionHandler } from 'react-native-exception-handler'
import { log } from '@/utils/log'
import { toast } from './tools'

const errorHandler = (e: Error, isFatal: boolean) => {
  // Hermes / react-native-exception-handler 传来的对象不一定是标准 Error：
  // 可能是字符串、原生异常对象，或 stack/message 都为空的对象。
  // 旧实现直接 log.error(e.stack)，stack 为 undefined 时日志只剩「时间 ERROR」，
  // 内容被吞掉，导致界面白屏却查不到任何线索。
  const raw = e as unknown as { stack?: string, message?: string, name?: string } | null
  const stackText = (raw?.stack ?? '').trim()
  const messageText = (raw?.message ?? '').trim()
  let fallback = String(e)
  if (e && typeof e == 'object') {
    try { fallback = JSON.stringify(e) ?? fallback } catch { /* 循环引用时保留 String(e) */ }
  }
  const text = typeof e == 'string'
    ? e
    : stackText.length ? stackText : (messageText.length ? messageText : fallback)
  const trimmed = text.trim()
  const message = trimmed && trimmed != '{}' ? text : 'unknown error'
  const name = raw?.name ?? 'Error'
  const excludedErrors = [
    'Failed to construct \'Response\'',
  ]
  if (isFatal) {
    if (excludedErrors.some((excludedError) => message.includes(excludedError))) {
      toast('应用遇到了错误，如果你有固定的复现方式，请截图并在 GitHub 反馈（并附上具体的操作步骤，以及“设置-错误日志”的内容）')
    } else {
      Alert.alert(
        '💥Unexpected error occurred💥',
        `
  应用出 bug 了😭，以下是错误异常信息。请截图并在 GitHub 反馈（并附上刚才你进行了什么操作，以及附上“设置-错误日志”的内容）。现在应用可能会出现异常，若出现异常请尝试强制结束应用后重新启动！

  Error:
  ${isFatal ? 'Fatal:' : ''} ${name} ${message}
  `,
        [{
          text: '关闭 (Close)',
          onPress: () => {
            // exitApp()
          },
        }],
      )
    }
  }
  log.error(`[JS ${isFatal ? 'FATAL' : 'NONFATAL'}] ${message}`)
}

if (process.env.NODE_ENV !== 'development') {
  setJSExceptionHandler(errorHandler)

  setNativeExceptionHandler((errorString) => {
    log.error(errorString)
    console.log('+++++', errorString, '+++++')
  }, false)
}
