package com.theshadowhook.app;

import android.widget.RemoteViews;
import org.json.JSONObject;

/* Board dashboard: jobs down, the board, the call, the waves and the last board, all at once */
public class ShkBoardWidget extends ShkFeedWidget {
    @Override protected int layout() { return R.layout.shk_widget_board; }

    @Override protected void fill(RemoteViews v, JSONObject f) {
        JSONObject s = f.optJSONObject("shift"), c = f.optJSONObject("call"), l = f.optJSONObject("last");
        boolean on = s != null && s.optBoolean("on_air", false);
        v.setTextViewText(R.id.shk_label, (on ? "\u25CF ON AIR \u00B7 " : "THE BOARD \u00B7 ") + str(s, "label").toUpperCase());
        v.setTextViewText(R.id.shk_jobs, num(s, "jobs_down"));
        v.setTextViewText(R.id.shk_board, str(s, "board_on"));
        v.setTextViewText(R.id.shk_call, str(c, "stop"));
        JSONObject w = s == null ? null : s.optJSONObject("waves");
        v.setTextViewText(R.id.shk_waves, "FLEX " + num(w, "flex") + "   1ST " + num(w, "first") + "   2ND " + num(w, "second"));
        String last = l == null ? "\u2014" : str(l, "label").toUpperCase() + "  " + str(l, "start") + " \u2192 " + str(l, "end")
                + (l.isNull("moved") ? "" : " \u00B7 " + l.optInt("moved") + " letters");
        v.setTextViewText(R.id.shk_last, "LAST \u00B7 " + last);
    }
}
