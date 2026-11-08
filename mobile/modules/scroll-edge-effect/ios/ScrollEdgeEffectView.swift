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

  /// Screens swap their scroll view out (a loading state, then the list; a
  /// welcome page, then the chat) without this view laying out again, so it
  /// re-checks on a slow timer while on screen: a pointer comparison when
  /// attached, a search of its siblings when not.
  private var recheckTimer: Timer?

  /// UIKit shapes the effect around the container's visible descendants
  /// (labels, images, controls). An empty view yields no effect at all, so a
  /// clear label spans the frame: nothing is drawn, but the effect covers it.
  private let shapeLabel: UILabel = {
    let label = UILabel()
    label.text = "Status bar"
    label.textColor = .clear
    label.textAlignment = .center
    label.isAccessibilityElement = false
    return label
  }()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    insertSubview(shapeLabel, at: 0)
  }

  deinit {
    recheckTimer?.invalidate()
  }

  /// Touches pass through the view itself to the content scrolling beneath,
  /// while React children laid on top of it (a header's back button) still
  /// receive them.
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let hit = super.hitTest(point, with: event)
    return hit === self || hit === shapeLabel ? nil : hit
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    shapeLabel.frame = bounds
    attachIfNeeded()
  }

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window == nil {
      recheckTimer?.invalidate()
      recheckTimer = nil
      detach()
    } else {
      attachIfNeeded()
      startRechecking()
    }
  }

  private func startRechecking() {
    guard #available(iOS 26.0, *), recheckTimer == nil else { return }
    let timer = Timer(timeInterval: 0.25, repeats: true) { [weak self] _ in
      self?.attachIfNeeded()
    }
    RunLoop.main.add(timer, forMode: .common)
    recheckTimer = timer
  }

  private func reattach() {
    detach()
    attachIfNeeded()
  }

  private func attachIfNeeded() {
    guard #available(iOS 26.0, *), window != nil else { return }
    if let scrollView = attachedScrollView, scrollView.window === window,
       scrollView.superview != nil {
      return
    }
    detach()
    guard let scrollView = findScrollView() else { return }

    let interaction = UIScrollEdgeElementContainerInteraction()
    interaction.scrollView = scrollView
    interaction.edge = edge
    addInteraction(interaction)

    let effect = edge == .bottom ? scrollView.bottomEdgeEffect : scrollView.topEdgeEffect
    effect.isHidden = false
    effect.style = .soft

    self.interaction = interaction
    attachedScrollView = scrollView
  }

  private func detach() {
    if let interaction {
      removeInteraction(interaction)
    }
    interaction = nil
    attachedScrollView = nil
  }

  /// The scroll view this view floats over: the shallowest one among its
  /// siblings' subtrees that reaches up to this view's top edge, so a
  /// horizontal carousel further down the screen is never picked. It may be
  /// narrower than this view (the driver flows inset their content).
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
        if frame.minY <= ownFrame.minY + 1, frame.width >= ownFrame.width / 2 {
          return scrollView
        }
      }
      queue.append(contentsOf: candidate.subviews)
    }
    return nil
  }
}
