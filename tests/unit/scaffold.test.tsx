/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/App";

describe("scaffold", () => {
  it("affiche le titre", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /coran/i })).toBeInTheDocument();
  });
});
