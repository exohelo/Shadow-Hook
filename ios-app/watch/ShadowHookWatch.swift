// Shadow Hook — Apple Watch. One file, two targets (see scripts/add_widgets.rb):
//   · the watch app  (compiled with SHK_WATCH_APP): shows the board and is where the member enters their dispatch #
//   · the watch widget extension: watch-face complications ("letters out")
// The card is kept in a keychain group both targets can read. Data comes from the read-only board-now feed.
import SwiftUI
import WidgetKit
import Security

// MARK: - Shared

enum CardStore {
    static var group: String {
        return (Bundle.main.object(forInfoDictionaryKey: "ShkKeychainGroup") as? String) ?? ""
    }

    private static func base() -> [String: Any] {
        var q: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: "shadowhook.card",
            kSecAttrAccount as String: "card"
        ]
        if !group.isEmpty { q[kSecAttrAccessGroup as String] = group }
        return q
    }

    static func load() -> String {
        var q = base()
        q[kSecReturnData as String] = true
        q[kSecMatchLimit as String] = kSecMatchLimitOne
        var out: AnyObject?
        guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }

    static func save(_ card: String) {
        SecItemDelete(base() as CFDictionary)
        var q = base()
        q[kSecValueData as String] = Data(card.utf8)
        q[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        SecItemAdd(q as CFDictionary, nil)
    }
}

struct BoardNow: Codable {
    var ok: Bool?
    var shift: String?
    var start: String?
    var end: String?
    var next: String?
    var letters_out: Int?
    var passed: Bool?
    var line: String?
}

func fetchBoard(card: String) async -> BoardNow? {
    var comps = URLComponents(string: "https://ehykqebzkbelwtkgjbml.supabase.co/functions/v1/board-now")
    comps?.queryItems = [
        URLQueryItem(name: "port", value: "lalb"),
        URLQueryItem(name: "card", value: card)
    ]
    guard let url = comps?.url else { return nil }
    var req = URLRequest(url: url)
    req.timeoutInterval = 12
    guard let result = try? await URLSession.shared.data(for: req) else { return nil }
    return try? JSONDecoder().decode(BoardNow.self, from: result.0)
}

func bigText(_ board: BoardNow?, card: String) -> String {
    guard let b = board else { return "—" }
    if card.isEmpty || b.letters_out == nil { return b.next ?? "—" }
    if b.passed ?? false { return "✓" }
    return String(b.letters_out ?? 0)
}

let shkCopper = Color(red: 0.933, green: 0.706, blue: 0.420)

#if SHK_WATCH_APP

// MARK: - Watch app

@main
struct ShadowHookWatchApp: App {
    var body: some Scene {
        WindowGroup {
            WatchHome()
        }
    }
}

struct WatchHome: View {
    @State private var card: String = CardStore.load()
    @State private var draft: String = ""
    @State private var board: BoardNow? = nil
    @State private var loading: Bool = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 8) {
                Text("⚓ THE BOARD")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                if let b = board {
                    Text(bigText(b, card: card))
                        .font(.system(size: 40, weight: .heavy, design: .rounded))
                        .foregroundStyle(shkCopper)
                        .minimumScaleFactor(0.5)
                        .lineLimit(1)
                    Text(b.line ?? "")
                        .font(.footnote)
                    Text("Next opens \(b.next ?? "—")")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                } else {
                    Text(loading ? "Checking…" : "No signal")
                        .font(.footnote)
                }
                Divider()
                Text(card.isEmpty ? "Add your dispatch #" : "Your card: \(card)")
                    .font(.caption2)
                TextField("e.g. M4207", text: $draft)
                Button("Save card") { saveCard() }
                    .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                Button("Refresh") { Task { await refresh() } }
            }
            .padding(.horizontal, 4)
        }
        .task { await refresh() }
    }

    private func saveCard() {
        let clean = draft.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
        if clean.isEmpty { return }
        CardStore.save(clean)
        card = clean
        draft = ""
        WidgetCenter.shared.reloadAllTimelines()
        Task { await refresh() }
    }

    private func refresh() async {
        loading = true
        let b = await fetchBoard(card: card)
        board = b
        loading = false
    }
}

#else

// MARK: - Watch-face complications

struct WatchEntry: TimelineEntry {
    let date: Date
    let card: String
    let board: BoardNow?

    static let sample = WatchEntry(
        date: Date(),
        card: "M4207",
        board: BoardNow(ok: true, shift: "Wed PM", start: "X4903", end: "C4288", next: "C4289",
                        letters_out: 10, passed: false, line: "M4207 is 10 letters out")
    )
}

struct WatchProvider: TimelineProvider {
    func placeholder(in context: Context) -> WatchEntry { WatchEntry.sample }

    func getSnapshot(in context: Context, completion: @escaping (WatchEntry) -> Void) {
        if context.isPreview {
            completion(WatchEntry.sample)
            return
        }
        Task {
            let card = CardStore.load()
            let board = await fetchBoard(card: card)
            completion(WatchEntry(date: Date(), card: card, board: board))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<WatchEntry>) -> Void) {
        Task {
            let card = CardStore.load()
            let board = await fetchBoard(card: card)
            let entry = WatchEntry(date: Date(), card: card, board: board)
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60))))
        }
    }
}

struct WatchComplicationView: View {
    @Environment(\.widgetFamily) private var family
    let entry: WatchEntry

    private var hasCard: Bool { !entry.card.isEmpty && entry.board?.letters_out != nil }
    private var big: String { bigText(entry.board, card: entry.card) }
    private var line: String {
        if hasCard { return entry.board?.line ?? "" }
        return "Next opens \(entry.board?.next ?? "—")"
    }

    var body: some View {
        Group {
            switch family {
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text("⚓ The Board").font(.system(size: 12, weight: .semibold))
                    Text(line).font(.system(size: 14, weight: .bold)).minimumScaleFactor(0.7).lineLimit(1)
                    Text(hasCard ? "Next opens \(entry.board?.next ?? "—")" : "Open the app to add your #")
                        .font(.system(size: 11)).lineLimit(1)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            case .accessoryInline:
                Text("⚓ \(line)")
            case .accessoryCorner:
                Text(hasCard ? big : "⚓")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .widgetLabel(hasCard ? "letters out" : "set your #")
            default:
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: 0) {
                        Text(hasCard ? big : "⚓")
                            .font(.system(size: 20, weight: .bold, design: .rounded))
                            .minimumScaleFactor(0.5)
                        Text(hasCard ? "OUT" : "SET #")
                            .font(.system(size: 8, weight: .semibold))
                    }
                }
            }
        }
        .containerBackground(.clear, for: .widget)
    }
}

struct BoardComplication: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "BoardComplication", provider: WatchProvider()) { entry in
            WatchComplicationView(entry: entry)
        }
        .configurationDisplayName("The Board")
        .description("How far the board is from your card.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
    }
}

@main
struct ShadowHookWatchWidgets: WidgetBundle {
    var body: some Widget {
        BoardComplication()
    }
}

#endif
