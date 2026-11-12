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


// MARK: - Shared dispatch widgets (one feed: widget-feed)
// Live dispatch · The call · What came down · Last board · Board dashboard (iPad / large)

struct FeedWaves: Codable { var flex: Int?; var first: Int?; var second: Int? }
struct FeedDrop: Codable { var n: Int?; var phase: String?; var at: String? }
struct FeedShift: Codable {
    var label: String?; var onAir: Bool?; var jobsDown: Int?; var waves: FeedWaves?
    var lastDrop: FeedDrop?; var boardOn: String?; var next: [String]?
}
struct FeedCall: Codable {
    var label: String?; var start: String?; var stop: String?; var lo: String?; var hi: String?
    var letters: Int?; var locked: Bool?
}
struct FeedLast: Codable {
    var label: String?; var start: String?; var end: String?; var moved: Int?
    var callStop: String?; var miss: Int?; var inRange: Bool?; var pmaTotal: Int?; var hall: Int?
}
struct Feed: Codable { var shift: FeedShift?; var call: FeedCall?; var last: FeedLast? }

struct FeedEntry: TimelineEntry {
    let date: Date
    let feed: Feed?

    static let sample = FeedEntry(date: Date(), feed: Feed(
        shift: FeedShift(label: "Thu AM", onAir: true, jobsDown: 556, waves: FeedWaves(flex: 64, first: 432, second: 60),
                         lastDrop: FeedDrop(n: 3, phase: "2ND", at: nil), boardOn: "L5060", next: ["L5061", "L5062"]),
        call: FeedCall(label: "Thu AM", start: "C4289", stop: "M", lo: "K", hi: "N", letters: 10, locked: true),
        last: FeedLast(label: "Wed PM", start: "X4903", end: "C4288", moved: 5, callStop: "D", miss: -1, inRange: true, pmaTotal: 2245, hall: 974)
    ))
}

func loadFeed() async -> Feed? {
    guard let url = URL(string: "https://ehykqebzkbelwtkgjbml.supabase.co/functions/v1/widget-feed?port=lalb") else { return nil }
    var req = URLRequest(url: url)
    req.timeoutInterval = 12
    guard let result = try? await URLSession.shared.data(for: req) else { return nil }
    let dec = JSONDecoder()
    dec.keyDecodingStrategy = .convertFromSnakeCase
    return try? dec.decode(Feed.self, from: result.0)
}

struct FeedProvider: TimelineProvider {
    func placeholder(in context: Context) -> FeedEntry { FeedEntry.sample }

    func getSnapshot(in context: Context, completion: @escaping (FeedEntry) -> Void) {
        if context.isPreview {
            completion(FeedEntry.sample)
            return
        }
        Task {
            let f = await loadFeed()
            completion(FeedEntry(date: Date(), feed: f))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<FeedEntry>) -> Void) {
        Task {
            let f = await loadFeed()
            // ask for a fresh look sooner while dispatch is on the air; iOS decides the real pace
            let mins: Double = (f?.shift?.onAir ?? false) ? 5 : 15
            completion(Timeline(entries: [FeedEntry(date: Date(), feed: f)], policy: .after(Date().addingTimeInterval(mins * 60))))
        }
    }
}

private let onGreen = Color(red: 0.184, green: 0.561, blue: 0.235)
private let flexRed = Color(red: 0.702, green: 0.125, blue: 0.227)
private let firstNavy = Color(red: 0.106, green: 0.169, blue: 0.361)

private func fmtN(_ n: Int?) -> String {
    guard let n = n else { return "—" }
    let f = NumberFormatter()
    f.numberStyle = .decimal
    return f.string(from: NSNumber(value: n)) ?? String(n)
}

private func dropDate(_ s: String?) -> Date? {
    guard let s = s else { return nil }
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = f.date(from: s) { return d }
    f.formatOptions = [.withInternetDateTime]
    return f.date(from: s)
}

