import { getData, saveData } from '@/plugins/storage'
import { importUserApi, removeUserApi } from '@/core/userApi'
import { state } from '@/store/userApi'
import { updateSetting } from '@/core/common'
import settingState from '@/store/setting/state'
import { BUILT_IN_USER_APIS, BUILT_IN_USER_APIS_VERSION } from './scripts'

// 内置音源自动导入标记的存储 key（值为内置源集版本号）
const BUILT_IN_APIS_FLAG_KEY = '@built_in_user_apis_imported'
// 默认启用的内置源（@name）
const DEFAULT_API_NAME = '安妮独家音源'

// v1 内置的 22 个源名。升级到 v2 时按名字精确删除，避免旧的失效源残留，
// 也避免「同名跳过」导致新版本脚本没被更新。用户手动导入的其它源会保留。
const OLD_BUILT_IN_NAMES = [
  'HYWmusic_公益版',
  '𝖧౿ᥣᥣ𝗈 Ԝ𝗈𝗋ᥣᑯ',
  'gdstudio音乐源',
  'lx-玉宁熙-Pro',
  '星澜聚合音源 (StellarWave)',
  '全豆要[聚合音源]',
  '回避聚合 (HuiBi Aggregate)',
  '墨澜聚合音源',
  '屿溪-终章',
  '幻音音源',
  '念心音源',
  '收集の聚合接口(LX版)',
  '星海音乐源',
  '溯音音源',
  '稳定版音源 v1.0.3',
  '统一音乐源',
  '聚合API接口 (CF)',
  '👖裤佬SVIP音源(二改整合版)',
  '西瓜聚合源',
  '长青SVIP音源(二改修复版)',
  '长青SVIP音源',
  '非常刀',
]

/**
 * 内置音源导入（幂等）+ 旧源清理迁移。
 * 返回建议使用的默认源 id；调用方需遵守「用户已手动选过源时优先用用户的选择」。
 *
 * 必须由 initUserApi 等待完成后再调用 setApiSource，否则源还没写入 storage，
 * setUserApi 会抛 'api not found' 而默认源静默失效。
 */
export const importBuiltInUserApis = async(): Promise<string | null> => {
  try {
    const version = await getData<string>(BUILT_IN_APIS_FLAG_KEY)
    if (version !== BUILT_IN_USER_APIS_VERSION) {
      // 旧内置源 + 本次要替换的同名源，一起删掉再重新导入
      const names = new Set([...OLD_BUILT_IN_NAMES, ...BUILT_IN_USER_APIS.map(api => api.name)])
      const removeIds = state.list.filter(api => names.has(api.name)).map(api => api.id)
      if (removeIds.length) {
        await removeUserApi(removeIds)
        // 当前选中的源若被删除，清空设置，避免稍后 setApiSource 传入不存在的 id
        if (removeIds.includes(settingState.setting['common.apiSource'])) {
          updateSetting({ 'common.apiSource': '' })
        }
      }

      let importedCount = 0
      for (const api of BUILT_IN_USER_APIS) {
        try {
          await importUserApi(api.script)
          importedCount++
        } catch (err) {
          console.warn('[built-in user api] import failed:', api.name, err)
        }
      }

      await saveData(BUILT_IN_APIS_FLAG_KEY, BUILT_IN_USER_APIS_VERSION)
      if (importedCount) console.log(`[built-in user api] imported ${importedCount} sources`)
    }

    return state.list.find(api => api.name === DEFAULT_API_NAME)?.id ?? null
  } catch (err) {
    console.warn('[built-in user api] import error:', err)
    return null
  }
}
