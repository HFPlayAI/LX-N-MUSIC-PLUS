import versionActions from '@/store/version/action'
import versionState, { type InitState } from '@/store/version/state'
import { saveIgnoreVersion } from '@/utils/data'
import { showVersionModal } from '@/navigation'
import { Navigation } from 'react-native-navigation'

export const showModal = () => {
  if (versionState.showModal) return
  versionActions.setVisibleModal(true)
  showVersionModal()
}

export const hideModal = (componentId: string) => {
  if (!versionState.showModal) return
  versionActions.setVisibleModal(false)
  void Navigation.dismissOverlay(componentId)
}

export const checkUpdate = async() => {
  // 更新检查已被禁用：永不从服务器获取更新信息
  versionActions.setVersionInfo({
    ...versionState.versionInfo,
    status: 'idle',
    isLatest: true,
  })
}
export const downloadUpdate = () => {
  // 更新下载已被禁用：不做任何事
}

export const setIgnoreVersion = (version: InitState['ignoreVersion']) => {
  versionActions.setIgnoreVersion(version)
  saveIgnoreVersion(version)
}
