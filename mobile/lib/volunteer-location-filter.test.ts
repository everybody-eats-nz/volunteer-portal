import { beforeEach, describe, expect, it, vi } from "vitest";

const getItemMock = vi.fn();
const setItemMock = vi.fn();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: (...args: unknown[]) => getItemMock(...args),
    setItem: (...args: unknown[]) => setItemMock(...args),
  },
}));

import { useVolunteerLocationFilter } from "@/lib/volunteer-location-filter";

describe("useVolunteerLocationFilter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The store is a module-level singleton; reset it between tests.
    useVolunteerLocationFilter.setState({
      selected: null,
      hasChosen: false,
      hydrated: false,
    });
    getItemMock.mockResolvedValue(null);
    setItemMock.mockResolvedValue(undefined);
  });

  it("persists an explicit pick, including 'All locations' (null)", () => {
    const { setSelected } = useVolunteerLocationFilter.getState();

    setSelected("Wellington");
    expect(useVolunteerLocationFilter.getState()).toMatchObject({
      selected: "Wellington",
      hasChosen: true,
    });
    expect(setItemMock).toHaveBeenCalledWith(
      "@ee/volunteer_location_filter_v1",
      JSON.stringify({ selected: "Wellington" })
    );

    setSelected(null);
    expect(useVolunteerLocationFilter.getState()).toMatchObject({
      selected: null,
      hasChosen: true,
    });
    expect(setItemMock).toHaveBeenLastCalledWith(
      "@ee/volunteer_location_filter_v1",
      JSON.stringify({ selected: null })
    );
  });

  it("hydrates a saved pick from storage", async () => {
    getItemMock.mockResolvedValue(JSON.stringify({ selected: "Onehunga" }));

    await useVolunteerLocationFilter.getState().hydrate();

    expect(useVolunteerLocationFilter.getState()).toMatchObject({
      selected: "Onehunga",
      hasChosen: true,
      hydrated: true,
    });
  });

  it("leaves hasChosen false when nothing was saved, so the profile default applies", async () => {
    await useVolunteerLocationFilter.getState().hydrate();

    expect(useVolunteerLocationFilter.getState()).toMatchObject({
      selected: null,
      hasChosen: false,
      hydrated: true,
    });
  });

  it("does not clobber a pick made before hydration resolves", async () => {
    let resolveRead!: (value: string) => void;
    getItemMock.mockReturnValue(
      new Promise<string>((resolve) => {
        resolveRead = resolve;
      })
    );

    const hydration = useVolunteerLocationFilter.getState().hydrate();
    useVolunteerLocationFilter.getState().setSelected("Glen Innes");
    resolveRead(JSON.stringify({ selected: "Wellington" }));
    await hydration;

    expect(useVolunteerLocationFilter.getState()).toMatchObject({
      selected: "Glen Innes",
      hasChosen: true,
      hydrated: true,
    });
  });

  it("survives corrupted storage", async () => {
    getItemMock.mockResolvedValue("not-json{");

    await useVolunteerLocationFilter.getState().hydrate();

    expect(useVolunteerLocationFilter.getState()).toMatchObject({
      selected: null,
      hasChosen: false,
      hydrated: true,
    });
  });
});
