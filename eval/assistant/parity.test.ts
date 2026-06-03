// Test de PARITÉ (anti-dérive). Tourne en CI (vitest).
// - unit : l'extracteur gère Args multi-lignes ET sur une seule ligne ;
// - live : chaque outil adossé à une RPC couvre TOUS les params de la RPC réelle (types.ts).
//   Si une migration ajoute un param et qu'on oublie l'outil → ce test CASSE.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { extractRpcArgs, checkParity, WRITE_TOOL_PARITY } from "./parity.manifest";

const FIXTURE = `
    Functions: {
      create_admin_payment: {
        Args: {
          p_user_id: string
          p_amount_xaf: number
          p_rate_is_custom?: boolean
        }
        Returns: Json
      }
      update_rate_adjustment: {
        Args: { p_adjustment_id: string; p_percentage: number }
        Returns: Json
      }
    }
`;

describe("extractRpcArgs", () => {
  it("Args multi-lignes", () => {
    expect(extractRpcArgs(FIXTURE, "create_admin_payment").sort()).toEqual(["p_amount_xaf", "p_rate_is_custom", "p_user_id"]);
  });
  it("Args sur une seule ligne (inline)", () => {
    expect(extractRpcArgs(FIXTURE, "update_rate_adjustment").sort()).toEqual(["p_adjustment_id", "p_percentage"]);
  });
  it("fonction inconnue → []", () => { expect(extractRpcArgs(FIXTURE, "inconnue")).toEqual([]); });
});

describe("checkParity", () => {
  it("signale un param RPC non couvert (dérive)", () => {
    const r = checkParity(FIXTURE, { tool: "x", rpc: "create_admin_payment", exposes: ["p_user_id"], omits: {} });
    expect(r.missing).toContain("p_amount_xaf");
    expect(r.missing).toContain("p_rate_is_custom");
  });
  it("OK quand exposes ∪ omits couvre tout", () => {
    const r = checkParity(FIXTURE, { tool: "x", rpc: "update_rate_adjustment", exposes: ["p_adjustment_id"], omits: { p_percentage: "raison" } });
    expect(r.missing).toEqual([]);
  });
});

describe("PARITÉ LIVE (types.ts réel) — anti-dérive", () => {
  const src = readFileSync(new URL("../../src/integrations/supabase/types.ts", import.meta.url), "utf8");
  for (const e of WRITE_TOOL_PARITY) {
    it(`${e.tool} ↔ ${e.rpc} : aucun param RPC oublié`, () => {
      const r = checkParity(src, e);
      expect(r.rpcFound, `RPC ${e.rpc} introuvable dans types.ts (régénérer via /gen-types ?)`).toBe(true);
      expect(r.missing, `params RPC ni exposés ni omis: ${r.missing.join(", ")}`).toEqual([]);
    });
  }
});
