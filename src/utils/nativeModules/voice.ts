import { NativeModules } from 'react-native'

const { VoiceModule } = NativeModules

export interface VoiceCommandParams {
  type: 'searchPlay' | 'player' | 'continuePlay' | 'openApp' | 'playFavorite'
  keyword?: string
  artist?: string
  playerAction?: string
}

export const consumePendingCommand = async(): Promise<VoiceCommandParams | null> => {
  try {
    const data: string | null = await VoiceModule.consumePendingCommand()
    if (!data) return null
    return JSON.parse(data) as VoiceCommandParams
  } catch (err: any) {
    console.log('consumePendingCommand error:', err?.message)
    return null
  }
}

export const clearPendingCommand = () => {
  try {
    VoiceModule.clearPendingCommand()
  } catch (err: any) {
    console.log('clearPendingCommand error:', err?.message)
  }
}

export const reportVoiceState = (playing: boolean, title: string, artist: string) => {
  try {
    VoiceModule.reportState(playing, title, artist)
  } catch (err: any) {
    console.log('reportVoiceState error:', err?.message)
  }
}

export const setVoiceTipEnabled = (enabled: boolean) => {
  try {
    VoiceModule.setTipEnabled(enabled)
  } catch (err: any) {
    console.log('setVoiceTipEnabled error:', err?.message)
  }
}

export const getVoiceTipEnabled = async(): Promise<boolean> => {
  try {
    return !!await VoiceModule.getTipEnabled()
  } catch (err: any) {
    console.log('getVoiceTipEnabled error:', err?.message)
    return true
  }
}

export const reregisterVoice = () => {
  try {
    VoiceModule.reregisterVoice()
  } catch (err: any) {
    console.log('reregisterVoice error:', err?.message)
  }
}

export interface VoiceDebugItem {
  t: string
  tag: string
  msg: string
}

export const getVoiceDebugLogs = async(): Promise<VoiceDebugItem[]> => {
  try {
    const raw: string = await VoiceModule.getDebugLogs()
    const parsed = JSON.parse(raw || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch (err: any) {
    console.log('getVoiceDebugLogs error:', err?.message)
    return []
  }
}

export const getVoiceRegisteredAt = async(): Promise<number> => {
  try {
    return Number(await VoiceModule.getRegisteredAt()) || 0
  } catch (err: any) {
    console.log('getVoiceRegisteredAt error:', err?.message)
    return 0
  }
}

export const clearVoiceDebugLogs = () => {
  try {
    VoiceModule.clearDebugLogs()
  } catch (err: any) {
    console.log('clearVoiceDebugLogs error:', err?.message)
  }
}

export const sendVoiceTestBroadcast = (keyword: string) => {
  try {
    VoiceModule.sendTestBroadcast(keyword)
  } catch (err: any) {
    console.log('sendVoiceTestBroadcast error:', err?.message)
  }
}

export const reportVoiceDebug = (tag: string, msg: string) => {
  try {
    VoiceModule.reportDebug(tag, msg)
  } catch (err: any) {
    console.log('reportVoiceDebug error:', err?.message)
  }
}

