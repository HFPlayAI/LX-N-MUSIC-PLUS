package cn.toside.music.mobile.voice;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.ReactInstanceManager;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;

import cn.toside.music.mobile.MainActivity;
import cn.toside.music.mobile.MainApplication;

public class VoiceReceiver extends BroadcastReceiver {
  private static final String TAG = "VoiceCommand";

  public static final String TYPE_SEARCH_PLAY = "searchPlay";
  public static final String TYPE_PLAYER = "player";
  public static final String TYPE_CONTINUE_PLAY = "continuePlay";
  public static final String TYPE_OPEN_APP = "openApp";
  public static final String TYPE_PLAY_FAVORITE = "playFavorite";

  public static final String ACTION_SEARCH_MUSIC = "cn.kuwo.kwmusicauto.action.SEARCH_MUSIC";
  public static final String ACTION_PLAY_MUSIC = "cn.kuwo.kwmusicauto.action.PLAY_MUSIC";
  public static final String ACTION_SEARCH_AND_PLAY_BY_SONGLISTID = "cn.kuwo.kwmusicauto.action.SEARCH_AND_PLAY_MUSIC_BY_SONGLISTID";
  public static final String ACTION_PLAY_ALBUM = "cn.kuwo.kwmusicauto.action.PLAY_ALBUM";
  public static final String ACTION_RANDOM_PLAY = "cn.kuwo.kwmusicauto.action.RANDOM_PLAY_MUSIC";
  public static final String ACTION_STARTAPP = "cn.kuwo.kwmusicauto.action.STARTAPP";
  public static final String ACTION_JUMP = "cn.kuwo.kwmusicauto.action.JUMP";
  public static final String ACTION_PLAY_MUSIC_INDEX = "cn.kuwo.kwmusicauto.action.PLAY_MUSIC_INDEX";
  public static final String ACTION_PLAY_MUSIC_BY_TYPE = "cn.kuwo.kwmusicauto.action.PLAY_MUSIC_BY_TYPE";
  public static final String ACTION_PAGE_OPERATION = "cn.kuwo.kwmusicauto.action.PAGE_OPERATION";
  public static final String ACTION_MEDIA_BUTTON = "cn.kuwo.kwmusicauto.action.MEDIA_BUTTON";
  public static final String ACTION_OPEN_FAVORITE_MUSIC = "cn.kuwo.kwmusicauto.action.OPEN_FAVORITE_MUSIC";
  public static final String ACTION_PLAY_ALL_MUSIC = "cn.kuwo.kwmusicauto.action.vip.PLAY_ALL_MUSIC";
  public static final String ACTION_CAR_ACTIONS = "cn.kuwo.music.car.actions";

  public static final String ACTION_BYD_SEARCH = "com.byd.action.AUTOVOICE_SEARCH";
  public static final String ACTION_BYD_SEARCH_PLUS = "com.byd.action.AUTOVOICE_SEARCH_PLUS";
  public static final String ACTION_BYD_PLAY_RANDOM = "com.byd.action.AUTOVOICE_PLAY_RANDOM";
  public static final String ACTION_BYD_PLAY_FAVORITE = "com.byd.action.AUTOVOICE_PLAY_FAVORITE";
  public static final String ACTION_BYD_PLAY_LATELY = "com.byd.action.AUTOVOICE_PLAY_LATELY";
  public static final String ACTION_BYD_PLAY_DOWNLOAD = "com.byd.action.AUTOVOICE_PLAY_DOWNLOAD";
  public static final String ACTION_BYD_RECOMMEND = "com.byd.action.AUTOVOICE_RECOMMEND";
  public static final String ACTION_BYD_JUMP_TO = "com.byd.action.AUTOVOICE_JUMP_TO";

  public static final String EXTRA_BYD_KEYWORDS = "EXTRA_KEYWORDS_SEARCH";
  public static final String EXTRA_BYD_ARTIST = "EXTRA_ARTIST_SEARCH";

