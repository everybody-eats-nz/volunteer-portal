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
 * These overrides make the two methods degrade gracefully in exactly the cases
 * that would otherwise throw, and otherwise defer to the native behaviour, so
 * normal rendering is untouched. This is the widely-used workaround for
 * https://github.com/facebook/react/issues/11538.
 */

let installed = false;

export function installDomTranslationGuard(): void {
  if (installed) return;
  if (typeof Node !== "function" || !Node.prototype) return;
  installed = true;

  const warn = (message: string, ...args: unknown[]) => {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn(`[dom-translation-guard] ${message}`, ...args);
    }
  };

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function removeChild<T extends Node>(
    this: Node,
    child: T
  ): T {
    if (child.parentNode !== this) {
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
    // NotFoundError: the reference node has been re-parented by translation.
    if (referenceNode && referenceNode.parentNode !== this) {
      warn("skipped insertBefore for a detached reference node", referenceNode);
      return newNode;
    }
    // HierarchyRequestError: inserting an ancestor under itself.
    if (newNode !== this && newNode.contains?.(this)) {
      warn("skipped insertBefore that would create a cycle", newNode);
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}
