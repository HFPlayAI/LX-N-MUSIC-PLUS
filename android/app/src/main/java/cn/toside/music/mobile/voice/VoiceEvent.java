package cn.toside.music.mobile.voice;

import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

public class VoiceEvent {
  public static final String EVENT_NAME = "voice-command";

  private VoiceEvent() {}

  public static void send(ReactContext reactContext, @Nullable WritableMap params) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
      .emit(EVENT_NAME, params);
  }
}