struct FeedLabel: View {
    let text: String
    var live: Bool = false
    var body: some View {
        HStack(spacing: 4) {
            if live { Circle().fill(onGreen).frame(width: 6, height: 6) }
            Text(text).font(.system(size: 11, weight: .bold)).foregroundStyle(steel).lineLimit(1)
        }
    }
}

// --- Live dispatch: jobs down + where the board is
struct DispatchView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FeedEntry
    private var s: FeedShift? { entry.feed?.shift }

    var body: some View {
        Group {
            switch family {
            case .accessoryInline:
                Text("⚓ \(fmtN(s?.jobsDown)) jobs down · board \(s?.boardOn ?? "—")")
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text((s?.onAir ?? false) ? "● ON AIR · \(s?.label ?? "")" : "Last dispatch · \(s?.label ?? "")")
                        .font(.system(size: 12, weight: .semibold))
                    Text("\(fmtN(s?.jobsDown)) jobs down").font(.system(size: 15, weight: .bold))
                    Text("Board on \(s?.boardOn ?? "—")").font(.system(size: 12))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            default:
                VStack(alignment: .leading, spacing: 2) {
                    FeedLabel(text: (s?.onAir ?? false) ? "ON AIR · \(s?.label ?? "")" : "LAST · \(s?.label ?? "")", live: s?.onAir ?? false)
                    Spacer(minLength: 0)
                    Text(fmtN(s?.jobsDown))
                        .font(.system(size: 42, weight: .heavy, design: .rounded))
                        .foregroundStyle(copper).minimumScaleFactor(0.5).lineLimit(1)
                    HStack(spacing: 4) {
                        Text("jobs down").font(.system(size: 12, weight: .semibold)).foregroundStyle(bone)
                        if let n = s?.lastDrop?.n, let d = dropDate(s?.lastDrop?.at) {
                            Text("+\(n) ·").font(.system(size: 11)).foregroundStyle(onGreen)
                            Text(d, style: .relative).font(.system(size: 11)).foregroundStyle(onGreen).lineLimit(1)
                        }
                    }
                    Text("Board on \(s?.boardOn ?? "—")").font(.system(size: 13, weight: .bold)).foregroundStyle(bone)
                    if let nx = s?.next, let first = nx.first {
                        Text("next \(first)").font(.system(size: 11)).foregroundStyle(steel)
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            }
        }
        .containerBackground(for: .widget) { plate }
    }
}

// --- The call: predicted stop and range
struct CallView: View {
    @Environment(\.widgetFamily) private var family
    let entry: FeedEntry
    private var c: FeedCall? { entry.feed?.call }
    private var range: String { (c?.lo != nil && c?.hi != nil) ? "\(c!.lo!)–\(c!.hi!)" : "—" }

    var body: some View {
        Group {
            switch family {
            case .accessoryCircular:
                ZStack {
                    AccessoryWidgetBackground()
                    VStack(spacing: 0) {
                        Text(c?.stop ?? "—").font(.system(size: 22, weight: .bold, design: .rounded))
                        Text(range).font(.system(size: 9, weight: .semibold))
                    }
                }
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text("The call · \(c?.label ?? "")").font(.system(size: 12, weight: .semibold))
                    Text("Stop \(c?.stop ?? "—") (\(range))").font(.system(size: 15, weight: .bold))
                    Text("about \(c?.letters ?? 0) letters").font(.system(size: 12))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            case .accessoryInline:
                Text("⚓ Call: stop \(c?.stop ?? "—") (\(range))")
            default:
                VStack(alignment: .leading, spacing: 2) {
                    FeedLabel(text: "THE CALL · \(c?.label ?? "")")
                    Spacer(minLength: 0)
                    Text(c?.stop ?? "—")
                        .font(.system(size: 52, weight: .heavy, design: .rounded))
                        .foregroundStyle(copper).lineLimit(1)
                    Text("range \(range) · ~\(c?.letters ?? 0) letters").font(.system(size: 12, weight: .semibold)).foregroundStyle(bone)
                    Text("Started \(c?.start ?? "—")").font(.system(size: 11)).foregroundStyle(steel)
                    Text((c?.locked ?? false) ? "locked at flex" : "not locked yet").font(.system(size: 11)).foregroundStyle(steel)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
            }
        }
        .containerBackground(for: .widget) { plate }
    }
}

// --- What came down: flex / 1st / 2nd
struct WavesBar: View {
    let w: FeedWaves?
    var body: some View {
        let f = CGFloat(w?.flex ?? 0), a = CGFloat(w?.first ?? 0), b = CGFloat(w?.second ?? 0)
        let t = max(f + a + b, 1)
        GeometryReader { g in
            HStack(spacing: 2) {
                Rectangle().fill(flexRed).frame(width: max(g.size.width * f / t - 2, f > 0 ? 3 : 0))
                Rectangle().fill(firstNavy).frame(width: max(g.size.width * a / t - 2, a > 0 ? 3 : 0))
                Rectangle().fill(onGreen).frame(width: max(g.size.width * b / t - 2, b > 0 ? 3 : 0))
            }
            .clipShape(RoundedRectangle(cornerRadius: 4))
        }
        .frame(height: 8)
    }
}

struct WavesView: View {
    let entry: FeedEntry
    private var s: FeedShift? { entry.feed?.shift }
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                FeedLabel(text: "WHAT CAME DOWN · \(s?.label ?? "")", live: s?.onAir ?? false)
                Spacer(minLength: 0)
                Text("\(fmtN(s?.jobsDown)) total").font(.system(size: 12, weight: .semibold)).foregroundStyle(bone)
            }
            WavesBar(w: s?.waves)
            HStack {
                waveCell("FLEX", s?.waves?.flex, flexRed)
                Spacer(minLength: 0)
                waveCell("1ST", s?.waves?.first, bone)
                Spacer(minLength: 0)
                waveCell("2ND", s?.waves?.second, onGreen)
            }
            Text("Board on \(s?.boardOn ?? "—")").font(.system(size: 11)).foregroundStyle(steel)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(for: .widget) { plate }
    }
    private func waveCell(_ name: String, _ n: Int?, _ color: Color) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(name).font(.system(size: 11, weight: .bold)).foregroundStyle(color)
            Text(fmtN(n ?? 0)).font(.system(size: 22, weight: .heavy, design: .rounded)).foregroundStyle(bone)
        }
    }
}

