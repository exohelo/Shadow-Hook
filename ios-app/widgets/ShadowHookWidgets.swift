// Shadow Hook — widgets (Home Screen, Lock Screen, StandBy).
// One widget, "The Board": how far the board is from your card. The member types their dispatch # once in the
// widget's settings (long-press the widget > Edit Widget). Data comes from the read-only board-now feed.
import WidgetKit
import SwiftUI
import AppIntents
import ActivityKit

// MARK: - Settings (long-press > Edit Widget)

enum PortChoice: String, AppEnum {
    case lalb
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Port"
    static let caseDisplayRepresentations: [PortChoice: DisplayRepresentation] = [
        .lalb: "LA / Long Beach"
    ]
}

struct BoardConfigIntent: WidgetConfigurationIntent {
    static let title: LocalizedStringResource = "Your card"
    static let description = IntentDescription("Enter your dispatch number to see how far the board is from you.")

    @Parameter(title: "Dispatch #", default: "")
    var card: String

    @Parameter(title: "Port", default: .lalb)
    var port: PortChoice
}

// MARK: - Data

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

struct BoardEntry: TimelineEntry {
    let date: Date
    let card: String
    let board: BoardNow?

    static let sample = BoardEntry(
        date: Date(),
        card: "M4207",
        board: BoardNow(ok: true, shift: "Wed PM", start: "X4903", end: "C4288", next: "C4289",
                        letters_out: 10, passed: false, line: "M4207 is 10 letters out")
    )
}

func loadBoard(_ cfg: BoardConfigIntent) async -> BoardEntry {
    let card = cfg.card.trimmingCharacters(in: .whitespacesAndNewlines).uppercased()
    var board: BoardNow? = nil
    var comps = URLComponents(string: "https://ehykqebzkbelwtkgjbml.supabase.co/functions/v1/board-now")
    comps?.queryItems = [
        URLQueryItem(name: "port", value: cfg.port.rawValue),
        URLQueryItem(name: "card", value: card)
    ]
    if let url = comps?.url {
        var req = URLRequest(url: url)
        req.timeoutInterval = 12
        if let result = try? await URLSession.shared.data(for: req) {
            board = try? JSONDecoder().decode(BoardNow.self, from: result.0)
        }
    }
    return BoardEntry(date: Date(), card: card, board: board)
}

struct BoardProvider: AppIntentTimelineProvider {
    func placeholder(in context: Context) -> BoardEntry { BoardEntry.sample }

    func snapshot(for configuration: BoardConfigIntent, in context: Context) async -> BoardEntry {
        if context.isPreview { return BoardEntry.sample }
        return await loadBoard(configuration)
    }

    func timeline(for configuration: BoardConfigIntent, in context: Context) async -> Timeline<BoardEntry> {
        let entry = await loadBoard(configuration)
        // iOS decides the real pace; ask for a fresh look every 15 minutes
        return Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60)))
    }
}

// MARK: - Look

private let plate = Color(red: 0.043, green: 0.051, blue: 0.059)
private let copper = Color(red: 0.933, green: 0.706, blue: 0.420)
private let bone = Color(red: 0.914, green: 0.894, blue: 0.855)
private let steel = Color(red: 0.604, green: 0.639, blue: 0.678)

