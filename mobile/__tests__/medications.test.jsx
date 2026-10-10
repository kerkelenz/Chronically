import { render, screen, waitFor } from "@testing-library/react-native";
import { router, useLocalSearchParams } from "expo-router";
import MedicationsScreen from "../app/(tabs)/medications";

const TECFIDERA = {
  id: 11, name: "Tecfidera", type: "pill", dosage: "240 mg", frequency: "daily",
  scheduledTimes: ["08:00"], active: true, supplyCount: 4, unitsPerDose: 1,
  supply: { daysLeft: 4, status: "low" },
};
const VITAMIN_D = {
  id: 12, name: "Vitamin D", type: "supplement", dosage: "2000 IU", frequency: "daily",
  scheduledTimes: ["08:00"], active: true,
};

jest.mock("../lib/api", () => ({
  __esModule: true,
  default: {
    get: jest.fn(async (url) => {
      if (url.startsWith("/api/medications/logs")) return { data: { logs: [] } };
      if (url.startsWith("/api/medications")) return { data: { medications: [TECFIDERA, VITAMIN_D] } };
      return { data: {} };
    }),
    post: jest.fn(async () => ({ data: {} })),
    put: jest.fn(async () => ({ data: {} })),
    delete: jest.fn(async () => ({ data: {} })),
  },
}));
jest.mock("../lib/analytics", () => ({ track: jest.fn() }));
jest.mock("../components/MedHistorySheet", () => () => null);
jest.mock("../components/SymptomIcon", () => ({ MedicationTypeIcon: () => null }));

beforeEach(() => jest.clearAllMocks());

async function openWith(params) {
  useLocalSearchParams.mockReturnValue(params);
  render(<MedicationsScreen />);
  // loaded once the cabinet header shows both active medications
  await screen.findByText("Medicine cabinet (2)");
}
// read the state the way TalkBack does: the header announces expanded or not.
// (The dosage text is no use here; today's doses list shows it either way.)
const cabinetOpen = () =>
  screen.getByLabelText(/^Medicine cabinet/).props.accessibilityState.expanded;

describe("a refill notification tap", () => {
  it("leaves the cabinet shut on a normal visit", async () => {
    await openWith({});
    expect(cabinetOpen()).toBe(false);
  });

  it("opens the cabinet, where the supply line and Refilled live", async () => {
    await openWith({ medId: "11" });
    await waitFor(() => expect(cabinetOpen()).toBe(true));
  });

  it("clears the param, so coming back to the tab does not reopen it", async () => {
    await openWith({ medId: "11" });
    await waitFor(() => expect(router.setParams).toHaveBeenCalledWith({ medId: undefined }));
  });

  it("leaves it shut for a medication that no longer exists, and still clears", async () => {
    await openWith({ medId: "9999" });
    await waitFor(() => expect(router.setParams).toHaveBeenCalledWith({ medId: undefined }));
    expect(cabinetOpen()).toBe(false);
  });

  it("accepts the array form expo-router can hand over", async () => {
    await openWith({ medId: ["11"] });
    await waitFor(() => expect(cabinetOpen()).toBe(true));
  });
});
