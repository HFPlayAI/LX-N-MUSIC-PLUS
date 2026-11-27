package cn.toside.music.mobile.voice;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;

import androidx.annotation.Nullable;

public class VoiceRelayActivity extends Activity {

  @Override
  protected void onCreate(@Nullable Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    // 主题是 Theme.NoDisplay：必须在 onCreate 内 finish，否则系统会抛
    // "Activity did not call finish() prior to onResume()"，所以放在 finally 里兜底。
    try {
      Intent intent = getIntent();
      if (intent != null) new VoiceReceiver().onReceive(this, intent);
    } catch (Exception ignored) {
    } finally {
      finish();
    }
  }

  @Override
  public void finish() {
    super.finish();
    overridePendingTransition(0, 0);
  }
}
