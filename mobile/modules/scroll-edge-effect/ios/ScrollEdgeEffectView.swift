import ExpoModulesCore
import UIKit

/// Marks its own frame as floating over the edge of the screen's scroll view,
/// so iOS 26 draws its native scroll edge effect (the soft, progressive blur
/// a navigation bar gets) behind it once content scrolls underneath.
///
/// Navigation bars get this for free. The tab screens and the screens with
/// their own chrome have no bar, so without this the status bar has nothing
/// to fade into. React renders the view over the top of the scroll view (the
/// status bar inset, or a hand-built header); it finds that scroll view among
/// its siblings.
final class ScrollEdgeEffectView: ExpoView {
  var edge: UIRectEdge = .top {
    didSet {
      if edge != oldValue { reattach() }
    }
  }

  private weak var attachedScrollView: UIScrollView?
  private var interaction: UIInteraction?
  /// What the scroll view's edge effect was before this view took it over,
  /// put back on detach in case the scroll view outlives this view.
  private var previousEffect: (isHidden: Bool, style: AnyObject)?
  /// Rides inside the attached scroll view to report when it leaves the
  /// window (unmounted, or swapped for another), so this view can look again.
  private let windowWatcher = WindowWatcherView()

  /// Screens mount their scroll view after their header (a loading state,
  /// then the list), and nothing tells this view when it appears. So while it
  /// has no scroll view it looks again on a timer that backs off; once
  /// attached it stops, and the watcher restarts it.
  private var searchTimer: Timer?
  private var searchInterval: TimeInterval = SearchBackoff.first

  private enum SearchBackoff {
    static let first: TimeInterval = 0.1
    static let longest: TimeInterval = 2
  }

  /// UIKit shapes the effect around the container's visible descendants
  /// (labels, images, controls). An empty view yields no effect at all, so a
  /// clear label spans the frame: nothing is drawn, but the effect covers it.
  private let shapeLabel: UILabel = {
    let label = UILabel()
    label.text = "Scroll edge"
    label.textColor = .clear
    label.textAlignment = .center
    label.isAccessibilityElement = false
    return label
  }()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    insertSubview(shapeLabel, at: 0)
    windowWatcher.onLeaveWindow = { [weak self] in
      self?.reattach()
    }
  }

  deinit {
    searchTimer?.invalidate()
  }

  /// Touches pass through the view itself to the content scrolling beneath,
  /// while React children laid on top of it (a header's back button) still
  /// receive them. (The label never takes touches: UILabel has interaction
  /// off.)
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let hit = super.hitTest(point, with: event)
    return hit === self ? nil : hit
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    shapeLabel.frame = bounds
    if attachedScrollView == nil { attachIfPossible() }
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      stopSearching()
      detach()
    } else {
      reattach()
    }
  }

  private func reattach() {
    detach()
    searchInterval = SearchBackoff.first
    attachIfPossible()
  }

  /// Attaches to the scroll view if one is there, else schedules another look.
  private func attachIfPossible() {
    guard #available(iOS 26.0, *), window != nil else { return }
    guard let scrollView = findScrollView() else {
      scheduleSearch()
      return
    }
    stopSearching()

    let interaction = UIScrollEdgeElementContainerInteraction()
    interaction.scrollView = scrollView
    interaction.edge = edge
    addInteraction(interaction)

    let effect = edge == .bottom ? scrollView.bottomEdgeEffect : scrollView.topEdgeEffect
    previousEffect = (effect.isHidden, effect.style)
    effect.isHidden = false
    effect.style = .soft

    scrollView.addSubview(windowWatcher)
    self.interaction = interaction
    attachedScrollView = scrollView
  }

  private func detach() {
    if let interaction {
      removeInteraction(interaction)
    }
    if #available(iOS 26.0, *), let scrollView = attachedScrollView, let previousEffect,
       let style = previousEffect.style as? UIScrollEdgeEffect.Style {
      let effect = edge == .bottom ? scrollView.bottomEdgeEffect : scrollView.topEdgeEffect
      effect.isHidden = previousEffect.isHidden
      effect.style = style
    }
    // Detach the watcher quietly: it is leaving because this view chose to.
    windowWatcher.onLeaveWindowEnabled = false
    windowWatcher.removeFromSuperview()
    windowWatcher.onLeaveWindowEnabled = true
    interaction = nil
    previousEffect = nil
    attachedScrollView = nil
  }

  private func scheduleSearch() {
    guard searchTimer == nil else { return }
    let timer = Timer(timeInterval: searchInterval, repeats: false) { [weak self] _ in
      guard let self else { return }
      self.searchTimer = nil
      self.searchInterval = min(self.searchInterval * 2, SearchBackoff.longest)
      self.attachIfPossible()
    }
    RunLoop.main.add(timer, forMode: .default)
    searchTimer = timer
  }

  private func stopSearching() {
    searchTimer?.invalidate()
    searchTimer = nil
  }

  /// The scroll view this view floats over: the shallowest vertical one among
  /// its siblings' subtrees that reaches up to this view's top edge. A
  /// horizontal carousel (one React Native set to bounce only sideways) is
  /// skipped, and so is anything further down the screen. It may be narrower
  /// than this view (the driver flows inset their content).
  private func findScrollView() -> UIScrollView? {
    guard let superview, let window else { return nil }
    let ownFrame = convert(bounds, to: window)
    var queue: [UIView] = superview.subviews.filter { $0 !== self }
    var index = 0
    while index < queue.count {
      let candidate = queue[index]
      index += 1
      if let scrollView = candidate as? UIScrollView {
        let frame = scrollView.convert(scrollView.bounds, to: window)
        let horizontalOnly = scrollView.alwaysBounceHorizontal && !scrollView.alwaysBounceVertical
        if !horizontalOnly, frame.minY <= ownFrame.minY + 1, frame.width >= ownFrame.width / 2 {
          return scrollView
        }
      }
      queue.append(contentsOf: candidate.subviews)
    }
    return nil
  }
}

/// A zero-size, invisible view that calls back when it leaves the window.
private final class WindowWatcherView: UIView {
  var onLeaveWindow: (() -> Void)?
  var onLeaveWindowEnabled = true

  override init(frame: CGRect) {
    super.init(frame: .zero)
    isHidden = true
    isUserInteractionEnabled = false
    isAccessibilityElement = false
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) {
    fatalError("init(coder:) is not supported")
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil, onLeaveWindowEnabled {
      // Let the unmount finish before looking for a replacement.
      DispatchQueue.main.async { [weak self] in
        self?.onLeaveWindow?()
      }
    }
  }
}
