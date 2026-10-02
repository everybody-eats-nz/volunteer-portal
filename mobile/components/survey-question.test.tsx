import { afterEach, describe, expect, it, vi } from "vitest";
import { Pressable, Text, TextInput } from "react-native";

import { SurveyQuestion } from "@/components/survey-question";
import type { KeyboardAwareScroll } from "@/hooks/use-keyboard-aware-scroll";
import type { SurveyAnswerValue, SurveyQuestion as Question } from "@/lib/surveys";
import { render } from "@/test-utils/render";

vi.mock("react-native", async () => {
  const stub = await import("@/test-utils/react-native");
  const React = await import("react");
  const TextInput = (props: Record<string, unknown>) =>
    React.createElement("TextInput", props);
  return { ...stub, TextInput };
});
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("expo-haptics", () => ({ selectionAsync: vi.fn() }));

const keyboardScroll = {
  inputProps: () => ({ onFocus: vi.fn(), onBlur: vi.fn() }),
} as unknown as KeyboardAwareScroll;

function question(overrides: Partial<Question>): Question {
  return {
    id: "q1",
    type: "text_short",
    text: "How was your shift?",
    required: false,
    ...overrides,
  };
}

function renderQuestion(
  q: Question,
  value?: SurveyAnswerValue,
  extra: { error?: string } = {}
) {
  const onChange = vi.fn();
  const tree = render(
    <SurveyQuestion
      question={q}
      number={2}
      total={7}
      value={value}
      error={extra.error}
      onChange={onChange}
      keyboardScroll={keyboardScroll}
    />
  );
  const press = (label: string) =>
    tree.root
      .findAllByType(Pressable)
      .find((p) => String(p.props.accessibilityLabel).startsWith(label))!
      .props.onPress();
  const option = (label: string) =>
    tree.root
      .findAllByType(Pressable)
      .find((p) => p.props.accessibilityLabel === label)!;
  const texts = () =>
    tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(""));
  return { tree, onChange, press, option, texts };
}

describe("SurveyQuestion", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("says where the question sits in the survey", () => {
    const { texts } = renderQuestion(question({}));
    expect(texts()).toContain("QUESTION 2 OF 7");
  });

  it("announces a required question as required", () => {
    const { tree } = renderQuestion(question({ required: true }));
    const header = tree.root
      .findAllByType(Text)
      .find((t) => t.props.accessibilityRole === "header")!;
    expect(header.props.accessibilityLabel).toBe("How was your shift?, required");
  });

  it("shows the message for a required question that was skipped", () => {
    const { texts } = renderQuestion(question({ required: true }), undefined, {
      error: "Please write an answer.",
    });
    expect(texts()).toContain("Please write an answer.");
  });

  describe("text", () => {
    it("answers with the typed text and enforces the length limit", () => {
      const { tree, onChange, texts } = renderQuestion(
        question({ type: "text_short", maxLength: 120 }),
        "Kia ora"
      );
      const input = tree.root.findByType(TextInput);

      expect(input.props.maxLength).toBe(120);
      expect(input.props.multiline).toBe(false);
      expect(texts()).toContain("7 / 120");

      input.props.onChangeText("Kia ora koutou");
      expect(onChange).toHaveBeenCalledWith("Kia ora koutou");
    });

    it("gives a long answer a multi-line field", () => {
      const { tree } = renderQuestion(question({ type: "text_long" }));
      expect(tree.root.findByType(TextInput).props.multiline).toBe(true);
    });
  });

  describe("single choice", () => {
    const q = question({
      type: "multiple_choice_single",
      options: ["Satisfied", "Neutral", "Dissatisfied"],
    });

    it("answers with the option's text", () => {
      const { onChange, press } = renderQuestion(q);
      press("Neutral");
      expect(onChange).toHaveBeenCalledWith("Neutral");
    });

    it("marks only the chosen option as selected", () => {
      const { option } = renderQuestion(q, "Neutral");
      expect(option("Neutral").props.accessibilityState).toEqual({ selected: true });
      expect(option("Satisfied").props.accessibilityState).toEqual({ selected: false });
      expect(option("Neutral").props.accessibilityRole).toBe("radio");
    });
  });

  describe("multiple choice", () => {
    const q = question({
      type: "multiple_choice_multi",
      options: ["Kitchen", "Service", "Clean down"],
    });

    it("adds an option, keeping the survey's order", () => {
      const { onChange, press } = renderQuestion(q, ["Clean down"]);
      press("Kitchen");
      expect(onChange).toHaveBeenCalledWith(["Kitchen", "Clean down"]);
    });

    it("removes an option that is tapped again", () => {
      const { onChange, press } = renderQuestion(q, ["Kitchen", "Service"]);
      press("Kitchen");
      expect(onChange).toHaveBeenCalledWith(["Service"]);
    });

    it("exposes each option as a checkbox", () => {
      const { option } = renderQuestion(q, ["Service"]);
      expect(option("Service").props.accessibilityRole).toBe("checkbox");
      expect(option("Service").props.accessibilityState).toEqual({ checked: true });
      expect(option("Kitchen").props.accessibilityState).toEqual({ checked: false });
    });
  });

  describe("rating", () => {
    const nps = question({
      type: "rating_scale",
      minValue: 0,
      maxValue: 10,
      minLabel: "Not at all likely",
      maxLabel: "Extremely likely",
    });

    it("answers with a number, and zero is a real answer", () => {
      const { onChange, press } = renderQuestion(nps);
      press("0,");
      expect(onChange).toHaveBeenCalledWith(0);
    });

    it("offers every point and names what the two ends mean", () => {
      const { tree, option, texts } = renderQuestion(nps, 7);
      const points = tree.root
        .findAllByType(Pressable)
        .filter((p) => p.props.accessibilityRole === "radio");

      expect(points).toHaveLength(11);
      expect(option("0, Not at all likely")).toBeDefined();
      expect(option("10, Extremely likely")).toBeDefined();
      expect(option("7").props.accessibilityState).toEqual({ selected: true });
      expect(texts()).toContain("0 · Not at all likely");
      expect(texts()).toContain("10 · Extremely likely");
    });
  });

  describe("yes / no", () => {
    const q = question({ type: "yes_no" });

    it("answers with a boolean", () => {
      const yes = renderQuestion(q);
      yes.press("Yes");
      expect(yes.onChange).toHaveBeenCalledWith(true);

      const no = renderQuestion(q);
      no.press("No");
      expect(no.onChange).toHaveBeenCalledWith(false);
    });

    it("shows 'No' as chosen, not as unanswered", () => {
      const { option } = renderQuestion(q, false);
      expect(option("No").props.accessibilityState).toEqual({ selected: true });
      expect(option("Yes").props.accessibilityState).toEqual({ selected: false });
    });
  });
});
