import { forwardRef, useImperativeHandle, useMemo, useState } from 'react'

import Basic from './settings/Basic'
import Source from './settings/Source'
import Player from './settings/Player'
import LyricDesktop from './settings/LyricDesktop'
import Search from './settings/Search'
import List from './settings/List'
import Sync from './settings/Sync'
import Backup from './settings/Backup'
import Other from './settings/Other'
import NetEase from './settings/NetEase'
import SettingErrorBoundary from './components/SettingErrorBoundary'

export const SETTING_SCREENS = [
  'basic',
  'source',
  'netease',
  'player',
  'lyric_desktop',
  'search',
  'list',
  'sync',
  'backup',
  'other',
] as const

export type SettingScreenIds = typeof SETTING_SCREENS[number]

// interface MainProps {
//   onUpdateActiveId: (id: string) => void
// }
export interface MainType {
  setActiveId: (id: SettingScreenIds) => void
}

const Main = forwardRef<MainType, {}>((props, ref) => {
  const [id, setId] = useState(global.lx.settingActiveId)

  useImperativeHandle(ref, () => ({
    setActiveId(id) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setId(id)
        })
      })
    },
  }))

  const component = useMemo(() => {
    switch (id) {
      case 'source': return <Source />
      case 'netease': return <NetEase />
      case 'player': return <Player />
      case 'lyric_desktop': return <LyricDesktop />
      case 'search': return <Search />
      case 'list': return <List />
      case 'sync': return <Sync />
      case 'backup': return <Backup />
      case 'other': return <Other />
      case 'basic':
      default: return <Basic />
    }
  }, [id])

  // key=id：切换标签时重置错误边界，避免某个标签的错误状态带到其它标签
  return <SettingErrorBoundary key={id}>{component}</SettingErrorBoundary>
})


export default Main

