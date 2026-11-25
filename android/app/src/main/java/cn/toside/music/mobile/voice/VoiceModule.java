package cn.toside.music.mobile.voice;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class VoiceModule extends ReactContextBaseJavaModule {
  public VoiceModule(ReactApplicationContext reactContext) {
    super(reactContext);
  }

  @NonNull
  @Override
  public String getName() {
    return "VoiceModule";
  }

  @ReactMethod
  public void consumePendingCommand(Promise promise) {
    try {
      promise.resolve(VoicePendingStore.consume(getReactApplicationContext()));
    } catch (Exception e) {
      promise.reject(e);
    }
  }

  @ReactMethod
  public void clearPendingCommand() {
    VoicePendingStore.clear(getReactApplicationContext());
  }

  @ReactMethod
  public void reportState(boolean playing, String title, String artist) {
    VoiceStateReporter.report(getReactApplicationContext(), playing, title, artist);
  }

  @ReactMethod
  public void setTipEnabled(boolean enabled) {
    VoiceSettings.setTipEnabled(getReactApplicationContext(), enabled);
  }

  @ReactMethod
  public void getTipEnabled(Promise promise) {
    promise.resolve(VoiceSettings.isTipEnabled(getReactApplicationContext()));
  }

  @ReactMethod
  public void reregisterVoice() {
    VoiceRegistrar.register(getReactApplicationContext());
  }

  /** 调试面板：读取最近 30 条语音日志（JSON 数组字符串） */
  @ReactMethod
  public void getDebugLogs(Promise promise) {
    try {
      promise.resolve(VoiceDebugLog.getLogs(getReactApplicationContext()));
    } catch (Exception e) {
      promise.reject(e);
    }
  }

  /** 调试面板：最近一次向小迪注册的时间戳（0 表示从未成功） */
  @ReactMethod
  public void getRegisteredAt(Promise promise) {
    try {
      promise.resolve(VoiceDebugLog.getRegisteredAt(getReactApplicationContext()));
    } catch (Exception e) {
      promise.reject(e);
    }
  }

  /** 调试面板：清空日志 */
  @ReactMethod
  public void clearDebugLogs() {
    VoiceDebugLog.clear(getReactApplicationContext());
  }

  /** JS 侧把语音指令的执行结果写回调试日志 */
  @ReactMethod
  public void reportDebug(String tag, String msg) {
    VoiceDebugLog.append(getReactApplicationContext(), tag, msg);
  }

  /**
   * 调试面板：发一条测试广播，模拟小迪的语音点歌指令。
   * 走的是和真实车机完全一样的 VoiceReceiver → JS 链路，用来在车机上自检。
   */
  @ReactMethod
  public void sendTestBroadcast(String keyword) {
    try {
      android.content.Intent intent = new android.content.Intent(VoiceReceiver.ACTION_BYD_SEARCH);
      intent.setPackage(getReactApplicationContext().getPackageName());
      intent.putExtra(VoiceReceiver.EXTRA_BYD_KEYWORDS, keyword);
      getReactApplicationContext().sendBroadcast(intent);
      VoiceDebugLog.append(getReactApplicationContext(), "自检", "已发出测试广播: " + keyword);
    } catch (Exception e) {
      VoiceDebugLog.append(getReactApplicationContext(), "自检失败", String.valueOf(e.getMessage()));
    }
  }
}