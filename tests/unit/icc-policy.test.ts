// WP-16 unit tests for the ICC enforcement policy module (D9).
// TDD: written BEFORE scripts/media/icc-policy.ts exists — RED first, then the
// module is implemented to satisfy these contracts. Decision authority:
// ADR-011 (interpretation frozen: valid source ICC → convert to sRGB; untagged
// = documented assume-sRGB limitation, NOT proven truth; no camera-model
// guessing) + docs/implementation/decisions/ICC-POLICY.md (D9 = enforcement
// mode only).
import { describe, expect, test } from "vitest";
import {
  DEFAULT_UNTAGGED_ENFORCEMENT_MODE,
  ICC_ENFORCEMENT_MODES,
  evaluateIccSource,
} from "../../scripts/media/icc-policy";

describe("ICC enforcement policy (D9)", () => {
  test("declares exactly the three candidate enforcement modes", () => {
    expect([...ICC_ENFORCEMENT_MODES]).toEqual(["assume", "warn", "fail"]);
  });

  test("default mode is the D9 choice: 'assume' (silent, documented)", () => {
    // Pin: ICC-POLICY.md records untagged_enforcement_mode = "assume".
    expect(DEFAULT_UNTAGGED_ENFORCEMENT_MODE).toBe("assume");
  });

  test("a valid source ICC always converts to sRGB, regardless of mode", () => {
    for (const mode of ICC_ENFORCEMENT_MODES) {
      const decision = evaluateIccSource({ hasValidIcc: true }, mode);
      expect(decision.action).toBe("convert-srgb");
      expect(decision.log).toBeNull();
    }
  });

  test("mode 'assume': untagged source proceeds silently, no log entry", () => {
    const decision = evaluateIccSource({ hasValidIcc: false }, "assume");
    expect(decision.action).toBe("assume-srgb");
    expect(decision.log).toBeNull();
  });

  test("mode 'warn': untagged source proceeds but emits a warn log entry", () => {
    const decision = evaluateIccSource({ hasValidIcc: false }, "warn");
    expect(decision.action).toBe("assume-srgb");
    expect(decision.log).not.toBeNull();
    expect(decision.log?.level).toBe("warn");
    expect(decision.log?.code).toBe("ICC_UNTAGGED_ASSUMED_SRGB");
    expect(decision.log?.message).toMatch(/untagged/i);
    expect(decision.log?.message).toMatch(/sRGB/i);
  });

  test("mode 'fail': untagged source is rejected (fail closed)", () => {
    const decision = evaluateIccSource({ hasValidIcc: false }, "fail");
    expect(decision.action).toBe("fail");
  });

  test("omitted mode resolves to the pinned D9 default ('assume')", () => {
    expect(evaluateIccSource({ hasValidIcc: false })).toEqual(
      evaluateIccSource({ hasValidIcc: false }, "assume"),
    );
    expect(evaluateIccSource({ hasValidIcc: false }).action).toBe("assume-srgb");
    expect(evaluateIccSource({ hasValidIcc: false }).log).toBeNull();
  });

  test("no decision path invents a color space from camera data (ADR-011)", () => {
    // The decision surface only ever sees ICC presence and the mode — there is
    // no input by which a camera model could be guessed, and no log message
    // claims proven truth about untagged pixels.
    for (const mode of ICC_ENFORCEMENT_MODES) {
      const decision = evaluateIccSource({ hasValidIcc: false }, mode);
      expect(decision.log?.message ?? "").not.toMatch(/camera|model|make/i);
      if (decision.log) {
        // The honest phrasing: assumption, explicitly NOT proven truth.
        expect(decision.log.message).toMatch(/assume|not proven truth/i);
      }
    }
  });
});
