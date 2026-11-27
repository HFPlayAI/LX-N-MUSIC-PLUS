import { ToastAndroid } from 'react-native'
import { decodeName, toNewMusicInfo } from '@/utils'
import { dataVerify, qualityFilter } from './utils'
import playerState from '@/store/player/state'
import playerActions from '@/store/player/action'
import settingState from '@/store/setting/state'
import { LIST_IDS } from '@/config/constant'
import { getList } from '@/core/player/playInfo'
import { playNext } from '@/core/player/player'
import { getOtherSource } from '@/core/music/utils'
import { addTempPlayList, clearTempPlayeList } from '@/core/player/tempPlayList'
import { searchMusic as searchAcrossSources } from '@/utils/musicSdk'
import { notifySearchTextUpdated } from '@/core/search/music'
import { setSearchText } from '@/core/search/search'
import { setNavActiveId } from '@/core/common'

// 车机语音点歌只在这四家搜索：咪咕等源常返回片段/异版，容易抢位
const VOICE_SOURCES = ['kw', 'kg', 'tx', 'wy']

// const handleSearchMusic = ({ paths, data: params }) => {
//   let text
//   let source
//   if (params) {
//     text = dataVerify([
//       { key: 'keywords', types: ['string', 'number'], max: 128, required: true },
//     ], params).keywords
//     source = params.source
//   } else {
//     if (!paths.length) throw new Error('Keyword missing')

//     if (paths.length > 1) {
//       text = paths[1]
//       source = paths[0]
//     } else {
//       text = paths[0]
//     }

//     if (text.length > 128) text = text.substring(0, 128)
//   }

//   if (isShowPlayerDetail.value) setShowPlayerDetail(false)
//   const sourceList = [...sources, 'all']
//   source = sourceList.includes(source) ? source : null
//   setTimeout(() => {
//     router.replace({
//       path: '/search',
//       query: {
//         text,
//         source,
//       },
//     })
//   }, 500)
// }

const filterInfoByPlayMusic = musicInfo => {
  switch (musicInfo.source) {
    case 'kw':
      musicInfo = dataVerify([
        { key: 'name', types: ['string'], required: true, max: 200 },
        { key: 'singer', types: ['string'], required: true, max: 200 },
        { key: 'source', types: ['string'], required: true },
        { key: 'songmid', types: ['string', 'number'], max: 64, required: true },
        { key: 'img', types: ['string'], max: 1024 },
        { key: 'albumId', types: ['string', 'number'], max: 64 },
        { key: 'interval', types: ['string'], max: 64 },
        { key: 'albumName', types: ['string'], max: 64 },
        { key: 'types', types: ['object'], required: true },
      ], musicInfo)
      break
    case 'kg':
      musicInfo = dataVerify([
        { key: 'name', types: ['string'], required: true, max: 200 },
        { key: 'singer', types: ['string'], required: true, max: 200 },
        { key: 'source', types: ['string'], required: true },
        { key: 'songmid', types: ['string', 'number'], max: 64, required: true },
        { key: 'img', types: ['string'], max: 1024 },
        { key: 'albumId', types: ['string', 'number'], max: 64 },
        { key: 'interval', types: ['string'], max: 64 },
        { key: '_interval', types: ['number'], max: 64 },
        { key: 'albumName', types: ['string'], max: 64 },
        { key: 'types', types: ['object'], required: true },

        { key: 'hash', types: ['string'], required: true, max: 64 },
      ], musicInfo)
      break
    case 'tx':
      musicInfo = dataVerify([
        { key: 'name', types: ['string'], required: true, max: 200 },
        { key: 'singer', types: ['string'], required: true, max: 200 },
        { key: 'source', types: ['string'], required: true },
        { key: 'songmid', types: ['string', 'number'], max: 64, required: true },
        { key: 'img', types: ['string'], max: 1024 },
        { key: 'albumId', types: ['string', 'number'], max: 64 },
        { key: 'interval', types: ['string'], max: 64 },
        { key: 'albumName', types: ['string'], max: 64 },
        { key: 'types', types: ['object'], required: true },

        { key: 'strMediaMid', types: ['string'], required: true, max: 64 },
        { key: 'albumMid', types: ['string'], max: 64 },
      ], musicInfo)
      break
    case 'wy':
      musicInfo = dataVerify([
        { key: 'name', types: ['string'], required: true, max: 200 },
        { key: 'singer', types: ['string'], required: true, max: 200 },
        { key: 'source', types: ['string'], required: true },
        { key: 'songmid', types: ['string', 'number'], max: 64, required: true },
        { key: 'img', types: ['string'], max: 1024 },
        { key: 'albumId', types: ['string', 'number'], max: 64 },
        { key: 'interval', types: ['string'], max: 64 },
        { key: 'albumName', types: ['string'], max: 64 },
        { key: 'types', types: ['object'], required: true },
      ], musicInfo)
      break
    case 'mg':
      musicInfo = dataVerify([
        { key: 'name', types: ['string'], required: true, max: 200 },
        { key: 'singer', types: ['string'], required: true, max: 200 },
        { key: 'source', types: ['string'], required: true },
        { key: 'songmid', types: ['string', 'number'], max: 64, required: true },
        { key: 'img', types: ['string'], max: 1024 },
        { key: 'albumId', types: ['string', 'number'], max: 64 },
        { key: 'interval', types: ['string'], max: 64 },
        { key: 'albumName', types: ['string'], max: 64 },
        { key: 'types', types: ['object'], required: true },

        { key: 'copyrightId', types: ['string', 'number'], required: true, max: 64 },
        { key: 'lrcUrl', types: ['string'], max: 1024 },
        { key: 'trcUrl', types: ['string'], max: 1024 },
        { key: 'mrcUrl', types: ['string'], max: 1024 },
      ], musicInfo)
      break
    default: throw new Error('Unknown source: ' + musicInfo.source)
  }
  musicInfo.types = qualityFilter(musicInfo.source, musicInfo.types)
  return musicInfo
}
const handlePlayMusic = ({ data: _musicInfo }) => {
  _musicInfo = filterInfoByPlayMusic(_musicInfo)

  let musicInfo = {
    ..._musicInfo,
    singer: decodeName(_musicInfo.singer),
    name: decodeName(_musicInfo.name),
    albumName: decodeName(_musicInfo.albumName),
    otherSource: null,
    _types: {},
    typeUrl: {},
  }
  for (const type of musicInfo.types) {
    musicInfo._types[type.type] = { size: type.size }
  }
  musicInfo = toNewMusicInfo(musicInfo)
  const isPlaying = !!playerState.playMusicInfo.musicInfo
  addTempPlayList([{ listId: LIST_IDS.PLAY_LATER, musicInfo, isTop: true }])
  if (isPlaying) playNext()
}


