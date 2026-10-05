/**
 * @vitest-environment jsdom
 */
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useSession } from "../../src/state/session";

// Taches 2 et 4 : les ids 1..8 couvrent les deux modes (Warsh = 1, Hafs = 2..8).
// Une session persistante qui porte encore un ancien id (2 ou 3, jadis Warsh)
// ne doit donc jamais selectionner une voix de l'autre riwaya.

describe("useSession", () => {
  it("demarre en Warsh avec le recitant 1 et sans verset", () => {
    const { result } = renderHook(() => useSession());
    expect(result.current.state.riwaya).toBe("warsh");
    expect(result.current.state.surah).toBe(1);
    expect(result.current.state.reciter).toBe(1);
    expect(result.current.state.ayah).toBeNull();
  });

  it("revalide un recitant herite sans riwaya contre le mode par defaut", () => {
    // 3 est un id Hafs depuis la T2 : sans riwaya explicite, le mode est Warsh
    // et le recitant doit retomber sur le defaut Warsh (1).
    const { result } = renderHook(() => useSession({ reciter: 3 }));
    expect(result.current.state.riwaya).toBe("warsh");
    expect(result.current.state.reciter).toBe(1);
  });

  it("setSurah efface le verset mais laisse la riwaya", () => {
    const { result } = renderHook(() => useSession());
    act(() => result.current.setSurah(18));
    expect(result.current.state.surah).toBe(18);
    expect(result.current.state.ayah).toBeNull();
    expect(result.current.state.riwaya).toBe("warsh");
  });

  it("setRiwaya bascule en Hafs avec le defaut Hafs, sans verset, en gardant la sourate", () => {
    const { result } = renderHook(() => useSession());
    act(() => result.current.setSurah(18));
    act(() => result.current.setAyah(3));
    act(() => result.current.setRiwaya("hafs"));
    expect(result.current.state.riwaya).toBe("hafs");
    expect(result.current.state.reciter).toBe(2);
    expect(result.current.state.ayah).toBeNull();
    expect(result.current.state.surah).toBe(18);
  });

  it("un aller-retour Warsh -> Hafs -> Warsh remet le recitant Warsh", () => {
    const { result } = renderHook(() => useSession());
    act(() => result.current.setRiwaya("hafs"));
    act(() => result.current.setRiwaya("warsh"));
    expect(result.current.state.riwaya).toBe("warsh");
    expect(result.current.state.reciter).toBe(1);
    expect(result.current.state.ayah).toBeNull();
  });

  it("revalide le recitant memorise au moment du changement de riwaya", () => {
    // 7 est un id Hafs : en repassant en Warsh, il ne peut pas survivre.
    const { result } = renderHook(() => useSession());
    act(() => result.current.setReciter(7));
    act(() => result.current.setRiwaya("warsh"));
    expect(result.current.state.reciter).toBe(1);
  });

  it("n'emmene aucun verset a travers un changement de decoupage", () => {
    const { result } = renderHook(() => useSession());
    act(() => result.current.setAyah(3));
    act(() => result.current.setRiwaya("hafs"));
    expect(result.current.state.ayah).toBeNull();
  });
});
