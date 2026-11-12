// Shadow Hook — native glue inside the iPhone app (added to the App target by scripts/add_widgets.rb).
//  1. Remembers this phone's Apple push address when Capacitor's push plugin registers.
//  2. Live Activity plumbing: tells the server the addresses it needs to start ("start") and update ("update")
//     the board card on the Lock Screen / Dynamic Island, and when a card was ended.
import UIKit
import Capacitor
import ActivityKit

// The same definition lives in the widget extension (widgets/ShadowHookWidgets.swift). Keep the two in step.
@available(iOS 16.2, *)
struct BoardActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var pos: String
        var out: Int
        var line: String
        var passed: Bool
    }
    var card: String
}

enum ShadowHookNative {
    private static let tokenKey = "shk_apns_device"
    private static let feed = "https://ehykqebzkbelwtkgjbml.supabase.co/functions/v1/la-token"
    private static var started = false
    private static var deviceToken = ""
    private static var pending: [[String: String]] = []

    static func start() {
        if started { return }
        started = true
        deviceToken = UserDefaults.standard.string(forKey: tokenKey) ?? ""
        NotificationCenter.default.addObserver(forName: .capacitorDidRegisterForRemoteNotifications, object: nil, queue: .main) { note in
            guard let data = note.object as? Data else { return }
            deviceToken = hex(data)
            UserDefaults.standard.set(deviceToken, forKey: tokenKey)
            flush()
        }
        if #available(iOS 17.2, *) {
            LiveBoard.watch()
        }
    }

    static func hex(_ data: Data) -> String {
        return data.map { String(format: "%02x", $0) }.joined()
    }

    static func send(_ fields: [String: String]) {
        DispatchQueue.main.async {
            pending.append(fields)
            flush()
        }
    }

    private static func flush() {
        if deviceToken.isEmpty || pending.isEmpty { return }
        let items = pending
        pending = []
        guard let url = URL(string: feed) else { return }
        for item in items {
            var body = item
            body["device"] = deviceToken
            guard let data = try? JSONSerialization.data(withJSONObject: body) else { continue }
            var req = URLRequest(url: url)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = data
            URLSession.shared.dataTask(with: req).resume()
        }
    }
}

@available(iOS 17.2, *)
enum LiveBoard {
    static func watch() {
        Task {
            for await token in Activity<BoardActivityAttributes>.pushToStartTokenUpdates {
                ShadowHookNative.send(["start": ShadowHookNative.hex(token)])
            }
        }
        Task {
            for await activity in Activity<BoardActivityAttributes>.activityUpdates {
                follow(activity)
            }
        }
        for activity in Activity<BoardActivityAttributes>.activities {
            follow(activity)
        }
    }

    private static func follow(_ activity: Activity<BoardActivityAttributes>) {
        Task {
            for await token in activity.pushTokenUpdates {
                ShadowHookNative.send(["update": ShadowHookNative.hex(token), "activity": activity.id])
            }
        }
        Task {
            for await state in activity.activityStateUpdates {
                if state == .ended || state == .dismissed {
                    ShadowHookNative.send(["ended": activity.id])
                }
            }
        }
    }
}
