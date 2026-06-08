import { describe, it, expect } from "vitest";
import {
  installDomTranslationGuard,
  shouldSkipRemoveChild,
  shouldSkipInsertBefore,
  type GuardableNode,
} from "./dom-translation-guard";

/** Build a minimal structural node for the guard predicates. */
function makeNode(
  parentNode: GuardableNode | null = null,
  contained: ReadonlyArray<unknown> = []
): GuardableNode {
  const set = new Set(contained);
  return {
    parentNode,
    contains: (other: unknown) => set.has(other),
  };
}

describe("dom-translation-guard", () => {
  describe("shouldSkipRemoveChild", () => {
    it("skips when the child's parent is not this node (would throw NotFoundError)", () => {
      const parent = makeNode();
      const otherParent = makeNode();
      const child = makeNode(otherParent);
      expect(shouldSkipRemoveChild(parent, child)).toBe(true);
    });

    it("skips when the child has been detached (parentNode is null)", () => {
      const parent = makeNode();
      const child = makeNode(null);
      expect(shouldSkipRemoveChild(parent, child)).toBe(true);
    });

    it("does not skip a genuine child (normal removeChild proceeds)", () => {
      const parent = makeNode();
      const child = makeNode(parent);
      expect(shouldSkipRemoveChild(parent, child)).toBe(false);
    });
  });

  describe("shouldSkipInsertBefore", () => {
    it("skips when the reference node is not a child of this node (NotFoundError)", () => {
      const parent = makeNode();
      const stranger = makeNode(makeNode());
      const newNode = makeNode();
      expect(shouldSkipInsertBefore(parent, newNode, stranger)).toBe(true);
    });

    it("skips when the new node is an ancestor of this node (HierarchyRequestError)", () => {
      const parent = makeNode();
      // newNode "contains" parent -> inserting it under parent would create a cycle.
      const newNode = makeNode(null, [parent]);
      expect(shouldSkipInsertBefore(parent, newNode, null)).toBe(true);
    });

    it("does not skip a plain append (null reference node, no cycle)", () => {
      const parent = makeNode();
      const newNode = makeNode();
      expect(shouldSkipInsertBefore(parent, newNode, null)).toBe(false);
    });

    it("does not skip a valid insert before a real child", () => {
      const parent = makeNode();
      const referenceNode = makeNode(parent);
      const newNode = makeNode();
      expect(shouldSkipInsertBefore(parent, newNode, referenceNode)).toBe(false);
    });

    it("does not flag a self-insert as a cycle", () => {
      // newNode === parent: even if contains() reports true, the `newNode !==
      // parent` guard must short-circuit so this is not mistaken for a cycle.
      const parent = makeNode();
      (parent as { contains: (other: unknown) => boolean }).contains = () =>
        true;
      expect(shouldSkipInsertBefore(parent, parent, null)).toBe(false);
    });

    it("tolerates nodes without a contains() method", () => {
      const parent: GuardableNode = { parentNode: null };
      const newNode: GuardableNode = { parentNode: null };
      expect(shouldSkipInsertBefore(parent, newNode, null)).toBe(false);
    });
  });

  describe("installDomTranslationGuard", () => {
    it("is safe to call (and idempotent) when no DOM is present", () => {
      // The vitest environment is `node`, so `Node` is undefined and the guard
      // is a no-op. It must never throw and must be safe to call repeatedly.
      expect(() => {
        installDomTranslationGuard();
        installDomTranslationGuard();
      }).not.toThrow();
    });
  });
});
