import { type NAV_ID_Type, type COMPONENT_IDS } from '@/config/constant'
import type { ListInfoItem } from '@/store/songlist/state'


// 内嵌详情栈条目（保留宿主页面框架的层内导航）
export type HomeDetailStackItem =
  | { id: number, type: 'songlist', info: ListInfoItem }
  | { id: number, type: 'artist', info: { id: string, name: string, img?: string, raw?: any, source?: LX.OnlineSource } }
  | { id: number, type: 'album', info: { id: string, name: string, img?: string, raw?: any, source?: LX.OnlineSource } }

// 详情栈宿主：主窗口（保留侧边导航/顶栏）与播放页（全屏播放器之上）
export type DetailHostType = 'home' | 'playDetail'

export interface InitState {
  fontSize: number
  statusbarHeight: number
  componentIds: Partial<Record<COMPONENT_IDS, string>>
  navActiveId: NAV_ID_Type
  lastNavActiveId: NAV_ID_Type
  sourceNames: Record<LX.OnlineSource | 'all', string>
  bgPic: string | null
  // 各宿主各自的详情栈（互不干扰）
  detailStacks: Record<DetailHostType, HomeDetailStackItem[]>
  // 兼容旧引用：主窗口栈的快捷方式在 action 中维护
  homeDetailStack: HomeDetailStackItem[]
}

const initData = {}

const state: InitState = {
  fontSize: global.lx.fontSize,
  statusbarHeight: 0,
  componentIds: {},
  navActiveId: 'nav_search',
  lastNavActiveId: 'nav_search',
  sourceNames: initData as InitState['sourceNames'],
  bgPic: null,
  detailStacks: { home: [], playDetail: [] },
  homeDetailStack: [],
}


export default state
