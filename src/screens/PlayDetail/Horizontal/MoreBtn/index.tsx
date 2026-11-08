import {createStyle} from '@/utils/tools'
import { View, TouchableOpacity } from 'react-native'
import { memo, useRef, useCallback, useEffect } from 'react'
import { type Position } from '@/screens/Home/Views/Mylist/MusicList/ListMenu'
import PlayDetailMenu, { type PlayDetailMenuType, type SelectInfo } from '@/screens/PlayDetail/components/PlayDetailMenu'
import SimilarSongsModal, { type SimilarSongsModalType } from '@/components/SimilarSongsModal'
import playerState from '@/store/player/state'
import { handleDislikeMusic, handleShowMusicSourceDetail } from '@/screens/Home/Views/Mylist/MusicList/listAction'
import {handleLikeMusic, handleShowAlbumDetail, handleShowArtistDetail, handlePlayMv} from '@/components/OnlineList/listAction'
import { usePlayMusicInfo } from '@/store/player/hook'
import commonState from '@/store/common/state'
import { COMPONENT_IDS } from '@/config/constant'
import PlayModeBtn from './PlayModeBtn'
import MusicAddBtn from './MusicAddBtn'
import CommentBtn from './CommentBtn'
import Btn from './Btn'

// 播放页左侧按钮列（与竖屏底部按钮行一致：添加到歌单 / 播放模式 / 评论 / 更多菜单）
// 原「定时关闭」按钮已按需求移除（竖屏顶栏仍保留）
export default memo(({ componentId }: { componentId?: string }) => {
  const menuRef = useRef<PlayDetailMenuType>(null);
  const moreBtnRef = useRef<TouchableOpacity>(null);
  const similarSongsModalRef = useRef<SimilarSongsModalType>(null);
  // push歌手/专辑详情页的组件ID：优先调用方传入，否则回退播放页自身
  // 注意：必须在点击时实时求值——PlayDetail 的 componentId 注册发生在首渲染之后，
  // 若在 render 时求值会被 memo 固定为空值导致 push 无反应
  const getPushComponentId = () => componentId ?? commonState.componentIds[COMPONENT_IDS.playDetail] ?? ''

  // 监听歌曲变化，以便在菜单打开时能重新渲染以获取最新的“喜欢”状态
  useEffect(() => {
    const handleMusicChange = () => {
      // 仅触发组件重新渲染，让菜单项重新计算
    };
    global.state_event.on('playerMusicInfoChanged', handleMusicChange);
    global.state_event.on('wyUserUpdated', handleMusicChange);

    return () => {
      global.state_event.off('playerMusicInfoChanged', handleMusicChange);
      global.state_event.off('wyUserUpdated', handleMusicChange);
    };
  }, []);

  const handleShowMenu = useCallback(() => {
    const musicInfo = playerState.playMusicInfo.musicInfo;
    if (!musicInfo) return;

    moreBtnRef.current?.measure((fx, fy, width, height, px, py) => {
      const position: Position = {
        x: Math.ceil(px),
        y: Math.ceil(py),
        w: Math.ceil(width),
        h: Math.ceil(height),
      };
      menuRef.current?.show({ musicInfo: 'progress' in musicInfo ? musicInfo.metadata.musicInfo : musicInfo }, position);
    });
  }, []);

  const onArtistDetail = (info: SelectInfo) => {
    if (info.musicInfo.source !== 'local') {
      void handleShowArtistDetail(getPushComponentId(), info.musicInfo as LX.Music.MusicInfoOnline);
    }
  };

  const onAlbumDetail = (info: SelectInfo) => {
    if (info.musicInfo.source !== 'local') {
      handleShowAlbumDetail(getPushComponentId(), info.musicInfo as LX.Music.MusicInfoOnline);
    }
  };

  const onSimilarSongs = (info: SelectInfo) => {
    similarSongsModalRef.current?.show(info.musicInfo);
  };

  const onMusicSourceDetail = (info: SelectInfo) => {
    void handleShowMusicSourceDetail(info.musicInfo as any);
  };

  const onDislikeMusic = (info: SelectInfo) => {
    void handleDislikeMusic(info.musicInfo as any);
  };

  const onLike = (info: SelectInfo) => {
    if (info.musicInfo.source === 'wy') {
      void handleLikeMusic(info.musicInfo as LX.Music.MusicInfoOnline);
    }
  };

  const onPlayMv = (info: SelectInfo) => {
    handlePlayMv(info.musicInfo as LX.Music.MusicInfoOnline);
  };

  // 订阅当前歌曲变化，歌曲切换时刷新“喜欢”状态显示
  usePlayMusicInfo();

  return (
    <>
      <View style={styles.container}>
        <MusicAddBtn />
        <PlayModeBtn />
        <CommentBtn />
        <Btn icon="dots-vertical" onPress={handleShowMenu} ref={moreBtnRef} />
      </View>

      <PlayDetailMenu
        ref={menuRef}
        onLike={onLike}
        onArtistDetail={onArtistDetail}
        onAlbumDetail={onAlbumDetail}
        onSimilarSongs={onSimilarSongs}
        onMusicSourceDetail={onMusicSourceDetail}
        onDislikeMusic={onDislikeMusic}
        onPlayMv={onPlayMv}
      />
      <SimilarSongsModal ref={similarSongsModalRef} />
    </>
  )
})

const styles = createStyle({
  container: {
    flexShrink: 0,
    flexGrow: 0,
    flexDirection: 'column',
    alignItems: 'center',
    // backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    position: 'absolute',
    height: '100%',
    left: 0,
    gap: 12,
    zIndex: 1,
  },
})