const verifyInfo = (info) => {
  return dataVerify([
    { key: 'name', types: ['string'], required: true, max: 200 },
    { key: 'singer', types: ['string'], max: 200 },
    { key: 'albumName', types: ['string'], max: 64 },
    { key: 'interval', types: ['string'], max: 64 },
    { key: 'playLater', types: ['boolean'] },
  ], info)
}

const searchMusic = async(name, singer, albumName, interval, options = {}) => {
  return getOtherSource({
    name,
    singer,
    interval,
    meta: {
      albumName,
    },
    source: 'local',
    id: `sp_${name}_s${singer}_a${albumName}_i${interval ?? ''}`,
  }, false, options)
}

// '03:43' → 223 秒；解析不了返回 0（视为平台未给时长）
const toSec = (interval) => {
  if (!interval) return 0
  const arr = String(interval).split(':')
  let sec = 0
  for (const v of arr) sec = sec * 60 + (parseInt(v) || 0)
  return sec
}

// 归一化：小写 → 去括号内容（Live/伴奏/翻自/Remix）→ 去空白与标点
const normName = (s) => String(s ?? '')
  .toLowerCase()
  .replace(/[(（[【][^)）\]】]*[)）\]】]/g, '')
  .replace(/[\s\-_/·、,，.。!！?？'"‘’“”]/g, '')

const isSingerMatch = (want, item) => {
  if (!want) return true
  if (!item) return false
  return item.includes(want) || want.includes(item)
}

/**
 * 从候选里挑最合适的一条。
 * 优先级：歌名匹配 > 歌手匹配 > 时长合理性；版本标记不参与打分（避免只有 Live 版的歌被翻唱顶掉）。
 * 异常短（<45s）在有正常时长候选时会被剔除，全部异常时退回原集合，保证不丢结果。
 * 返回 { item, singerMatched }：singerMatched=false 表示「全都不这个人唱的」，
 * 调用方据此决定是播还是提示未找到（避免把别人的同名歌播给用户）。
 */
const pickBestMatch = (list, { name, singer }) => {
  if (!list.length) return null
  const wantName = normName(name)
  const wantSinger = normName(singer)

  const scored = list.map(item => {
    const sec = toSec(item.interval)
    const itemName = normName(item.name)
    const itemSinger = normName(item.singer)
    const singerMatched = isSingerMatch(wantSinger, itemSinger)
    let nameScore = 0
    if (wantName && itemName) {
      if (itemName === wantName) nameScore = 55
      else if (itemName.includes(wantName) || wantName.includes(itemName)) {
        // 子串匹配要限制长度差距：'燃' 不能匹配 '燃亮我'（1/3），
        // 但 '晴天' 能匹配 '晴天' 和 '晴天 (Live)'（去括号后相等，走上面的 55 分支）
        const short = Math.min(wantName.length, itemName.length)
        const long = Math.max(wantName.length, itemName.length)
        if (short >= 2 && short / long >= 0.6) nameScore = 45
      }
    }
    let score = nameScore
    if (!wantSinger) score += 6
    else if (singerMatched) score += 27
    if (sec === 0) score += 6
    else if (sec >= 90 && sec <= 420) score += 12
    else if (sec >= 45 && sec <= 600) score += 6
    return { item, score, sec, singerMatched, nameScore }
  })

  // 剔除片段/铃声（<45s），但全部都是短版本时不过滤
  const normal = scored.filter(x => x.sec === 0 || x.sec >= 45)
  const pool = normal.length ? normal : scored
  pool.sort((a, b) => b.score - a.score)
  return pool[0]
}
const handleSearchPlayMusic = async({ paths, data }) => {
  // console.log(paths, data)
  let info
  if (paths.length) {
    let name = paths[0].trim()
    let singer = ''
    if (name.includes('-')) [name, singer] = name.split('-').map(val => val.trim())
    info = {
      name,
      singer,
    }
  } else info = data
  info = verifyInfo(info)
  if (!info.name) return false
  // 「林俊杰的歌曲」「周杰伦的歌」这类说话方式：剥掉后缀按歌手处理。
  // 不处理的话会被当成一个叫《林俊杰的歌曲》的歌名去搜，匹配不到就静默无反应。
  const singerOnlyMatch = info.name.match(/^(.{2,})的(歌曲|歌|音乐|歌单|专辑|全部歌曲|所有歌曲)$/)
  if (singerOnlyMatch) {
    info.name = singerOnlyMatch[1]
    if (!info.singer || normName(info.singer) === normName(info.name)) info.singer = ''
  }
  const beforeListId = playerState.playInfo.playerListId
  const beforeMusicId = playerState.playMusicInfo.musicInfo?.id
  // 插播前正在播的那首歌（以及它所属的列表），用于插播结束后回到原处。
  const resumeMusic = playerState.playMusicInfo.musicInfo
  const resumeListId = playerState.playInfo.playerListId
  if (!resumeMusic) {
    // 列表里残留着「当前曲目」但实际没在播（重启恢复的旧进度）。
    // 定位到最后一首，让 playNext 的 listLoop 分支循环回第 0 首，
    // 避免从第二首开始。
    // 不能设 -1：playNext 里有 `if (playerIndex == -1) playerIndex = 0`，再 +1 就跳过第一首了。
    const curList = resumeListId ? getList(resumeListId) : []
    if (curList.length) playerActions.updatePlayIndex(curList.length - 1, curList.length - 1)
  }
  let musicQueue = []
  // 只在 kw/kg/tx/wy 四家搜（咪咕等源常出片段版）
  const musicList = await searchMusic(info.name, info.singer || '', info.albumName || '', info.interval || null, { onlySources: VOICE_SOURCES, strictName: true })
  if (musicList.length) {
    console.log('find music:', musicList.length)
    musicQueue = musicList
  } else {
    // 兜底同样限定四源：直接拿各源原始结果，交给 pickBestMatch 打分（不再走全源聚合搜索）
    const results = await Promise.race([
      searchAcrossSources({ name: info.name, singer: info.singer || '', onlySources: VOICE_SOURCES }),
      new Promise(resolve => setTimeout(() => { resolve([]) }, 10000)),
    ])
    const flat = []
    for (const r of results) {
      if (!r?.list?.length) continue
      // searchAcrossSources 返回的是各源原始结果（没有 meta.picUrl 等标准字段），
      // 必须过一遍 toNewMusicInfo，否则播放时会在读取 meta 时崩掉
      for (const item of r.list) flat.push(toNewMusicInfo(item))
    }
    console.log('fallback search:', info.name, info.singer || '', flat.length)
    musicQueue = flat
  }
  // 歌手级点歌：「周杰伦」这种——结果里没有任何歌名精确等于它，但有多条歌手包含它。
  // 这时不该当成「一首叫周杰伦的歌」，而是把该歌手的歌组成队列连播。
  const normQuery = normName(info.name)
  const hasExactSongName = musicQueue.some(m => normName(m.name) === normQuery)
  const singerHits = info.singer || hasExactSongName
    ? []
    : musicQueue.filter(m => normName(m.singer).includes(normQuery))
  const isSingerLevel = singerHits.length >= 3

  const best = isSingerLevel ? null : pickBestMatch(musicQueue, info)
  console.log('voice pick:', JSON.stringify({
    isSingerLevel,
    hits: singerHits.length,
    queue: musicQueue.length,
    exactName: hasExactSongName,
    best: best ? { name: best.item?.name, singer: best.item?.singer, score: best.score, nameScore: best.nameScore } : null,
    beforeMusicId,
    listId: beforeListId,
    playIndex: playerState.playInfo.playerPlayIndex,
    playedCount: playerState.playedList.length,
    tempLeft: playerState.tempPlayList.length,
  }))
  // 用户明确说了歌手，但所有候选都不是这个人唱的 → 宁可提示未找到，也不播别人的同名歌
  if (best && info.singer && !best.singerMatched) {
    console.log('singer not matched:', info.name, info.singer)
    if (settingState.setting['player.isShowVoiceTip']) {
      ToastAndroid.show(`未找到 ${info.singer} 的《${info.name}》`, ToastAndroid.LONG)
    }
    return false
  }
  // 歌名完全对不上（只有歌手像或干脆都不像）→ 不拿一首不相干的歌糊弄
  if (best && best.nameScore === 0) {
    console.log('name not matched:', info.name, best.item?.name)
    if (settingState.setting['player.isShowVoiceTip']) {
      ToastAndroid.show(`未找到《${info.name}》`, ToastAndroid.LONG)
    }
    return false
  }
  const musicInfo = best?.item ?? null
  if (isSingerLevel || musicInfo) {
    const afterListId = playerState.playInfo.playerListId
    // 搜索期间用户主动切换了播放列表才取消。
    // 不比较具体歌曲：一首歌播完自动进下一首（车机上搜索要几秒，很常见）不该被当成"用户干预"。
    if (beforeMusicId && afterListId !== beforeListId) {
      if (settingState.setting['player.isShowVoiceTip']) ToastAndroid.show('检测到你已切换播放列表，语音点歌已取消', ToastAndroid.LONG)
      return false
    }
    if (isSingerLevel) {
      // 歌手级：整批进"稍后播放"连播，播完回原列表
      const batch = singerHits.slice(0, 50)
      if (settingState.setting['player.isShowVoiceTip']) {
        ToastAndroid.show(`播放 ${info.name} 的 ${batch.length} 首歌`, ToastAndroid.SHORT)
      }
      clearTempPlayeList()
      const batchItems = batch.map(m => ({ listId: LIST_IDS.PLAY_LATER, musicInfo: m, isTop: true }))
      // 整批播完同样回到插播前那首
      if (resumeMusic) {
        batchItems.push({ listId: resumeListId ?? LIST_IDS.PLAY_LATER, musicInfo: resumeMusic, isTop: true })
      }
      addTempPlayList(batchItems)
      if (beforeMusicId) playNext().catch((e) => { console.log('playNext err:', e?.message) })
    } else {
      if (settingState.setting['player.isShowVoiceTip']) ToastAndroid.show(`播放: ${musicInfo.name} - ${String(musicInfo.singer ?? '')}`, ToastAndroid.SHORT)
      // 单曲点歌只放这一首，后面紧跟"插播前正在播的那首"。
      // playNext() 优先消费「稍后播放」：先播稻香，播完/点下一首就回到原来那首，
      // 不会让整批候选挤占队列，也不会跳回列表开头。
      // 先清掉上一次语音点歌可能残留的队列，避免多次点歌后越积越多、下一首走错
      clearTempPlayeList()
      const queueItems = [{ listId: LIST_IDS.PLAY_LATER, musicInfo, isTop: true }]
      if (resumeMusic && !info.playLater) {
        queueItems.push({
          listId: resumeListId ?? LIST_IDS.PLAY_LATER,
          musicInfo: resumeMusic,
          isTop: true,
        })
      }
      addTempPlayList(queueItems)
      console.log('queue before next:', JSON.stringify({
        idx: playerState.playInfo.playerPlayIndex,
        pid: playerState.playInfo.playerListId,
        temp: playerState.tempPlayList.length,
        resume: resumeMusic?.name ?? null,
      }))
      if (beforeMusicId) playNext().catch((e) => { console.log('playNext err:', e?.message) })
    }
    setSearchText(info.name)
    notifySearchTextUpdated(info.name)
    setNavActiveId('nav_search')
    return true
  } else {
    console.log('music not found:', info)
    if (settingState.setting['player.isShowVoiceTip']) ToastAndroid.show(`未找到: ${info.name}`, ToastAndroid.LONG)
    return false
  }
}

export const handleMusicAction = async(action, info) => {
  switch (action) {
    // case 'search':
    //   handleSearchMusic(info)
    //   break
    case 'play':
      handlePlayMusic(info)
      break
    case 'searchPlay':
      // 透传结果：true=已播放，false=未找到/被取消
      return handleSearchPlayMusic(info)
    // default: throw new Error('Unknown action: ' + action)
  }
}
