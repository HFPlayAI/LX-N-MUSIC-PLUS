package cn.toside.music.mobile.voice;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class VoiceWakeReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    VoiceRegistrar.register(context);
  }
}