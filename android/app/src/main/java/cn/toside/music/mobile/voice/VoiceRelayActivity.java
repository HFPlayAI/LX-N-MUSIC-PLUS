package cn.toside.music.mobile.voice;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

import androidx.annotation.Nullable;

public class VoiceRelayActivity extends Activity {

  @Override
  protected void onCreate(@Nullable Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    Intent intent = getIntent();
    if (intent != null) {
      try {
        new VoiceReceiver().onReceive(this, intent);
      } catch (Exception ignored) {
      }
    }
    finish();
  }

  @Override
  public void finish() {
    super.finish();
    overridePendingTransition(0, 0);
  }
}
