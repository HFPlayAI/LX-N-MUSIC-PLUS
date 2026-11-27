import { AppState, DeviceEventEmitter, ToastAndroid } from 'react-native'
import TrackPlayer from 'react-native-track-player'
import { initial } from '@/plugins/player'
import { playList } from '@/core/player/player'
import { getList } from '@/core/player/playInfo'
import { LIST_IDS } from '@/config/constant'
import { handleMusicAction } from './deeplink/musicAction'
import { handlePlayerAction, type PlayerAction } from './deeplink/playerAction'
import { consumePendingCommand, clearPendingCommand, setVoiceTipEnabled, reregisterVoice, reportVoiceDebug, type VoiceCommandParams } from '@/utils/nativeModules/voice'
import settingState from '@/store/setting/state'

const EVENT_NAME = 'voice-command'
const DUPLICATE_WINDOW = 2000

let lastSearchKey = ''
let lastSearchTime = 0

const isDuplicateSearch = (key: string) => {
  const now = Date.now()
  if (key === lastSearchKey && now - lastSearchTime < DUPLICATE_WINDOW) return true
  lastSearchKey = key
  lastSearchTime = now
  return false
}

const isTipEnabled = () => !!settingState.setting['player.isShowVoiceTip']

const mediaActionMap: Record<string, PlayerAction> = {
  MEDIA_NEXT: 'skipNext',
  MEDIA_PRE: 'skipPrev',
  MEDIA_PLAY: 'play',
  MEDIA_PAUSE: 'pause',
  MEDIA_PLAY_PAUSE: 'togglePlay',
}

const recoverPlayer = async() => {
  try {
    try {
      await TrackPlayer.destroy()
    } catch (err: any) {
      console.log('TrackPlayer.destroy error:', err?.message)
    }
    global.lx.playerStatus.isInitialized = false
    global.lx.playerStatus.isIniting = false
    await initial({
      volume: settingState.setting['player.volume'],
      playRate: settingState.setting['player.playbackRate'],
      cacheSize: settingState.setting['player.cacheSize'] ? parseInt(settingState.setting['player.cacheSize']) : 0,
      isHandleAudioFocus: settingState.setting['player.isHandleAudioFocus'],
      isEnableAudioOffload: settingState.setting['player.isEnableAudioOffload'],
    })
  } catch (err: any) {
    console.log('recoverPlayer error:', err?.message)
  }
}

const handleVoiceCommand = async(params: VoiceCommandParams, isRetry = false) => {
  if (!isRetry && params.type === 'searchPlay') {
    const name = (params.keyword ?? '').trim() || (params.artist ?? '').trim()
    if (name && isDuplicateSearch(`searchPlay|${name}`)) {
      console.log('voice-command duplicate skipped:', name)
      return
    }
  }
  if (!isRetry) console.log('voice-command', params)
  reportVoiceDebug('JS收到', `type=${params.type}${params.keyword ? ` 关键词=${params.keyword}` : ''}${params.artist ? ` 歌手=${params.artist}` : ''}`)
  clearPendingCommand()
  try {
    switch (params.type) {
      case 'searchPlay': {
        const keyword = params.keyword?.trim() ?? ''
        const artist = params.artist?.trim() ?? ''
        const name = keyword || artist
        if (!name) return
        if (isTipEnabled()) ToastAndroid.show(`正在搜索: ${name}`, ToastAndroid.SHORT)
        const handled = await handleMusicAction('searchPlay', {
          paths: [],
          data: {
            name,
            singer: keyword ? artist : '',
          },
        })
        // false 表示没匹配到（或检索期间用户切了列表），这时候不能再报「成功」
        if (handled === false) {
          reportVoiceDebug('未找到', `type=searchPlay 未匹配到：${name}${artist ? ' / ' + artist : ''}`)
          return
        }
        break
      }
      case 'player': {
        const action = params.playerAction ? mediaActionMap[params.playerAction] : undefined
        if (action == null) return
        await handlePlayerAction(action)
        break
      }
      case 'playFavorite': {
        const loveList = getList(LIST_IDS.LOVE)
        if (!loveList.length) {
          if (isTipEnabled()) ToastAndroid.show('我喜欢列表为空', ToastAndroid.LONG)
          return
        }
        await playList(LIST_IDS.LOVE, 0)
        break
      }
      case 'continuePlay':
        await handlePlayerAction('play')
        break
      case 'openApp':
      default:
        break
    }
    reportVoiceDebug('执行完成', `type=${params.type} 成功`)
  } catch (err: any) {
    console.log('voice command error:', err?.message)
    reportVoiceDebug('执行失败', String(err?.message ?? err))
    if (!isRetry) {
      reportVoiceDebug('重试', '正在重建播放器后重试一次')
      await recoverPlayer()
      return handleVoiceCommand(params, true)
    }
    if (isTipEnabled()) ToastAndroid.show('语音指令执行失败', ToastAndroid.LONG)
  }
}

export const initVoiceCommand = async() => {
  setVoiceTipEnabled(isTipEnabled())
  const subscription = DeviceEventEmitter.addListener(EVENT_NAME, handleVoiceCommand)
  AppState.addEventListener('change', state => {
    if (state === 'active') reregisterVoice()
  })
  const pending = await consumePendingCommand()
  if (pending) void handleVoiceCommand(pending)
  return () => {
    subscription.remove()
  }
}
