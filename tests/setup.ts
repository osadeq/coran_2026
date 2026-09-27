import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Sans ca, le DOM accumule les rendus et les `getByTestId` deviennent ambigus.
afterEach(() => {
  cleanup();
});
