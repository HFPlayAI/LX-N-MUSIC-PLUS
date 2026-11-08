import { initSetting, updateSetting } from '@/core/common'
import registerPlaybackService from '@/plugins/player/service'
import initTheme from './theme'
import initI18n from './i18n'
import initUserApi from './userApi'
import initPlayer from './player'
import dataInit from './dataInit'
import initSync from './sync'
import initCommonState from './common'
import { initDeeplink } from './deeplink'
import { setApiSource } from '@/core/apiSource'
import commonActions from '@/store/common/action'
import settingState from '@/store/setting/state'
import { bootLog } from '@/utils/bootLog'
import { cheatTip } from '@/utils/tools'
import { initWyUser } from '@/store/user/action'

let isFirstPush = true
const handlePushedHomeScreen = async() => {
  await cheatTip()
  if (!settingState.setting['common.isAgreePact']) {
    // 魔改版：自动同意许可协议，不再弹出首次协议窗
    updateSetting({ 'common.isAgreePact': true })
  }
  if (isFirstPush) {
    isFirstPush = false
    void initDeeplink()
  }
}

let isInited = false
export default async() => {
  if (isInited) return handlePushedHomeScreen
  bootLog('Initing...')
  commonActions.setFontSize(global.lx.fontSize)
  bootLog('Font size changed.')
  const setting = await initSetting()
  bootLog('Setting inited.')
  // console.log(setting)

  await initTheme(setting)
  bootLog('Theme inited.')
  await initI18n(setting)
  bootLog('I18n inited.')

  const apiSourceId = await initUserApi(setting)
  bootLog('User Api inited.')

  setApiSource(apiSourceId)
  bootLog('Api inited.')

  registerPlaybackService()
  bootLog('Playback Service Registered.')
  await initPlayer(setting)
  bootLog('Player inited.')
  await dataInit(setting)
  bootLog('Data inited.')
  await initCommonState(setting)
  bootLog('Common State inited.')

  void initSync(setting)
  bootLog('Sync inited.')

  // 初始化网易云登录态（Cookie 有效时拉取 UID/喜欢列表/歌单等，失败静默）
  void initWyUser()
  bootLog('Wy user inited.')

  // syncSetting()

  isInited ||= true

  return handlePushedHomeScreen
}
