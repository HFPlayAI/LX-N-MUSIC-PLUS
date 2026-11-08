import { memo, useState, useRef, useEffect } from 'react'
import { View, Image, Modal } from 'react-native'

import Section from '../../components/Section'
import SubTitle from '../../components/SubTitle'
import Btn from '../../components/Button'
import TextInput from '@/components/common/Input'
import { useI18n } from '@/lang'
import { useTheme } from '@/store/theme/hook'
import { createStyle, toast } from '@/utils/tools'
import { useSettingValue } from '@/store/setting/hook'
import { useWyUserState } from '@/store/user/hook'
import {
  loginWithCookie,
  logout,
  refreshProfile,
  getSavedAccounts,
  switchAccount,
  removeAccount,
  createQrSession,
  pollQrStatus,
  stopQrSession,
  type QrLoginSession,
  type QrLoginStatus,
} from '@/store/user/service'
import { updateSetting } from '@/core/common'
import CheckBoxItem from '../../components/CheckBoxItem'
import Text from '@/components/common/Text'
import WebView from 'react-native-webview'
import CookieManager from '@react-native-cookies/cookies'
import QRCodeSvg from 'react-native-qrcode-svg'
import { BorderRadius, BorderWidths } from '@/theme'

const AVATAR_SIZE = 42

const LoginStatus = ({ onWebLoginCookie }: {
  onWebLoginCookie: (cookie: string) => void
}) => {
  const t = useI18n()
  const theme = useTheme()
  const { wy_profile } = useWyUserState()
  const [webVisible, setWebVisible] = useState(false)
  const [qrVisible, setQrVisible] = useState(false)

  // 扫码登录暂时隐藏（相关代码保留在 service.ts / git 历史，待修复白屏问题后恢复）

  const handleRefresh = async() => {
    try {
      await refreshProfile()
      toast(t('setting_netease_refresh_success'))
    } catch (err: any) {
      toast(`${t('setting_netease_login_failed')}: ${err?.message ?? err}`)
    }
  }

  const handleLogout = () => {
    logout()
    toast(t('setting_netease_logout'))
  }


  return (
    <View>
      <View style={styles.loginRow}>
        <View style={{ ...styles.badge, backgroundColor: wy_profile ? theme['c-primary-background-active'] : theme['c-button-background'] }}>
          <Text size={12} color={wy_profile ? theme['c-primary-font'] : theme['c-font-label']}>
            {wy_profile ? t('setting_netease_login_status_badge') : t('setting_netease_login_not_login')}
          </Text>
        </View>
        {
          wy_profile?.avatarUrl
            ? <Image source={{ uri: wy_profile.avatarUrl }} style={{ ...styles.avatar, borderRadius: AVATAR_SIZE / 2 }} />
            : <View style={{ ...styles.avatar, borderRadius: AVATAR_SIZE / 2, backgroundColor: theme['c-button-background'] }} />
        }
        <Text size={15} numberOfLines={1} style={styles.nickname}>{wy_profile?.nickname ?? ''}</Text>
      </View>
      <View style={styles.btnRow}>
        <Btn onPress={() => { setWebVisible(true) }}>{t('setting_netease_weblogin')}</Btn>
        <Btn onPress={() => { setQrVisible(true) }}>{'扫码登录'}</Btn>
        <Btn onPress={handleRefresh} disabled={!wy_profile}>{t('setting_netease_refresh')}</Btn>
        <Btn onPress={handleLogout} disabled={!wy_profile}>{t('setting_netease_logout')}</Btn>
      </View>

      <WyWebLoginModal visible={webVisible} onClose={() => { setWebVisible(false) }} onCookie={onWebLoginCookie} />
      <WyQrLoginModal visible={qrVisible} onClose={() => { setQrVisible(false) }} onCookie={onWebLoginCookie} />
    </View>
  )
}

/**
 * 网页登录：内嵌 y.music.163.com/m/login 登录页，
 * 登录成功后从 WebView Cookie 存储中读取 MUSIC_U 完成登录。
 * didLoginRef 保证只回调一次，避免设置更新引发的重渲染导致重复登录/重复 toast。
 */
