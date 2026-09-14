import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-test-renderer";
import { Alert, Pressable, TextInput } from "react-native";
import * as ImagePicker from "expo-image-picker";

import { OdometerCapture, type OdometerCaptureProps } from "@/components/van/odometer-capture";
import { uploadOdometerPhoto } from "@/lib/van";
import { render } from "@/test-utils/render";

type ViewfinderProps = {
  onCapture: (photo: { uri: string; mimeType: string; fileName: string }) => void;
  onUnavailable: (reason: "denied" | "failed") => void;
};

// Stands in for the live camera, so a test can drive what it reports back.
const viewfinder = vi.hoisted(() => {
  const state = { available: true, props: undefined as ViewfinderProps | undefined };
  function FakeViewfinder(props: ViewfinderProps) {
    state.props = props;
    return null;
  }
  return { state, FakeViewfinder };
});

vi.mock("@/components/van/load-viewfinder", () => ({
  get OdometerViewfinder() {
    return viewfinder.state.available ? viewfinder.FakeViewfinder : null;
  },
}));

vi.mock("react-native", async () => {
  const stub = await import("@/test-utils/react-native");
  const React = await import("react");
  const host = (name: string) => {
    const Component = ({ children, ...props }: { children?: React.ReactNode }) =>
      React.createElement(name, props, children);
    Component.displayName = name;
    return Component;
  };
  return {
    ...stub,
    TextInput: host("TextInput"),
    KeyboardAvoidingView: host("KeyboardAvoidingView"),
    Keyboard: { dismiss: vi.fn() },
    Linking: { openSettings: vi.fn() },
    Alert: { alert: vi.fn() },
  };
});
vi.mock("react-native-reanimated", async () => {
  const stub = await import("@/test-utils/react-native");
  return {
    default: { View: stub.View },
    FadeIn: { duration: () => "fade-in" },
    useAnimatedKeyboard: () => ({ height: { value: 0 } }),
    useAnimatedStyle: () => ({}),
  };
});
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("expo-image", () => ({ Image: () => null }));
vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: "light" },
}));
vi.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: vi.fn(),
  launchCameraAsync: vi.fn(),
}));
vi.mock("@/lib/van", () => ({ uploadOdometerPhoto: vi.fn() }));

const photo = { uri: "file:///odometer.jpg", mimeType: "image/jpeg", fileName: "odometer.jpg" };

function renderCapture(props: Partial<OdometerCaptureProps> = {}) {
  return render(
    <OdometerCapture
      label="Odometer now"
      knownReadingCaption="Last recorded"
      knownReadingLabel="12,345 km"
      submitLabel="Next"
      onSubmit={() => {}}
      {...props}
    />
  );
}

const onCamera = (tree: ReturnType<typeof render>) =>
  tree.root.findAll((node) => node.props.testID === "odometer-camera").length > 0;
const readingField = (tree: ReturnType<typeof render>) => tree.root.findAllByType(TextInput);
const pressableLabelled = (tree: ReturnType<typeof render>, label: string) =>
  tree.root.findAllByType(Pressable).find((node) => node.props.accessibilityLabel === label);

