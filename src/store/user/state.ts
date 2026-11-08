export interface FollowedArtistInfo {
  id: string | number
  name: string
  alias: string[] | null
  albumSize: number
  picUrl: string
  img1v1Url: string
  briefDesc?: string
  cover?: string
  avatar?: string
  fansCount?: number
}

export interface SubscribedAlbumInfo {
  id: string | number
  name: string
  picUrl: string
  artists: Array<{ id: string | number, name: string }>
  publishTime: number
  size: number
}

export interface SubscribedPlaylistInfo {
  id: string | number
  userId: number
  name: string
  coverImgUrl: string
  trackCount: number
  description?: string
}

export interface UserPlaylistInfo {
  id: string | number
  name: string
  coverImgUrl: string
  trackCount: number
  userId: number
  creator?: { userId: number, nickname: string }
}

export interface WyUserProfile {
  uid: string
  nickname: string
  avatarUrl: string
  vipType: number
}

// 网易云账号运行时状态（非持久化，登录态由设置中的 Cookie 持久化）。
// UI 通过 hook 订阅变化；musicSdk 通过 action 更新。
export const userState = {
  wy_uid: null as string | null,
  wy_vip_type: 0,
  wy_profile: null as WyUserProfile | null,
  wy_liked_song_ids: new Set<string>(),
  wy_liked_playlist_id: null as string | null,
  wy_playlists: [] as UserPlaylistInfo[],
  wy_followed_artists: [] as FollowedArtistInfo[],
  wy_subscribed_albums: [] as SubscribedAlbumInfo[],
  wy_subscribed_playlists: [] as SubscribedPlaylistInfo[],
}

export default userState
