import { describe, expect, it } from "vitest";
import {
  assignedHoursFromQuoteEstimateOrSubtasks,
  parseProjectHours,
  sumSubtaskEstimatedHours,
} from "@/lib/project-hours";

describe("project assigned hours display helpers", () => {
  it("uses the related quote estimate when a quote is connected", () => {
    expect(
      assignedHoursFromQuoteEstimateOrSubtasks(
        { total_estimated_hours: "7.50" },
        [{ estimated_hours: 2 }, { estimated_hours: 3 }],
      ),
    ).toBe(7.5);
  });

  it("falls back to summed subtask estimates when no quote is connected", () => {
    expect(
      assignedHoursFromQuoteEstimateOrSubtasks(null, [
        { estimated_hours: "1.25" },
        { estimated_hours: 2 },
        { estimated_hours: null },
      ]),
    ).toBe(3.25);
  });

  it("treats invalid hour values as zero", () => {
    expect(parseProjectHours("not-a-number")).toBe(0);
    expect(sumSubtaskEstimatedHours([{ estimated_hours: "bad" }, { estimated_hours: "4" }])).toBe(4);
  });
});
