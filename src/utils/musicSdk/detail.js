import musicSdk from './index'

/**
 * 歌手/专辑详情统一适配层。
 *
 * 各平台能力不一致：wy 有完整 artist/album；kg 有 singer/album；kw 只有 album；
 * tx 有 singer（musicu.fcg）与 album（musicu.fcg）。因此统一约定
 *   getArtistDetail(source, { id, name }) -> { info, list, hasMore }
 *   getAlbumDetail(source, { id, name })  -> { info, list, hasMore }
 * list 为 oldMusicInfo 数组，由详情页统一 toNewMusicInfo。
 *
 * 任何平台/接口取不到数据时降级为「按名称搜索」，保证四个平台都能打开详情页
 * （kw 的歌手详情原本没有对应接口，按需求明确采用此降级）。
 */
const LIMIT = 100
const empty = () => ({ info: null, list: [], hasMore: false })

const firstSingerName = name => String(name ?? '').split(/[、,，/&]/)[0].trim()

const searchSongs = async(source, keyword) => {
  const key = String(keyword ?? '').trim()
  if (!key) return []
  try {
    const res = await musicSdk[source]?.musicSearch?.search(key, 1, LIMIT)
    return Array.isArray(res?.list) ? res.list : []
  } catch (err) {
    console.log('detail search fallback failed:', source, err?.message)
    return []
  }
}

const toInfo = (raw = {}) => ({
  name: String(raw.name ?? ''),
  img: String(raw.img ?? raw.picUrl ?? raw.cover ?? raw.img1v1Url ?? ''),
  desc: String(raw.desc ?? raw.description ?? raw.briefDesc ?? ''),
  author: String(raw.author ?? (Array.isArray(raw.artists)
    ? raw.artists.map(a => a?.name).filter(Boolean).join(' / ')
    : raw.artist?.name ?? '')),
})

export const getArtistDetail = async(source, artist) => {
  const name = artist?.name ?? ''
  const id = artist?.id == null ? '' : String(artist.id)
  let result = null
  if (id && !(source === 'kg' && id === '0')) {
    try {
      switch (source) {
        case 'wy': {
          const [detail, songs] = await Promise.all([
            musicSdk.wy.artist.getDetail(id).catch(() => null),
            musicSdk.wy.artist.getSongs(id, 'hot', LIMIT, 0),
          ])
          const a = detail?.artist
          result = {
            info: a ? toInfo({ name: a.name ?? name, img: a.cover ?? a.img1v1Url ?? '', desc: a.briefDesc ?? '' }) : null,
            list: songs?.list ?? [],
            hasMore: !!songs?.hasMore,
          }
          break
        }
        case 'kg': {
          const [detail, songs] = await Promise.all([
            musicSdk.kg.singer.getSingerInfo(id).catch(() => null),
            musicSdk.kg.singer.getSingerSongList(id, 1, LIMIT),
          ])
          result = {
            info: detail?.info ? toInfo({ name: detail.info.name ?? name, img: detail.info.img ?? '', desc: detail.info.desc ?? '' }) : null,
            list: songs?.list ?? [],
            hasMore: (songs?.total ?? 0) > LIMIT,
          }
          break
        }
        case 'tx': {
          const [detail, songs] = await Promise.all([
            musicSdk.tx.singer.getInfo(id).catch(() => null),
            musicSdk.tx.singer.getSongList(id, 1, LIMIT),
          ])
          result = {
            info: detail?.info ? toInfo({ name: detail.info.name ?? name, img: detail.info.img ?? '', desc: detail.info.desc ?? '' }) : null,
            list: songs?.list ?? [],
            hasMore: !!songs?.hasMore,
          }
          break
        }
        default:
          break
      }
    } catch (err) {
      console.log('artist detail precise request failed:', source, err?.message)
    }
  }

  if (result?.list?.length) return result

  // kw 歌手详情没有现成接口；其它平台精确接口失败或返回空列表时也走这里
  const list = await searchSongs(source, firstSingerName(name))
  return { info: result?.info ?? null, list, hasMore: false }
}

export const getAlbumDetail = async(source, album) => {
  const name = album?.name ?? ''
  const id = album?.id == null ? '' : String(album.id)
  if (id) {
    try {
      let result
      switch (source) {
        case 'wy':
          result = await musicSdk.wy.album.getAlbum(id)
          break
        case 'kw':
          result = await musicSdk.kw.album.getAlbumListDetail(id, 1)
          break
        case 'kg':
          result = await musicSdk.kg.album.getAlbumDetail(id, 1, LIMIT)
          break
        case 'tx':
          result = await musicSdk.tx.album.getAlbumDetail(id, 1, LIMIT)
          break
        default:
          break
      }
      if (result?.list?.length) {
        return {
          info: result.info ? toInfo(result.info) : null,
          list: result.list,
          hasMore: (result.total ?? result.list.length) > result.list.length,
        }
      }
    } catch (err) {
      console.log('album detail precise request failed:', source, err?.message)
    }
  }

  // 精确接口不可用（或没有专辑 ID）时按专辑名搜索，尽量给出可用结果
  let list = await searchSongs(source, name)
  if (id && list.length) {
    const matched = list.filter(item => String(item.albumId ?? item.albumMid ?? '') === id)
    if (matched.length) list = matched
  }
  return { ...empty(), list }
}
