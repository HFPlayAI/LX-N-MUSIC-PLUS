package cn.toside.music.mobile.voice;

import android.content.Context;
import android.content.Intent;
import android.util.Log;

public final class VoiceRegistrar {
  private static final String TAG = "VoiceRegistrar";
  private static final String ACTION_FUNCTION_UPDATE = "com.byd.action.FUNCTION_UPDATE";
  private static final String PKG_AUTOVOICE = "com.byd.autovoice";
  private static final String CONTROL_SERVICE = "com.guichaguri.trackplayer.service.MusicService";

  private VoiceRegistrar() {}

  public static void register(Context context) {
    if (context == null) return;
    try {
      Intent intent = new Intent(ACTION_FUNCTION_UPDATE);
      intent.setPackage(PKG_AUTOVOICE);
      intent.putExtra("EXTRA_PACKAGE_NAME", context.getPackageName());
      intent.putExtra("EXTRA_APPLICATION_TYPE", "MUSIC");
      intent.putExtra("ISCONTROL", "true");
      intent.putExtra("EXTRA_SERVICE_NAME", context.getPackageName() + "/" + CONTROL_SERVICE);
      context.sendBroadcast(intent);
      Log.d(TAG, "registered: " + context.getPackageName());
      VoiceDebugLog.markRegistered(context);
    } catch (Exception e) {
      Log.w(TAG, "register failed", e);
      VoiceDebugLog.append(context, "注册失败", String.valueOf(e.getMessage()));
    }
  }
}
