import { describe, expect, it } from "vitest";
import { suiteClassName, suiteToolLabel } from "./suites";

describe("suite helpers", () => {
  it("returns stable suite theme classes", () => {
    expect(suiteClassName("pdf")).toBe("suite-pdf");
    expect(suiteClassName("image")).toBe("suite-image");
  });

  it("returns display labels for suite navigation", () => {
    expect(suiteToolLabel("pdf")).toBe("PDF");
    expect(suiteToolLabel("image")).toBe("Image");
  });
});
