package cn.toside.music.mobile.voice;

import android.content.Context;
import android.content.SharedPreferences;

public final class VoiceSettings {
  private static final String PREF_NAME = "voice_settings";
  private static final String KEY_TIP_ENABLED = "tip_enabled";

  private VoiceSettings() {}

  public static boolean isTipEnabled(Context context) {
    if (context == null) return true;
    return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        .getBoolean(KEY_TIP_ENABLED, true);
  }

  public static void setTipEnabled(Context context, boolean enabled) {
    if (context == null) return;
    context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)
        .edit().putBoolean(KEY_TIP_ENABLED, enabled).apply();
  }
}