const WyWebLoginModal = ({ visible, onClose, onCookie }: {
  visible: boolean
  onClose: () => void
  onCookie: (cookie: string) => void
}) => {
  const t = useI18n()
  const theme = useTheme()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const didLoginRef = useRef(false)
  const onCookieRef = useRef(onCookie)
  onCookieRef.current = onCookie

  useEffect(() => {
    if (!visible) {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      return
    }
    didLoginRef.current = false
    pollRef.current = setInterval(() => {
      void (async() => {
        try {
          if (didLoginRef.current) return
          const cookies = await CookieManager.get('https://music.163.com', true)
          const musicU = (cookies as Record<string, { name: string, value: string }>).MUSIC_U
          if (musicU?.value) {
            didLoginRef.current = true
            if (pollRef.current) {
              clearInterval(pollRef.current)
              pollRef.current = null
            }
            const cookieStr = Object.values(cookies as Record<string, { name: string, value: string }>)
              .filter(c => c?.name && c?.value)
              .map(c => `${c.name}=${c.value}`)
              .join('; ')
            // 先回调（回填输入框），再执行登录
            onCookieRef.current(cookieStr)
            await loginWithCookie(cookieStr)
            toast(t('setting_netease_login_success'))
            onClose()
          }
        } catch (err) {
          console.warn('读取WebView Cookie失败', err)
        }
      })()
    }, 1500)
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }
  }, [visible])

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ ...styles.webContainer, backgroundColor: theme['c-main-background'] }}>
        <View style={{ ...styles.webHeader, borderBottomColor: theme['c-border-background'] }}>
          <Text size={15}>{t('setting_netease_weblogin')}</Text>
          <Btn onPress={onClose}>{t('setting_netease_qr_close')}</Btn>
        </View>
        <WebView
          source={{ uri: 'https://y.music.163.com/m/login' }}
          style={styles.webView}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          startInLoadingState
          userAgent="Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          onError={() => {
            toast('网页加载失败，建议改用「扫码登录」')
          }}
          onRenderProcessGone={() => {
            toast('网页渲染异常，建议改用「扫码登录」')
            onClose()
          }}
        />
      </View>
    </Modal>
  )
}

/**
 * 原生扫码登录：不依赖 WebView 渲染登录页。
 * 使用网易云官方扫码流程：unikey 获取密钥 → 本地渲染二维码（codekey 格式）
 * → 轮询 client/login 接口（801 等待 / 802 已扫 / 803 确认并下发 Cookie）。
 * 适用于 WebView 内核过旧的车机等设备（如比亚迪 DiLink）。
 */
const QrStatusText: Record<QrLoginStatus, string> = {
  waiting: '请使用网易云APP扫描二维码',
  scanned: '已扫码，请在手机上确认',
  success: '登录成功',
  expired: '二维码已过期',
  error: '网络异常，重试中...',
}

const WyQrLoginModal = ({ visible, onClose, onCookie }: {
  visible: boolean
  onClose: () => void
  onCookie: (cookie: string) => void
}) => {
  const t = useI18n()
  const theme = useTheme()
  const [session, setSession] = useState<QrLoginSession | null>(null)
  const [status, setStatus] = useState<QrLoginStatus>('waiting')
  const [expired, setExpired] = useState(false)
  const sessionRef = useRef<QrLoginSession | null>(null)
  const onCookieRef = useRef(onCookie)
  onCookieRef.current = onCookie

  const startSession = async() => {
    setExpired(false)
    setStatus('waiting')
    try {
      const s = await createQrSession()
      sessionRef.current = s
      setSession(s)
      // 登录成功后的处理
      void pollQrStatus(s, (st) => {
        setStatus(st)
        if (st === 'expired') setExpired(true)
      }, async(cookie) => {
        onCookieRef.current(cookie)
        await loginWithCookie(cookie)
        toast('登录成功')
        onClose()
      })
    } catch (err: any) {
      toast(`获取二维码失败: ${err?.message ?? err}`)
    }
  }

  useEffect(() => {
    if (visible) {
      void startSession()
    } else {
      if (sessionRef.current) stopQrSession(sessionRef.current)
      sessionRef.current = null
      setSession(null)
      setStatus('waiting')
      setExpired(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible])

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={{ ...styles.webContainer, backgroundColor: theme['c-main-background'] }}>
        <View style={{ ...styles.webHeader, borderBottomColor: theme['c-border-background'] }}>
          <Text size={15}>{'扫码登录'}</Text>
          <Btn onPress={onClose}>{t('setting_netease_qr_close')}</Btn>
        </View>
        <View style={styles.qrContent}>
          <View style={{ ...styles.qrBox, backgroundColor: '#fff' }}>
            {
              session?.qrurl
                ? <QRCodeSvg value={session.qrurl} size={190} color="#1a1a1a" backgroundColor="#ffffff" />
                : <Text size={13} color="#666">生成二维码中...</Text>
            }
          </View>
          <Text size={13} color={status === 'success' ? theme['c-primary-font'] : theme['c-font']} style={styles.qrStatus}>
            {QrStatusText[status] ?? ''}
          </Text>
          {
            expired
              ? <Btn onPress={() => { void startSession() }}>{'刷新二维码'}</Btn>
              : null
          }
          <Text size={12} color={theme['c-font-label']} style={styles.qrTip}>
            {'打开网易云音乐APP → 左上角扫一扫，扫描并确认登录'}
          </Text>
        </View>
      </View>
    </Modal>
  )
}

const Accounts = () => {
  const t = useI18n()
  const theme = useTheme()
  const { wy_profile } = useWyUserState()
  const [accounts, setAccounts] = useState(getSavedAccounts())

  // 订阅设置变化以刷新账号列表
  const currentCookie = useSettingValue('common.wy_cookie')
  useEffect(() => {
    setAccounts(getSavedAccounts())
  }, [currentCookie])

  if (!accounts.length) return null

  return (
    <View style={styles.accountsWrap}>
      <SubTitle title={t('setting_netease_accounts')}>{null}</SubTitle>
      {
        accounts.map((account) => {
          const isCurrent = wy_profile?.uid === account.uid
          return (
            <View key={account.uid ?? account.cookie} style={{ ...styles.accountItem, backgroundColor: theme['c-button-background'], borderRadius: BorderRadius.normal }}>
              {
                account.avatarUrl
                  ? <Image source={{ uri: account.avatarUrl }} style={{ ...styles.accountAvatar, borderRadius: 16 }} />
                  : <View style={{ ...styles.accountAvatar, borderRadius: 16, backgroundColor: theme['c-border-background'] }} />
              }
              <Text numberOfLines={1} style={styles.accountName}>{account.nickname ?? account.uid ?? 'account'}</Text>
              {
                isCurrent
                  ? (
                    <View style={{ ...styles.currentBadge, backgroundColor: theme['c-primary-background-active'], borderRadius: BorderRadius.normal }}>
                      <Text size={11} color={theme['c-primary-font']}>{t('setting_netease_account_current')}</Text>
                    </View>
                    )
                  : (
                      <Btn onPress={() => { void switchAccount(account) }}>{t('setting_netease_login_title')}</Btn>
                    )
              }
              {
                !isCurrent && (
                  <Btn onPress={() => { removeAccount(account.uid ?? ''); setAccounts(getSavedAccounts()) }}>
                    {t('setting_netease_account_remove')}
                  </Btn>
                )
              }
            </View>
          )
        })
      }
    </View>
  )
}

const CookieInput = ({ presetCookie }: {
  presetCookie: string
}) => {
  const t = useI18n()
  const theme = useTheme()
  const [text, setText] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  // 网页登录成功后自动回填获取到的 Cookie
  useEffect(() => {
    if (presetCookie) setText(presetCookie)
  }, [presetCookie])

  const handleLogin = async() => {
    if (!text.trim()) return
    setLoggingIn(true)
    try {
      await loginWithCookie(text)
      setText('')
      toast(t('setting_netease_login_success'))
    } catch (err: any) {
      toast(`${t('setting_netease_login_failed')}: ${err?.message ?? err}`)
    } finally {
      setLoggingIn(false)
    }
  }

  return (
    <View style={styles.cookieWrap}>
      <SubTitle title={t('setting_netease_cookie_title')}>{null}</SubTitle>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t('setting_netease_cookie_input_ph')}
        multiline
        style={{ ...styles.cookieInput, borderColor: theme['c-border-background'], backgroundColor: theme['c-main-background'], color: theme['c-font'] }}
      />
      <View style={styles.btnRow}>
        <Btn onPress={handleLogin} disabled={loggingIn || !text.trim()}>{loggingIn ? t('setting_netease_logging_in') : t('setting_netease_cookie_save')}</Btn>
        <Btn onPress={() => { setText('') }}>{t('setting_netease_cookie_clear')}</Btn>
      </View>
      <Text size={12} color={theme['c-font-label']} style={styles.howto}>{t('setting_netease_cookie_howto')}</Text>
    </View>
  )
}

