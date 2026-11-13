package com.theshadowhook.app;

import android.widget.RemoteViews;
import org.json.JSONObject;

/* The call: where the board is predicted to stop */
public class ShkCallWidget extends ShkFeedWidget {
    @Override protected int layout() { return R.layout.shk_widget_call; }

    @Override protected void fill(RemoteViews v, JSONObject f) {
        JSONObject c = f.optJSONObject("call");
        v.setTextViewText(R.id.shk_label, "THE CALL \u00B7 " + str(c, "label").toUpperCase());
        v.setTextViewText(R.id.shk_big, str(c, "stop"));
        String range = (c != null && !c.isNull("lo") && !c.isNull("hi")) ? c.optString("lo") + "\u2013" + c.optString("hi") : "\u2014";
        v.setTextViewText(R.id.shk_sub, range + " \u00B7 ~" + (c == null ? 0 : c.optInt("letters", 0)) + " letters");
        v.setTextViewText(R.id.shk_line, "Started " + str(c, "start"));
    }
}
