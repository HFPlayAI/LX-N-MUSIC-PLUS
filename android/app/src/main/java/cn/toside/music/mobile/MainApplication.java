package cn.toside.music.mobile;

import com.facebook.react.PackageList;
import com.facebook.react.flipper.ReactNativeFlipper;
import com.reactnativenavigation.NavigationApplication;
import com.facebook.react.ReactNativeHost;
import com.facebook.react.ReactPackage;
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint;
import com.reactnativenavigation.react.NavigationReactNativeHost;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Handler;
import android.os.Looper;
import java.util.List;

import cn.toside.music.mobile.cache.CachePackage;
import cn.toside.music.mobile.crypto.CryptoPackage;
import cn.toside.music.mobile.lyric.LyricPackage;
import cn.toside.music.mobile.userApi.UserApiPackage;
import cn.toside.music.mobile.utils.UtilsPackage;
import cn.toside.music.mobile.voice.VoicePackage;
import cn.toside.music.mobile.voice.VoiceRegistrar;
import cn.toside.music.mobile.voice.VoiceWakeReceiver;

public class MainApplication extends NavigationApplication {

  private final ReactNativeHost mReactNativeHost =
      new NavigationReactNativeHost(this) {
        @Override
        public boolean getUseDeveloperSupport() {
          return BuildConfig.DEBUG;
        }

        @Override
        protected List<ReactPackage> getPackages() {
          @SuppressWarnings("UnnecessaryLocalVariable")
          List<ReactPackage> packages = new PackageList(this).getPackages();
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // packages.add(new MyReactNativePackage());
          packages.add(new CachePackage());
          packages.add(new LyricPackage());
          packages.add(new UtilsPackage());
          packages.add(new CryptoPackage());
          packages.add(new UserApiPackage());
          packages.add(new VoicePackage());
          return packages;
        }

        @Override
        protected String getJSMainModuleName() {
          return "index";
        }

        @Override
        protected boolean isNewArchEnabled() {
          return BuildConfig.IS_NEW_ARCHITECTURE_ENABLED;
        }

        @Override
        protected Boolean isHermesEnabled() {
          return BuildConfig.IS_HERMES_ENABLED;
        }
      };

  @Override
  public ReactNativeHost getReactNativeHost() {
    return mReactNativeHost;
  }

  @Override
  public void onCreate() {
    super.onCreate();

    // 比亚迪小迪 / 车机语音：注册为音乐类应用，并定时维持注册状态
    VoiceRegistrar.register(this);
    IntentFilter wakeFilter = new IntentFilter();
    wakeFilter.addAction(Intent.ACTION_SCREEN_ON);
    wakeFilter.addAction(Intent.ACTION_USER_PRESENT);
    registerReceiver(new VoiceWakeReceiver(), wakeFilter);
    final Handler voiceHandler = new Handler(Looper.getMainLooper());
    voiceHandler.postDelayed(new Runnable() {
      @Override
      public void run() {
        VoiceRegistrar.register(MainApplication.this);
        voiceHandler.postDelayed(this, 5 * 60 * 1000);
      }
    }, 5 * 60 * 1000);

    if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
      // If you opted-in for the New Architecture, we load the native entry point for this app.
      DefaultNewArchitectureEntryPoint.load();
    }
    ReactNativeFlipper.initializeFlipper(this, getReactNativeHost().getReactInstanceManager());
  }
}
