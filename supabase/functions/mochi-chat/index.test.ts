/**
 * Unit tests for mochi-chat pure helpers. Runs without network or DB.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

import { detectParkFromMessage } from "./park-detection.ts";
import { isEmergency, buildEmergencyText } from "./emergency.ts";
import { getPermitWindowStatus, KNOWN_PERMIT_WINDOWS } from "./permit-windows.ts";

Deno.test("detectParkFromMessage finds park by primary name", () => {
  assertEquals(detectParkFromMessage([{ role: "user", content: "How's Yosemite today?" }]), "yosemite");
});

Deno.test("detectParkFromMessage finds park by landmark alias", () => {
  assertEquals(detectParkFromMessage([{ role: "user", content: "any updates on Angels Landing?" }]), "zion");
  assertEquals(detectParkFromMessage([{ role: "user", content: "Half Dome cables status?" }]), "yosemite");
});

Deno.test("detectParkFromMessage uses the most recent user message", () => {
  const messages = [
    { role: "user", content: "tell me about zion" },
    { role: "assistant", content: "..." },
    { role: "user", content: "actually, what about glacier?" },
  ];
  assertEquals(detectParkFromMessage(messages), "glacier");
});

Deno.test("detectParkFromMessage returns null when no keyword matches", () => {
  assertEquals(detectParkFromMessage([{ role: "user", content: "hi there" }]), null);
});

Deno.test("isEmergency catches keyword variants", () => {
  assertEquals(isEmergency("I'm injured"), true);
  assertEquals(isEmergency("having chest pain right now"), true);
  assertEquals(isEmergency("can't breathe"), true);
  assertEquals(isEmergency("which trail should I take?"), false);
});

Deno.test("buildEmergencyText leads with primary park line when known", () => {
  const text = buildEmergencyText("yosemite");
  assertEquals(text.includes("Yosemite: 209-379-3119 ← your park"), true);
  assertEquals(text.startsWith("This sounds like an emergency. Call 911 immediately."), true);
});

Deno.test("buildEmergencyText falls back to generic list for unknown park", () => {
  const text = buildEmergencyText(null);
  assertEquals(text.includes("Park emergency lines:"), true);
  assertEquals(text.includes("← your park"), false);
});

Deno.test("getPermitWindowStatus classifies windows correctly", () => {
  const halfDomePreseason = KNOWN_PERMIT_WINDOWS.find((w) => w.name === "Pre-season lottery")!;
  // Pre-season runs Mar 1–31. Test against fixed dates.
  assertEquals(getPermitWindowStatus(halfDomePreseason, new Date(2026, 1, 15)), "UPCOMING"); // Feb 15
  assertEquals(getPermitWindowStatus(halfDomePreseason, new Date(2026, 2, 15)), "OPEN");     // Mar 15
  assertEquals(getPermitWindowStatus(halfDomePreseason, new Date(2026, 5, 1)), "PAST");      // Jun 1
});