// --- Last board: where it walked, and how the call did
struct LastBoardView: View {
    let entry: FeedEntry
    private var l: FeedLast? { entry.feed?.last }
    private var verdict: String {
        guard let stop = l?.callStop else { return "" }
        guard let m = l?.miss else { return "Call was \(stop)" }
        if m == 0 { return "Call \(stop) · right on it" }
        return "Call \(stop) · off by \(abs(m))" + ((l?.inRange ?? false) ? ", in range" : "")
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            FeedLabel(text: "LAST BOARD · \(l?.label ?? "")")
            Spacer(minLength: 0)
            Text("\(l?.start ?? "—") → \(l?.end ?? "—")")
                .font(.system(size: 17, weight: .heavy, design: .monospaced)).foregroundStyle(bone)
                .minimumScaleFactor(0.6).lineLimit(1)
            Text("\(l?.moved ?? 0) letters walked").font(.system(size: 12, weight: .semibold)).foregroundStyle(copper)
            Text(verdict).font(.system(size: 11)).foregroundStyle(steel).lineLimit(1)
            if let t = l?.pmaTotal {
                Text("\(fmtN(t)) PMA · hall \(fmtN(l?.hall))").font(.system(size: 11)).foregroundStyle(steel).lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .containerBackground(for: .widget) { plate }
    }
}

// --- Board dashboard: everything at once (iPad, large)
struct DashboardView: View {
    let entry: FeedEntry
    private var s: FeedShift? { entry.feed?.shift }
    private var c: FeedCall? { entry.feed?.call }
    private var l: FeedLast? { entry.feed?.last }
    private var lastCallText: String {
        if let n = s?.lastDrop?.n { return "+\(n) last call" }
        return ""
    }
    private var nextText: String {
        if let nx = s?.next, let first = nx.first { return "next \(first)" }
        return ""
    }
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            FeedLabel(text: (s?.onAir ?? false) ? "ON AIR · \(s?.label ?? "")" : "THE BOARD · \(s?.label ?? "")", live: s?.onAir ?? false)
            HStack(alignment: .top, spacing: 10) {
                tile("JOBS DOWN", fmtN(s?.jobsDown), lastCallText)
                tile("BOARD ON", s?.boardOn ?? "—", nextText)
                tile("THE CALL", c?.stop ?? "—", (c?.lo != nil && c?.hi != nil) ? "\(c!.lo!)–\(c!.hi!)" : "")
            }
            WavesBar(w: s?.waves)
            HStack {
                Text("FLEX \(fmtN(s?.waves?.flex ?? 0))").foregroundStyle(flexRed)
                Spacer(minLength: 0)
                Text("1ST \(fmtN(s?.waves?.first ?? 0))").foregroundStyle(bone)
                Spacer(minLength: 0)
                Text("2ND \(fmtN(s?.waves?.second ?? 0))").foregroundStyle(onGreen)
            }
            .font(.system(size: 13, weight: .bold))
            Divider().overlay(steel.opacity(0.4))
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("LAST BOARD · \(l?.label ?? "")").font(.system(size: 11, weight: .bold)).foregroundStyle(steel)
                    Text("\(l?.start ?? "—") → \(l?.end ?? "—")").font(.system(size: 16, weight: .heavy, design: .monospaced)).foregroundStyle(bone)
                }
                Spacer(minLength: 0)
                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(l?.moved ?? 0) letters").font(.system(size: 13, weight: .bold)).foregroundStyle(copper)
                    if let t = l?.pmaTotal { Text("\(fmtN(t)) PMA").font(.system(size: 11)).foregroundStyle(steel) }
                }
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .containerBackground(for: .widget) { plate }
    }
    private func tile(_ k: String, _ v: String, _ sub: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(k).font(.system(size: 10, weight: .bold)).foregroundStyle(steel)
            Text(v).font(.system(size: 26, weight: .heavy, design: .rounded)).foregroundStyle(copper).minimumScaleFactor(0.5).lineLimit(1)
            Text(sub).font(.system(size: 10)).foregroundStyle(steel).lineLimit(1)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.06)))
    }
}

