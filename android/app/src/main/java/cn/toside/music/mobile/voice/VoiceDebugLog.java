package cn.toside.music.mobile.voice;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * 车机语音调试日志：把每条广播的到达、解析、分派以及注册/上报结果写进
 * SharedPreferences 的环形缓冲（最多 30 条），供 App 内设置页直接查看。
 * 车机上没法接 logcat，这个缓冲是定位"语音指令到底有没有到、被解析成什么"的关键手段。
 */
public final class VoiceDebugLog {
  private static final String PREF_NAME = "voice_debug";
  private static final String KEY_LOGS = "logs";
  private static final String KEY_REGISTERED_AT = "registered_at";
  private static final int MAX_LOGS = 30;

  private VoiceDebugLog() {}

  private static SharedPreferences prefs(Context context) {
    return context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
  }

  /** 追加一条日志，超出上限时丢弃最旧的 */
  public static synchronized void append(Context context, String tag, String msg) {
    if (context == null) return;
    try {
      SharedPreferences p = prefs(context);
      JSONArray arr;
      String raw = p.getString(KEY_LOGS, null);
      try {
        arr = raw == null ? new JSONArray() : new JSONArray(raw);
      } catch (Exception e) {
        arr = new JSONArray();
      }
      JSONObject item = new JSONObject();
      item.put("t", new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date()));
      item.put("tag", tag == null ? "" : tag);
      item.put("msg", msg == null ? "" : msg);
      arr.put(item);
      while (arr.length() > MAX_LOGS) arr.remove(0);
      p.edit().putString(KEY_LOGS, arr.toString()).apply();
    } catch (Exception ignored) {
    }
  }

  /** 记录一次成功注册的时间戳 */
  public static synchronized void markRegistered(Context context) {
    if (context == null) return;
    try {
      long at = System.currentTimeMillis();
      prefs(context).edit().putLong(KEY_REGISTERED_AT, at).apply();
      append(context, "注册", "已向小迪注册 MUSIC 应用");
    } catch (Exception ignored) {
    }
  }

  /** 读取全部日志（JSON 数组字符串），供 JS 侧解析展示 */
  public static synchronized String getLogs(Context context) {
    if (context == null) return "[]";
    String raw = prefs(context).getString(KEY_LOGS, null);
    return raw == null ? "[]" : raw;
  }

  /** 最近一次注册时间戳，0 表示从未注册成功 */
  public static synchronized long getRegisteredAt(Context context) {
    if (context == null) return 0L;
    return prefs(context).getLong(KEY_REGISTERED_AT, 0L);
  }

  /** 清空日志（保留注册时间） */
  public static synchronized void clear(Context context) {
    if (context == null) return;
    prefs(context).edit().remove(KEY_LOGS).apply();
  }
}
