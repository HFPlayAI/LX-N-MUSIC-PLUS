import state, { type InitState, type DetailHostType, type HomeDetailStackItem } from './state'
import { type COMPONENT_IDS } from '@/config/constant'

let homeDetailIdSeq = 0

// 同步主窗口栈的兼容快捷引用，并广播更新
const syncStack = (host: DetailHostType) => {
  if (host === 'home') state.homeDetailStack = state.detailStacks.home
  global.state_event.homeDetailStackUpdated(state.detailStacks[host], host)
}


export default {
  setFontSize(size: number) {
    state.fontSize = size
    global.state_event.fontSizeUpdated(size)
  },
  setStatusbarHeight(size: number) {
    if (state.statusbarHeight == size) return
    state.statusbarHeight = size
    global.state_event.statusbarHeightUpdated(size)
  },
  setComponentId(name: COMPONENT_IDS, id: string) {
    state.componentIds[name] = id
    global.state_event.componentIdsUpdated({ ...state.componentIds })
  },
  removeComponentId(id: string) {
    const name = (Object.entries(state.componentIds) as Array<[COMPONENT_IDS, string]>).find(kv => kv[1] == id)?.[0]
    if (!name) return
    delete state.componentIds[name]
    global.state_event.componentIdsUpdated({ ...state.componentIds })
  },
  setNavActiveId(id: InitState['navActiveId']) {
    state.navActiveId = id
    if (id != 'nav_setting') state.lastNavActiveId = id
    global.state_event.navActiveIdUpdated(id)
    // 切换导航页时清空主窗口详情栈（避免切换后详情页残留遮挡）
    if (state.detailStacks.home.length) {
      state.detailStacks.home = []
      syncStack('home')
    }
  },
  setLastNavActiveId(id: InitState['navActiveId']) {
    state.lastNavActiveId = id
  },
  setBgPic(pic: string | null) {
    state.bgPic = pic
    global.state_event.bgPicUpdated(pic)
  },
  setSourceNames(names: InitState['sourceNames']) {
    state.sourceNames = names
    global.state_event.sourceNamesUpdated(names)
  },
  // 层内详情栈（歌单/歌手/专辑详情在宿主页面内打开，保留宿主框架）
  // host 缺省为 'home'，播放页传入 'playDetail'
  pushHomeDetail(item: Omit<HomeDetailStackItem, 'id'>, host: DetailHostType = 'home') {
    const typedItem = { ...item, id: ++homeDetailIdSeq } as HomeDetailStackItem
    state.detailStacks[host] = [...state.detailStacks[host], typedItem]
    syncStack(host)
  },
  popHomeDetail(host: DetailHostType = 'home') {
    if (!state.detailStacks[host].length) return
    state.detailStacks[host] = state.detailStacks[host].slice(0, -1)
    syncStack(host)
  },
  clearHomeDetail(host: DetailHostType = 'home') {
    if (!state.detailStacks[host].length) return
    state.detailStacks[host] = []
    syncStack(host)
  },
}
