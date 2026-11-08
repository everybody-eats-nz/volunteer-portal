import ExpoModulesCore

public class ScrollEdgeEffectModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ScrollEdgeEffect")

    // The edge effect and UIScrollEdgeElementContainerInteraction arrived in
    // iOS 26. Earlier systems render the JS fallback instead of this view.
    Constant("isSupported") { () -> Bool in
      if #available(iOS 26.0, *) {
        return true
      }
      return false
    }

    View(ScrollEdgeEffectView.self) {
      Prop("edge") { (view: ScrollEdgeEffectView, edge: String) in
        view.edge = edge == "bottom" ? .bottom : .top
      }
    }
  }
}
