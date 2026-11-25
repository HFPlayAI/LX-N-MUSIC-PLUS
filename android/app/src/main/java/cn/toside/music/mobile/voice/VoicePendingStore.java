package cn.toside.music.mobile.voice;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONObject;

public final class VoicePendingStore {
  private static final String PREF_NAME = "voice_pending";
  private static final String KEY = "command";

  private static String sPending = null;

  private VoicePendingStore() {}

  public static synchronized void save(Context context, String type, String keyword, String artist,
                                       String playerAction) {
    try {
      JSONObject json = new JSONObject();
      json.put("type", type);
      if (keyword != null) json.put("keyword", keyword);
      if (artist != null) json.put("artist", artist);
      if (playerAction != null) json.put("playerAction", playerAction);
      String value = json.toString();
      sPending = value;
      prefs(context).edit().putString(KEY, value).apply();
    } catch (Exception ignored) {
    }
  }

  public static synchronized void clear(Context context) {
    sPending = null;
    prefs(context).edit().remove(KEY).apply();
  }

  public static synchronized String consume(Context context) {
    String value = sPending;
    if (value == null) value = prefs(context).getString(KEY, null);
    sPending = null;
    if (value != null) prefs(context).edit().remove(KEY).apply();
    return value;
  }

  private static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
  }
}