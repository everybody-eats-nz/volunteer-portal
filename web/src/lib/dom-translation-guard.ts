/**
 * Guards React against crashes caused by in-browser translation features
 * (Google Translate, Microsoft Translator, and similar extensions).
 *
 * Those tools rewrite the page's text nodes — typically wrapping them in
 * `<font>` elements — out from under React. When React's reconciler later
 * calls `Node.removeChild` / `Node.insertBefore` to update the tree, the
 * parent/child relationship it expects no longer matches the live DOM, so the
 * browser throws:
 *
 *   - NotFoundError: ... node ... is not a child of this node
 *   - HierarchyRequestError: The new child element contains the parent
 *
 * The exception is unhandled and takes the whole page down. We surfaced this on
 * `/shifts/details` and `/shifts/mine` in error tracking.
 *
 * The overrides below make the two methods degrade gracefully in exactly the
 * cases that would otherwise throw, and otherwise defer to the native
 * behaviour, so normal rendering is untouched. This is the widely-used
 * workaround for https://github.com/facebook/react/issues/11538.
 */

/**
 * Minimal structural shape of a DOM node used by the guard predicates. Kept
 * dependency-free so the decision logic is unit-testable without a DOM.
 */
export interface GuardableNode {
  parentNode: GuardableNode | null;
  contains?(other: unknown): boolean;
}

/**
 * A native `removeChild(child)` throws `NotFoundError` when `child` is not
 * actually a child of `parent`. Returns true when we should skip the call.
 */
export function shouldSkipRemoveChild(
  parent: GuardableNode,
  child: GuardableNode
): boolean {
  return child.parentNode !== parent;
}

/**
 * A native `insertBefore(newNode, referenceNode)` throws when:
 *   - `referenceNode` is not a child of `parent` (NotFoundError), or
 *   - `newNode` is an ancestor of `parent` (HierarchyRequestError —
 *     "the new child element contains the parent").
 * Returns true when we should skip the call.
 */
export function shouldSkipInsertBefore(
  parent: GuardableNode,
  newNode: GuardableNode,
  referenceNode: GuardableNode | null
): boolean {
  if (referenceNode && referenceNode.parentNode !== parent) return true;
  if (newNode !== parent && newNode.contains?.(parent) === true) return true;
  return false;
}

let installed = false;

export function installDomTranslationGuard(): void {
  if (installed) return;
  if (typeof Node !== "function" || !Node.prototype) return;
  installed = true;

  const warn = (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[dom-translation-guard] ${message}`, ...args);
    }
  };

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function removeChild<T extends Node>(
    this: Node,
    child: T
  ): T {
    if (shouldSkipRemoveChild(this, child)) {
      warn("skipped removeChild for a node that is not a child", child);
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function insertBefore<T extends Node>(
    this: Node,
    newNode: T,
    referenceNode: Node | null
  ): T {
    if (shouldSkipInsertBefore(this, newNode, referenceNode)) {
      warn("skipped insertBefore that would throw", newNode, referenceNode);
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}
