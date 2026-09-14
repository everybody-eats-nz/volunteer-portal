import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react-test-renderer";
import { Pressable, Text } from "react-native";

import { OdometerViewfinder } from "@/components/van/odometer-viewfinder";
import { render } from "@/test-utils/render";

type CameraProps = {
  pictureSize?: string;
  onCameraReady?: () => void;
  onMountError?: (event: { message: string }) => void;
};

// A camera the test can make ready, fail to start, or fail a shot.
const camera = vi.hoisted(() => ({
  props: undefined as CameraProps | undefined,
  permission: { granted: true, canAskAgain: true } as { granted: boolean; canAskAgain: boolean } | null,
  requestPermission: vi.fn(),
  takePictureAsync: vi.fn(),
  getAvailablePictureSizesAsync: vi.fn(),
}));

// The on-device text recogniser, or none, and what it makes of each frame.
const reader = vi.hoisted(() => ({
  available: true,
  recognize: vi.fn(),
  deleted: [] as string[],
}));

vi.mock("expo-camera", async () => {
  const React = await import("react");
  const CameraView = React.forwardRef<unknown, CameraProps>((props, ref) => {
    camera.props = props;
    React.useImperativeHandle(ref, () => ({
      takePictureAsync: camera.takePictureAsync,
      getAvailablePictureSizesAsync: camera.getAvailablePictureSizesAsync,
    }));
    return null;
  });
  CameraView.displayName = "CameraView";
  return {
    CameraView,
    useCameraPermissions: () => [camera.permission, camera.requestPermission],
  };
});
vi.mock("@/components/van/load-odometer-reader", () => ({
  get readText() {
    return reader.available ? reader.recognize : null;
  },
}));
vi.mock("expo-file-system", () => ({
  File: class {
    constructor(private uri: string) {}
    delete() {
      reader.deleted.push(this.uri);
    }
  },
}));
vi.mock("react-native", () => import("@/test-utils/react-native"));
vi.mock("react-native-reanimated", async () => {
  const stub = await import("@/test-utils/react-native");
  return {
    default: { View: stub.View },
    FadeIn: { duration: () => "fade-in" },
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: () => ({}),
    withSequence: () => 0,
    withTiming: () => 0,
  };
});
vi.mock("expo-linear-gradient", () => ({ LinearGradient: () => null }));
vi.mock("@expo/vector-icons", () => ({ Ionicons: () => null }));
vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(),
  notificationAsync: vi.fn(),
  ImpactFeedbackStyle: { Medium: "medium" },
  NotificationFeedbackType: { Success: "success" },
}));

const shot = (uri: string) => ({ uri, width: 2560, height: 1920, format: "jpg" });
const seen = (text: string) => ({
  text,
  blocks: [
    {
      text,
      boundingBox: { x: 0, y: 0, width: 2560, height: 1920 },
      lines: [
        {
          text,
          boundingBox: { x: 900, y: 800, width: 700, height: 160 },
          elements: [{ text, boundingBox: { x: 900, y: 800, width: 700, height: 160 } }],
        },
      ],
    },
  ],
});

function renderViewfinder(props: { minimum?: number | null; expected?: number | null } = {}) {
  const onCapture = vi.fn();
  const onUnavailable = vi.fn();
  const tree = render(
    <OdometerViewfinder onCapture={onCapture} onUnavailable={onUnavailable} {...props} />
  );
  return { tree, onCapture, onUnavailable };
}

const shutter = (tree: ReturnType<typeof render>) =>
  tree.root.findAllByType(Pressable).find((node) => node.props.testID === "odometer-shutter")!;
const caption = (tree: ReturnType<typeof render>) =>
  tree.root.findAllByType(Text).map((node) => node.props.children).join(" ");
const readout = (tree: ReturnType<typeof render>) =>
  tree.root.findAll((node) => node.props.testID === "odometer-readout");

