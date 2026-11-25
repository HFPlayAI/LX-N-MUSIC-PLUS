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
import { initVoiceCommand } from './voiceCommand'
import { setApiSource } from '@/core/apiSource'
import commonActions from '@/store/common/action'
import settingState from '@/store/setting/state'
import { bootLog } from '@/utils/bootLog'
import { cheatTip } from '@/utils/tools'
import { initWyUserWithRefresh } from '@/store/user/service'

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

  // 车机语音指令监听（比亚迪小迪 / 酷我协议）在播放器就绪后立即挂载。
  // 不能等到用户进首页：车机冷启动可能有提示弹窗未关，而语音指令必须是"一说话就生效"。
  void initVoiceCommand()
  bootLog('Voice command inited.')
  await dataInit(setting)
  bootLog('Data inited.')
  await initCommonState(setting)
  bootLog('Common State inited.')

  void initSync(setting)
  bootLog('Sync inited.')

  // 初始化网易云登录态：启动探活 + 必要时续期，随后拉取 UID/喜欢列表/歌单等
  void initWyUserWithRefresh()
  bootLog('Wy user inited.')

  // syncSetting()

  isInited ||= true

  return handlePushedHomeScreen
}
