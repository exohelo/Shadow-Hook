# nov13: register the three Shadow Hook home-screen widgets in the Android app's manifest
import sys
p = sys.argv[1]
s = open(p, encoding="utf-8").read()
if "ShkDispatchWidget" in s:
    print("widgets already registered"); sys.exit(0)
def rec(cls, label, info):
    return ('        <receiver android:name=".%s" android:label="%s" android:exported="false">\n'
            '            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>\n'
            '            <meta-data android:name="android.appwidget.provider" android:resource="@xml/%s" />\n'
            '        </receiver>\n') % (cls, label, info)
block = (rec("ShkDispatchWidget", "Shadow Hook \u00B7 Live dispatch", "shk_dispatch_info")
       + rec("ShkCallWidget", "Shadow Hook \u00B7 The call", "shk_call_info")
       + rec("ShkBoardWidget", "Shadow Hook \u00B7 Board dashboard", "shk_board_info"))
i = s.rfind("</application>")
assert i > 0, "no </application> in manifest"
s = s[:i] + block + "    " + s[i:]
open(p, "w", encoding="utf-8").write(s)
print("registered 3 widgets")