struct BoardWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: BoardEntry

    private var hasCard: Bool { !entry.card.isEmpty && entry.board?.letters_out != nil }
    private var passed: Bool { entry.board?.passed ?? false }
    private var out: Int { entry.board?.letters_out ?? 0 }
    private var nextCard: String { entry.board?.next ?? "—" }
    private var endCard: String { entry.board?.end ?? "—" }
    private var shift: String { entry.board?.shift ?? "" }

    private var bigText: String {
        if entry.board == nil { return "—" }
        if !hasCard { return nextCard }
        if passed { return "✓" }
        return String(out)
    }
    private var caption: String {
        if entry.board == nil { return "No signal" }
        if !hasCard { return "Next opens" }
        if passed { return "Passed you" }
        if out == 0 { return "Your letter" }
        return out == 1 ? "Letter out" : "Letters out"
    }

    var body: some View {
        Group {
            switch family {
            case .accessoryCircular: circular
            case .accessoryRectangular: rectangular
            case .accessoryInline: inline
            case .systemMedium: medium
            default: small
            }
        }
        .containerBackground(for: .widget) { plate }
    }

    private var circular: some View {
        ZStack {
            AccessoryWidgetBackground()
            VStack(spacing: 0) {
                Text(hasCard ? bigText : "⚓")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .minimumScaleFactor(0.5)
                Text(hasCard ? "OUT" : "SET #")
                    .font(.system(size: 8, weight: .semibold))
            }
        }
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            Text("⚓ The Board").font(.system(size: 12, weight: .semibold))
            Text(hasCard ? (entry.board?.line ?? caption) : "Next opens \(nextCard)")
                .font(.system(size: 14, weight: .bold))
                .minimumScaleFactor(0.7)
                .lineLimit(1)
            Text(hasCard ? "Next opens \(nextCard)" : "Edit widget to add your #")
                .font(.system(size: 11))
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var inline: some View {
        Text(hasCard ? "⚓ \(entry.board?.line ?? caption)" : "⚓ Next opens \(nextCard)")
    }

    private var small: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("THE BOARD")
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(steel)
            Spacer(minLength: 0)
            Text(bigText)
                .font(.system(size: hasCard ? 54 : 30, weight: .heavy, design: .rounded))
                .foregroundStyle(copper)
                .minimumScaleFactor(0.5)
                .lineLimit(1)
            Text(caption.uppercased())
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(bone)
            Text(hasCard ? "Next opens \(nextCard)" : "Edit widget to add your #")
                .font(.system(size: 11))
                .foregroundStyle(steel)
                .lineLimit(1)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private var medium: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 2) {
                Text("THE BOARD")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(steel)
                Text(bigText)
                    .font(.system(size: hasCard ? 56 : 32, weight: .heavy, design: .rounded))
                    .foregroundStyle(copper)
                    .minimumScaleFactor(0.5)
                    .lineLimit(1)
                Text(caption.uppercased())
                    .font(.system(size: 12, weight: .bold))
                    .foregroundStyle(bone)
            }
            VStack(alignment: .leading, spacing: 6) {
                row("Last board", shift.isEmpty ? "—" : shift)
                row("Ended at", endCard)
                row("Next opens", nextCard)
                if hasCard { row("Your card", entry.card) }
                else {
                    Text("Edit widget to add your #")
                        .font(.system(size: 11))
                        .foregroundStyle(steel)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
    }

    private func row(_ label: String, _ value: String) -> some View {
        HStack(spacing: 6) {
            Text(label).font(.system(size: 11)).foregroundStyle(steel)
            Spacer(minLength: 0)
            Text(value).font(.system(size: 13, weight: .semibold, design: .monospaced)).foregroundStyle(bone)
        }
    }
}

// MARK: - Live Activity (Lock Screen, Dynamic Island, Apple Watch Smart Stack)

// The same definition lives in the app (native/ShadowHookNative.swift). Keep the two in step.
struct BoardActivityAttributes: ActivityAttributes {
    public struct ContentState: Codable, Hashable {
        var pos: String
        var out: Int
        var line: String
        var passed: Bool
    }
    var card: String
}

struct BoardLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: BoardActivityAttributes.self) { context in
            HStack(spacing: 14) {
                VStack(alignment: .leading, spacing: 3) {
                    Text("⚓ THE BOARD")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundStyle(steel)
                    Text(context.state.line)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(bone)
                        .lineLimit(2)
                        .minimumScaleFactor(0.8)
                    Text("Board at \(context.state.pos) · your card \(context.attributes.card)")
                        .font(.system(size: 12))
                        .foregroundStyle(steel)
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                VStack(spacing: 0) {
                    Text(context.state.passed ? "✓" : String(context.state.out))
                        .font(.system(size: 40, weight: .heavy, design: .rounded))
                        .foregroundStyle(copper)
                    Text(context.state.passed ? "PASSED" : "OUT")
                        .font(.system(size: 10, weight: .bold))
                        .foregroundStyle(steel)
                }
            }
            .padding(16)
            .activityBackgroundTint(plate)
            .activitySystemActionForegroundColor(bone)
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text("⚓ \(context.state.pos)")
                        .font(.system(size: 15, weight: .semibold))
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(context.state.passed ? "✓" : "\(context.state.out) out")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(copper)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.state.line)
                        .font(.system(size: 14))
                        .lineLimit(2)
                }
            } compactLeading: {
                Text("⚓")
            } compactTrailing: {
                Text(context.state.passed ? "✓" : String(context.state.out))
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(copper)
            } minimal: {
                Text(context.state.passed ? "✓" : String(context.state.out))
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(copper)
            }
        }
    }
}

// MARK: - Widget

struct BoardWidget: Widget {
    var body: some WidgetConfiguration {
        AppIntentConfiguration(kind: "BoardWidget", intent: BoardConfigIntent.self, provider: BoardProvider()) { entry in
            BoardWidgetView(entry: entry)
        }
        .configurationDisplayName("The Board")
        .description("How far the board is from your card, and where the next one opens.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}

@main
struct ShadowHookWidgets: WidgetBundle {
    var body: some Widget {
        BoardWidget()
        BoardLiveActivity()
    }
}