  @Override
  public void onReceive(Context context, Intent intent) {
    if (intent == null) return;
    VoiceRegistrar.register(context);
    String action = intent.getAction();
    Log.d(TAG, "receive action=" + action);
    VoiceDebugLog.append(context, "收到", "action=" + (action == null ? "(无)" : action));

    Bundle extras = intent.getExtras();
    if (extras != null) {
      StringBuilder sb = new StringBuilder();
      for (String key : extras.keySet()) {
        Log.d(TAG, "extra[" + key + "] = " + extras.get(key));
        if (sb.length() > 0) sb.append(" | ");
        sb.append(key).append('=').append(extras.get(key));
      }
      if (sb.length() > 0) VoiceDebugLog.append(context, "参数", sb.toString());
    }
    if (VoiceSettings.isTipEnabled(context)) {
      showToast(context, "语音指令已到: " + (action == null ? "(无action)" : action));
    }

    if (action == null) return;

    if (ACTION_STARTAPP.equals(action)) {
      dispatch(context, TYPE_OPEN_APP, null, null, null);
      return;
    }

    if (ACTION_BYD_SEARCH.equals(action) || ACTION_BYD_SEARCH_PLUS.equals(action)) {
      String keyword = extras == null ? null : extras.getString(EXTRA_BYD_KEYWORDS);
      String artist = extras == null ? null : extras.getString(EXTRA_BYD_ARTIST);
      if (keyword != null && !keyword.trim().isEmpty()) {
        String cleaned = stripPlayPrefix(keyword.trim());
        if (!cleaned.isEmpty()) {
          dispatch(context, TYPE_SEARCH_PLAY, cleaned, trimSinger(artist), null);
        } else {
          dispatchKeywordFallback(context, artist);
        }
      } else {
        dispatchKeywordFallback(context, artist);
      }
      return;
    }

    if (ACTION_BYD_PLAY_FAVORITE.equals(action)) {
      dispatch(context, TYPE_PLAY_FAVORITE, null, null, null);
      return;
    }

    if (ACTION_BYD_PLAY_RANDOM.equals(action)
            || ACTION_BYD_PLAY_LATELY.equals(action)
            || ACTION_BYD_PLAY_DOWNLOAD.equals(action)
            || ACTION_BYD_RECOMMEND.equals(action)
            || ACTION_BYD_JUMP_TO.equals(action)
            || ACTION_OPEN_FAVORITE_MUSIC.equals(action)
            || ACTION_PLAY_ALL_MUSIC.equals(action)
            || ACTION_CAR_ACTIONS.equals(action)
            || ACTION_RANDOM_PLAY.equals(action)) {
      dispatch(context, TYPE_CONTINUE_PLAY, null, null, null);
      return;
    }

    if (ACTION_SEARCH_MUSIC.equals(action)
            || ACTION_PLAY_MUSIC.equals(action)
            || ACTION_SEARCH_AND_PLAY_BY_SONGLISTID.equals(action)
            || ACTION_PLAY_MUSIC_INDEX.equals(action)
            || ACTION_PLAY_MUSIC_BY_TYPE.equals(action)
            || ACTION_PLAY_ALBUM.equals(action)) {
      String query = extractQuery(extras);
      if (query != null && !query.isEmpty()) {
        dispatch(context, TYPE_SEARCH_PLAY, query, extractSinger(extras), null);
      } else {
        dispatchKeywordFallback(context, extractSinger(extras));
      }
      return;
    }

    if (ACTION_JUMP.equals(action) || ACTION_PAGE_OPERATION.equals(action)) {
      dispatch(context, TYPE_OPEN_APP, null, null, null);
      return;
    }

    if (ACTION_MEDIA_BUTTON.equals(action)) {
      String cmd = intent.getStringExtra("EXTRA");
      Log.d(TAG, "MEDIA_BUTTON cmd=" + cmd);
      if (cmd != null && !cmd.trim().isEmpty()) {
        dispatch(context, TYPE_PLAYER, null, null, cmd.trim());
      }
    }
  }

  private void dispatch(@NonNull Context context, @NonNull String type, @Nullable String keyword,
                        @Nullable String artist, @Nullable String playerAction) {
    Log.d(TAG, "dispatch: type=" + type + " keyword=" + keyword + " artist=" + artist + " cmd=" + playerAction);
    VoiceDebugLog.append(context, "解析", "type=" + type
            + (keyword == null ? "" : " 关键词=" + keyword)
            + (artist == null ? "" : " 歌手=" + artist)
            + (playerAction == null ? "" : " 指令=" + playerAction));
    String keywordValue = keyword == null ? null : truncate(keyword, 200);
    String artistValue = artist == null ? null : truncate(artist, 200);
    if (TYPE_SEARCH_PLAY.equals(type) || TYPE_PLAYER.equals(type) || TYPE_CONTINUE_PLAY.equals(type) || TYPE_PLAY_FAVORITE.equals(type)) {
      VoicePendingStore.save(context, type, keywordValue, artistValue, playerAction);
    }
    ReactContext reactContext = getReactContext(context);
    if (reactContext != null && reactContext.hasActiveReactInstance()) {
      WritableMap params = Arguments.createMap();
      params.putString("type", type);
      if (keywordValue != null) params.putString("keyword", keywordValue);
      if (artistValue != null) params.putString("artist", artistValue);
      if (playerAction != null) params.putString("playerAction", playerAction);
      VoiceEvent.send(reactContext, params);
      VoiceDebugLog.append(context, "已发JS", "指令已通过 voice-command 事件交给 JS 处理");
      return;
    }
    // RN 未就绪：拉起 App，指令已存 pending，App 起来后由 JS 消费执行
    VoiceDebugLog.append(context, "冷启动", "RN 未就绪，拉起 App 并通过 pending 补偿");
    launchApp(context);
  }

