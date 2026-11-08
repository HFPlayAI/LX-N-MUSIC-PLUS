import { useEffect, useState } from 'react'
import state from './state'

const subscribe = (update: () => void) => {
  const handleUpdate = () => {
    update()
  }
  global.state_event.on('wyUserUpdated', handleUpdate)
  return () => {
    global.state_event.off('wyUserUpdated', handleUpdate)
  }
}

export const useWyUserState = () => {
  const [snap, update] = useState(() => ({
    wy_uid: state.wy_uid,
    wy_vip_type: state.wy_vip_type,
    wy_profile: state.wy_profile,
    wy_liked_song_ids: state.wy_liked_song_ids,
    wy_liked_playlist_id: state.wy_liked_playlist_id,
    wy_playlists: state.wy_playlists,
    wy_followed_artists: state.wy_followed_artists,
    wy_subscribed_albums: state.wy_subscribed_albums,
    wy_subscribed_playlists: state.wy_subscribed_playlists,
  }))

  useEffect(() => subscribe(() => {
    update({
      wy_uid: state.wy_uid,
      wy_vip_type: state.wy_vip_type,
      wy_profile: state.wy_profile,
      wy_liked_song_ids: state.wy_liked_song_ids,
      wy_liked_playlist_id: state.wy_liked_playlist_id,
      wy_playlists: state.wy_playlists,
      wy_followed_artists: state.wy_followed_artists,
      wy_subscribed_albums: state.wy_subscribed_albums,
      wy_subscribed_playlists: state.wy_subscribed_playlists,
    })
  }), [])

  return snap
}

export const useWyIsLogin = () => {
  const { wy_uid, wy_profile } = useWyUserState()
  return !!(wy_uid ?? wy_profile)
}
