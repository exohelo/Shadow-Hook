package com.theshadowhook.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import org.json.JSONObject;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.NumberFormat;
import java.util.Locale;

/* nov13: Android home-screen widgets. One read-only feed (widget-feed), shared with the iPhone widgets.
   Android refreshes them about every 30 minutes; tapping any widget opens the app. */
public abstract class ShkFeedWidget extends AppWidgetProvider {
    static final String FEED = "https://ehykqebzkbelwtkgjbml.supabase.co/functions/v1/widget-feed?port=lalb";

    protected abstract int layout();
    protected abstract void fill(RemoteViews v, JSONObject feed);

    @Override
    public void onUpdate(Context ctx, final AppWidgetManager mgr, final int[] ids) {
        final PendingResult pr = goAsync();
        final Context app = ctx.getApplicationContext();
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    JSONObject f = fetch();
                    for (int id : ids) {
                        RemoteViews v = new RemoteViews(app.getPackageName(), layout());
                        if (f != null) fill(v, f);
                        v.setOnClickPendingIntent(R.id.shk_root, openApp(app));
                        mgr.updateAppWidget(id, v);
                    }
                } catch (Exception e) {
                    // keep whatever the widget showed last
                } finally {
                    pr.finish();
                }
            }
        }).start();
    }

    static PendingIntent openApp(Context c) {
        Intent i = new Intent(c, MainActivity.class);
        i.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, 0, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static JSONObject fetch() {
        HttpURLConnection c = null;
        try {
            c = (HttpURLConnection) new URL(FEED).openConnection();
            c.setConnectTimeout(10000);
            c.setReadTimeout(10000);
            BufferedReader r = new BufferedReader(new InputStreamReader(c.getInputStream(), "UTF-8"));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = r.readLine()) != null) sb.append(line);
            r.close();
            return new JSONObject(sb.toString());
        } catch (Exception e) {
            return null;
        } finally {
            if (c != null) c.disconnect();
        }
    }

    static String num(JSONObject o, String k) {
        if (o == null || o.isNull(k) || !o.has(k)) return "\u2014";
        return NumberFormat.getIntegerInstance(Locale.US).format(o.optLong(k, 0));
    }

    static String str(JSONObject o, String k) {
        if (o == null || o.isNull(k) || !o.has(k)) return "\u2014";
        String s = o.optString(k, "");
        return s.isEmpty() ? "\u2014" : s;
    }
}