describe("OdometerCapture", () => {
  beforeEach(() => {
    viewfinder.state.available = true;
    viewfinder.state.props = undefined;
    vi.mocked(uploadOdometerPhoto).mockResolvedValue("https://storage/odometer.jpg");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("lands on the live camera, with no number pad over it", () => {
    const tree = renderCapture();

    expect(onCamera(tree)).toBe(true);
    expect(readingField(tree)).toHaveLength(0);
  });

  it("goes to the reading and uploads the shot as soon as it is taken", async () => {
    const tree = renderCapture();

    await act(async () => {
      viewfinder.state.props!.onCapture(photo);
    });

    expect(onCamera(tree)).toBe(false);
    expect(readingField(tree)).toHaveLength(1);
    expect(uploadOdometerPhoto).toHaveBeenCalledWith(photo);
    expect(pressableLabelled(tree, "Retake the odometer photo")).toBeDefined();
  });

  it("still records the reading when the photo will not upload", async () => {
    vi.mocked(uploadOdometerPhoto).mockResolvedValue(null);
    const onSubmit = vi.fn();
    const tree = renderCapture({ onSubmit });

    await act(async () => {
      viewfinder.state.props!.onCapture(photo);
    });
    act(() => {
      readingField(tree)[0].props.onChangeText("12400");
    });
    act(() => {
      pressableLabelled(tree, "Next")!.props.onPress();
    });

    expect(
      tree.root.findAll((node) => node.props.children === "Photo didn't save — the reading still counts")
    ).not.toHaveLength(0);
    expect(onSubmit).toHaveBeenCalledWith(12400, null, photo.uri);
  });

  it("refuses an end reading at or below where the trip started", () => {
    const onSubmit = vi.fn();
    const tree = renderCapture({ minimum: 12400, initialOdo: 12400, onSubmit });

    act(() => {
      pressableLabelled(tree, "Next")!.props.onPress();
    });

    expect(pressableLabelled(tree, "Next")!.props.disabled).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("lets the driver skip the photo and type the reading", () => {
    const tree = renderCapture();

    act(() => {
      pressableLabelled(tree, "Skip the photo")!.props.onPress();
    });

    expect(readingField(tree)).toHaveLength(1);
    expect(uploadOdometerPhoto).not.toHaveBeenCalled();
  });

  it("reopens the live camera from the photo well", () => {
    const tree = renderCapture({ initialOdo: 12400 });
    expect(onCamera(tree)).toBe(false);

    act(() => {
      pressableLabelled(tree, "Photograph the odometer")!.props.onPress();
    });

    expect(onCamera(tree)).toBe(true);
    expect(ImagePicker.launchCameraAsync).not.toHaveBeenCalled();
  });

  it("starts on the reading when the driver steps back with a photo already taken", () => {
    const tree = renderCapture({ initialPhotoUri: photo.uri, initialPhotoUrl: "https://x" });

    expect(onCamera(tree)).toBe(false);
    expect(readingField(tree)).toHaveLength(1);
  });

  it("quietly falls back to the reading when access is refused on arrival", () => {
    const tree = renderCapture();

    act(() => {
      viewfinder.state.props!.onUnavailable("denied");
    });

    expect(readingField(tree)).toHaveLength(1);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("explains a refusal when the driver asked for the camera", () => {
    const tree = renderCapture({ initialOdo: 12400 });

    act(() => {
      pressableLabelled(tree, "Photograph the odometer")!.props.onPress();
    });
    act(() => {
      viewfinder.state.props!.onUnavailable("denied");
    });

    expect(readingField(tree)).toHaveLength(1);
    expect(Alert.alert).toHaveBeenCalledWith(
      "Camera access needed",
      expect.any(String),
      expect.any(Array)
    );
  });

  it("uses the system camera on binaries without the live viewfinder", async () => {
    viewfinder.state.available = false;
    vi.mocked(ImagePicker.requestCameraPermissionsAsync).mockResolvedValue({
      status: "granted",
    } as Awaited<ReturnType<typeof ImagePicker.requestCameraPermissionsAsync>>);
    vi.mocked(ImagePicker.launchCameraAsync).mockResolvedValue({
      canceled: false,
      assets: [photo],
    } as unknown as Awaited<ReturnType<typeof ImagePicker.launchCameraAsync>>);

    const tree = renderCapture();
    expect(onCamera(tree)).toBe(false);

    await act(async () => {
      await pressableLabelled(tree, "Photograph the odometer")!.props.onPress();
    });

    expect(ImagePicker.launchCameraAsync).toHaveBeenCalled();
    expect(uploadOdometerPhoto).toHaveBeenCalledWith(photo);
  });
});
