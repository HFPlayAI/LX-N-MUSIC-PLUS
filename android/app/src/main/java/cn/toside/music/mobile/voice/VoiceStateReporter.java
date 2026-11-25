package cn.toside.music.mobile.voice;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

public final class VoiceStateReporter {
  private static final String TAG = "VoiceState";
  private static final String ACTION_NOTIFY = "com.byd.action.NOTIFY_AUTOVOICE_CURRENT_STATE";
  private static final String PKG_AUTOVOICE = "com.byd.autovoice";

  private static String sLastKey;

  private VoiceStateReporter() {}

  public static void report(Context context, boolean playing, String title, String artist) {
    if (context == null || title == null || title.isEmpty()) return;
    String name = artist == null ? "" : artist;
    String key = (playing ? "play" : "pause") + "|" + title + "|" + name;
    if (key.equals(sLastKey)) return;
    sLastKey = key;
    try {
      Intent intent = new Intent(ACTION_NOTIFY);
      intent.setPackage(PKG_AUTOVOICE);
      intent.putExtra("EXTRA_PACKAGE_NAME", context.getPackageName());
      intent.putExtra("EXTRA_PALY_STATE", playing ? 1 : 0);
      intent.putExtra("EXTRA_PROGRAM_NAME", title);
      intent.putExtra("EXTRA_PROGRAM_TAGS", name);
      intent.putExtra("EXTRA_APPLICATION_TYPE", 1);
      context.sendBroadcast(intent);
      Log.d(TAG, "reported: " + key);
    } catch (Exception e) {
      Log.w(TAG, "report failed", e);
    }
  }
}