struct DispatchWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "DispatchWidget", provider: FeedProvider()) { DispatchView(entry: $0) }
            .configurationDisplayName("Live dispatch")
            .description("Jobs down and where the board is, during dispatch.")
            .supportedFamilies([.systemSmall, .accessoryRectangular, .accessoryInline])
    }
}
struct CallWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "CallWidget", provider: FeedProvider()) { CallView(entry: $0) }
            .configurationDisplayName("The call")
            .description("Where the board is predicted to stop.")
            .supportedFamilies([.systemSmall, .accessoryCircular, .accessoryRectangular, .accessoryInline])
    }
}
struct WavesWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WavesWidget", provider: FeedProvider()) { WavesView(entry: $0) }
            .configurationDisplayName("What came down")
            .description("Flex, 1st and 2nd call jobs.")
            .supportedFamilies([.systemMedium])
    }
}
struct LastBoardWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "LastBoardWidget", provider: FeedProvider()) { LastBoardView(entry: $0) }
            .configurationDisplayName("Last board")
            .description("Where the last board walked, and how the call did.")
            .supportedFamilies([.systemSmall])
    }
}
struct DashboardWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "DashboardWidget", provider: FeedProvider()) { DashboardView(entry: $0) }
            .configurationDisplayName("Board dashboard")
            .description("Jobs down, the board, the call and the last board together.")
            .supportedFamilies([.systemLarge, .systemExtraLarge])
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
        DispatchWidget()
        CallWidget()
        WavesWidget()
        LastBoardWidget()
        DashboardWidget()
        BoardLiveActivity()
    }
}