/** Let the camera settle and the glance loop run for a while. */
const glanceFor = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe("OdometerViewfinder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    camera.props = undefined;
    camera.permission = { granted: true, canAskAgain: true };
    camera.getAvailablePictureSizesAsync.mockResolvedValue(["4000x3000", "2560x1920"]);
    camera.takePictureAsync.mockResolvedValue(shot("file:///shot.jpg"));
    reader.available = true;
    reader.deleted = [];
    reader.recognize.mockResolvedValue({ text: "", blocks: [] });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("holds the shutter until the camera is ready, then caps the picture size", async () => {
    const { tree } = renderViewfinder();
    expect(shutter(tree).props.disabled).toBe(true);

    await act(async () => {
      camera.props!.onCameraReady!();
    });

    expect(shutter(tree).props.disabled).toBe(false);
    expect(camera.props!.pictureSize).toBe("2560x1920");
  });

  it("hands back the shot on one tap", async () => {
    const { tree, onCapture } = renderViewfinder();
    await act(async () => {
      camera.props!.onCameraReady!();
    });

    await act(async () => {
      await shutter(tree).props.onPress();
    });

    expect(onCapture).toHaveBeenCalledWith({
      uri: "file:///shot.jpg",
      mimeType: "image/jpeg",
      fileName: "odometer.jpg",
      reading: null,
    });
  });

  it("reads the dial off the shot the driver takes", async () => {
    reader.recognize.mockResolvedValue(seen("123456"));
    const { tree, onCapture } = renderViewfinder();
    await act(async () => {
      camera.props!.onCameraReady!();
    });

    await act(async () => {
      await shutter(tree).props.onPress();
    });

    expect(reader.recognize).toHaveBeenCalledWith("file:///shot.jpg");
    expect(onCapture).toHaveBeenCalledWith(expect.objectContaining({ reading: 123456 }));
  });

  it("reads the dial off the live preview and moves on once the number settles", async () => {
    camera.takePictureAsync
      .mockResolvedValueOnce(shot("file:///glance-1.jpg"))
      .mockResolvedValueOnce(shot("file:///glance-2.jpg"));
    reader.recognize.mockResolvedValue(seen("123456"));
    const { tree, onCapture } = renderViewfinder({ expected: 123400 });
    await act(async () => {
      camera.props!.onCameraReady!();
    });
    expect(readout(tree)).toHaveLength(0);

    await glanceFor(700);
    expect(caption(tree)).toContain("Hold still…");
    expect(onCapture).not.toHaveBeenCalled();

    await glanceFor(1500);
    expect(caption(tree)).toContain("Got it");
    expect(onCapture).toHaveBeenCalledWith({
      uri: "file:///glance-2.jpg",
      mimeType: "image/jpeg",
      fileName: "odometer.jpg",
      reading: 123456,
    });
    // The glance that became the photo is kept; the one before it is not.
    expect(reader.deleted).toEqual(["file:///glance-1.jpg"]);
    // Nothing keeps glancing once the number is in.
    expect(camera.takePictureAsync).toHaveBeenCalledTimes(2);
    expect(shutter(tree).props.disabled).toBe(true);
  });

  it("keeps looking while the glances disagree", async () => {
    camera.takePictureAsync
      .mockResolvedValueOnce(shot("file:///glance-1.jpg"))
      .mockResolvedValueOnce(shot("file:///glance-2.jpg"))
      .mockResolvedValueOnce(shot("file:///glance-3.jpg"));
    reader.recognize
      .mockResolvedValueOnce(seen("123456"))
      .mockResolvedValueOnce(seen("123457"))
      .mockResolvedValueOnce(seen("123457"));
    const { onCapture } = renderViewfinder();
    await act(async () => {
      camera.props!.onCameraReady!();
    });

    await glanceFor(1000);
    expect(onCapture).not.toHaveBeenCalled();

    await glanceFor(1500);
    expect(onCapture).toHaveBeenCalledWith(
      expect.objectContaining({ uri: "file:///glance-3.jpg", reading: 123457 })
    );
    expect(reader.deleted).toEqual(["file:///glance-1.jpg", "file:///glance-2.jpg"]);
  });

  it("shrugs off a glance the camera or the reader cannot manage", async () => {
    camera.takePictureAsync
      .mockRejectedValueOnce(new Error("busy"))
      .mockResolvedValueOnce(shot("file:///glance-2.jpg"))
      .mockResolvedValueOnce(shot("file:///glance-3.jpg"))
      .mockResolvedValueOnce(shot("file:///glance-4.jpg"));
    reader.recognize
      .mockRejectedValueOnce(new Error("no image"))
      .mockResolvedValue(seen("123456"));
    const { tree, onCapture } = renderViewfinder();
    await act(async () => {
      camera.props!.onCameraReady!();
    });

    await glanceFor(3000);

    expect(caption(tree)).not.toContain("That didn't take");
    expect(onCapture).toHaveBeenCalledWith(
      expect.objectContaining({ uri: "file:///glance-4.jpg", reading: 123456 })
    );
  });

  it("is only a camera on a binary without the reader", async () => {
    reader.available = false;
    const { tree, onCapture } = renderViewfinder();
    await act(async () => {
      camera.props!.onCameraReady!();
    });

    await glanceFor(3000);
    expect(camera.takePictureAsync).not.toHaveBeenCalled();
    expect(caption(tree)).toContain("Fill the frame with the dial");

    await act(async () => {
      await shutter(tree).props.onPress();
    });
    expect(onCapture).toHaveBeenCalledWith(expect.objectContaining({ reading: null }));
    expect(reader.recognize).not.toHaveBeenCalled();
  });

  it("says so and lets the driver try again when a shot fails", async () => {
    camera.takePictureAsync.mockRejectedValueOnce(new Error("capture failed"));
    const { tree, onCapture } = renderViewfinder();
    await act(async () => {
      camera.props!.onCameraReady!();
    });

    await act(async () => {
      await shutter(tree).props.onPress();
    });

    expect(onCapture).not.toHaveBeenCalled();
    expect(caption(tree)).toContain("That didn't take. Try again.");
    expect(shutter(tree).props.disabled).toBe(false);
  });

  it("reports a camera that will not start", () => {
    const { onUnavailable } = renderViewfinder();

    act(() => {
      camera.props!.onMountError!({ message: "Camera could not be started" });
    });

    expect(onUnavailable).toHaveBeenCalledWith("failed");
  });

  it("asks for access once, and reports a refusal", () => {
    camera.permission = { granted: false, canAskAgain: true };
    const { tree, onUnavailable } = renderViewfinder();

    expect(camera.requestPermission).toHaveBeenCalledTimes(1);
    expect(onUnavailable).not.toHaveBeenCalled();

    camera.permission = { granted: false, canAskAgain: false };
    act(() => {
      tree.update(
        <OdometerViewfinder onCapture={vi.fn()} onUnavailable={onUnavailable} />
      );
    });

    expect(camera.requestPermission).toHaveBeenCalledTimes(1);
    expect(onUnavailable).toHaveBeenCalledWith("denied");
  });
});