  private void launchApp(@NonNull Context context) {
    try {
      Intent launch = new Intent(context, MainActivity.class);
      launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
      context.startActivity(launch);
    } catch (Exception e) {
      Log.w(TAG, "launchApp failed", e);
    }
  }

  private void dispatchKeywordFallback(@NonNull Context context, @Nullable String artist) {
    String singer = trimSinger(artist);
    if (singer != null && !singer.isEmpty()) {
      dispatch(context, TYPE_SEARCH_PLAY, stripPlayPrefix(singer), null, null);
    } else {
      dispatch(context, TYPE_OPEN_APP, null, null, null);
    }
  }

  @Nullable
  private ReactContext getReactContext(@NonNull Context context) {
    try {
      MainApplication app = (MainApplication) context.getApplicationContext();
      ReactInstanceManager rim = app.getReactNativeHost().getReactInstanceManager();
      return rim == null ? null : rim.getCurrentReactContext();
    } catch (Exception e) {
      return null;
    }
  }

  @Nullable
  private String extractQuery(@Nullable Bundle extras) {
    if (extras == null) return null;
    String[] candidates = {
            "keyword", "query", "songname", "songName", "song", "name",
            "value", "content", "key", "search", "title", "word", "searchKey"
    };
    for (String key : candidates) {
      if (extras.containsKey(key)) {
        Object v = extras.get(key);
        if (v != null) {
          String s = v.toString().trim();
          if (!s.isEmpty()) return stripPlayPrefix(s);
        }
      }
    }
    for (String key : extras.keySet()) {
      if (isSystemExtra(key)) continue;
      Object v = extras.get(key);
      if (v instanceof String) {
        String s = ((String) v).trim();
        if (!s.isEmpty() && !isSystemValue(s)) {
          return stripPlayPrefix(s);
        }
      }
    }
    return null;
  }

  private boolean isSystemExtra(String key) {
    return "android.intent.extra.TEXT".equals(key) || key.startsWith("android.");
  }

  private boolean isSystemValue(String s) {
    return s.startsWith("cn.kuwo") || s.startsWith("com.kuwo") || s.startsWith("http");
  }

  @Nullable
  private String extractSinger(@Nullable Bundle extras) {
    if (extras == null) return null;
    String[] candidates = {
            "singer", "singerName", "singername", "singer_name", "singers",
            "artist", "artistName", "artist_name", "artists",
            "albumArtist", "album_artist"
    };
    for (String key : candidates) {
      if (extras.containsKey(key)) {
        Object v = extras.get(key);
        if (v != null) {
          String s = v.toString().trim();
          if (!s.isEmpty()) return s;
        }
      }
    }
    return null;
  }

  private String stripPlayPrefix(String raw) {
    String s = raw.trim();
    String[] prefixes = {"播放", "来一首", "来首", "放一首", "放首", "播放一下", "给我播放", "想听", "我想听", "听听", "来听"};
    for (String p : prefixes) {
      if (s.startsWith(p)) {
        return s.substring(p.length()).trim();
      }
    }
    String[] enPrefixes = {"play ", "play:", "song ", "search "};
    for (String p : enPrefixes) {
      if (s.toLowerCase().startsWith(p)) {
        return s.substring(p.length()).trim();
      }
    }
    return s;
  }

  @Nullable
  private String trimSinger(@Nullable String artist) {
    if (artist == null) return null;
    String s = artist.trim();
    return s.isEmpty() ? null : s;
  }

  private String truncate(@NonNull String s, int max) {
    return s.length() > max ? s.substring(0, max) : s;
  }

  private void showToast(@NonNull final Context context, @NonNull final String msg) {
    try {
      new Handler(Looper.getMainLooper()).post(() ->
              Toast.makeText(context.getApplicationContext(), msg, Toast.LENGTH_LONG).show());
    } catch (Exception e) {
      Log.w(TAG, "toast failed", e);
    }
  }
}