const ScrobbleToggle = () => {
  const t = useI18n()
  const theme = useTheme()
  const scrobble = useSettingValue('common.wy_scrobble')
  const handleUpdate = (value: boolean) => {
    updateSetting({ 'common.wy_scrobble': value })
  }
  return (
    <View>
      <CheckBoxItem check={scrobble} onChange={handleUpdate} label={t('setting_netease_scrobble_label')} />
      <Text size={12} color={theme['c-font-label']} style={styles.howto}>{t('setting_netease_scrobble_tip')}</Text>
    </View>
  )
}

export default memo(() => {
  const t = useI18n()
  const [webLoginCookie, setWebLoginCookie] = useState('')

  return (
    <Section title={t('setting_netease')}>
      <SubTitle title={t('setting_netease_login_title')}>{null}</SubTitle>
      <LoginStatus onWebLoginCookie={setWebLoginCookie} />
      <Accounts />
      <CookieInput presetCookie={webLoginCookie} />
      <ScrobbleToggle />
    </Section>
  )
})

const styles = createStyle({
  loginRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 4,
    marginRight: 10,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    marginRight: 10,
  },
  nickname: {
    flex: 1,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  accountsWrap: {
    marginTop: 10,
  },
  accountItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  accountAvatar: {
    width: 32,
    height: 32,
    marginRight: 10,
  },
  accountName: {
    flex: 1,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 8,
  },
  cookieWrap: {
    marginTop: 10,
  },
  cookieInput: {
    borderWidth: BorderWidths.normal,
    minHeight: 60,
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
    textAlignVertical: 'top',
    fontSize: 13,
  },
  howto: {
    marginTop: 6,
    lineHeight: 18,
  },
  webContainer: {
    flex: 1,
  },
  webHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderBottomWidth: BorderWidths.normal,
    marginTop: 20,
  },
  webView: {
    flex: 1,
  },
  qrContent: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 30,
    paddingHorizontal: 20,
  },
  qrBox: {
    width: 220,
    height: 220,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  qrStatus: {
    marginBottom: 12,
  },
  qrTip: {
    marginTop: 14,
    textAlign: 'center',
    lineHeight: 18,
  },
})
