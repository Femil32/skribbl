import { describe, expect, it } from "vitest";
import { floodFillRgbaInPlace, hexToRgbTriplet } from "./flood-fill";

describe("floodFillRgbaInPlace", () => {
  it("fills a 3x3 uniform region with a new color", () => {
    const width = 3;
    const height = 3;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 10;
      data[i + 1] = 20;
      data[i + 2] = 30;
      data[i + 3] = 255;
    }
    floodFillRgbaInPlace(data, width, height, 1, 1, 99, 88, 77, 255);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        expect(data[i]).toBe(99);
        expect(data[i + 1]).toBe(88);
        expect(data[i + 2]).toBe(77);
        expect(data[i + 3]).toBe(255);
      }
    }
  });
});

describe("hexToRgbTriplet", () => {
  it("parses #RRGGBB", () => {
    expect(hexToRgbTriplet("#aabbcc")).toEqual([170, 187, 204]);
  });
});
