package com.theshadowhook.app;

import android.widget.RemoteViews;
import org.json.JSONObject;

/* Live dispatch: jobs down and where the board is */
public class ShkDispatchWidget extends ShkFeedWidget {
    @Override protected int layout() { return R.layout.shk_widget_dispatch; }

    @Override protected void fill(RemoteViews v, JSONObject f) {
        JSONObject s = f.optJSONObject("shift");
        boolean on = s != null && s.optBoolean("on_air", false);
        v.setTextViewText(R.id.shk_label, (on ? "\u25CF ON AIR \u00B7 " : "LAST \u00B7 ") + str(s, "label").toUpperCase());
        v.setTextViewText(R.id.shk_big, num(s, "jobs_down"));
        JSONObject d = s == null ? null : s.optJSONObject("last_drop");
        v.setTextViewText(R.id.shk_sub, "jobs down" + (d != null && d.optInt("n", 0) > 0 ? " \u00B7 +" + d.optInt("n") : ""));
        v.setTextViewText(R.id.shk_line, "Board on " + str(s, "board_on"));
    }
}
