// 网易云增强模块的设置读取桥接。
// A 项目（lx-music-mobile）的设置存放在 store/setting/state 的 state.setting 中，
// 这里用 Proxy 提供与 B 项目（LX-N Music）`appSetting['common.wy_cookie']` 相同的访问方式。
// 注意：必须通过 getter 动态读取，不能解构缓存（设置更新后对象引用会被整体替换）。
import state from '@/store/setting/state'

export const appSetting = new Proxy({}, {
  get(_target, key) {
    return state.setting?.[key]
  },
  has(_target, key) {
    return state.setting ? key in state.setting : false
  },
})
