// The ISO<->CalendarDate boundary, tested on its own.
//
// This module is the whole cost of the decision recorded in date-field.types.ts: the public API
// speaks ISO strings so that no consumer has to install `@internationalized/date` to pass a date
// in. Everything that could go wrong with that translation is pinned here rather than through a
// rendered component, because a malformed string must NOT reach React at all.
import { CalendarDate } from "@internationalized/date";
import { describe, expect, it } from "vitest";
import {
  calendarDateToIso,
  isoToCalendarDate,
  isoToCalendarDateOrThrow,
} from "../src/internal/iso-date.js";

describe("isoToCalendarDate", () => {
  it("parses a well-formed ISO date", () => {
    const parsed = isoToCalendarDate("2026-09-21");
    expect(parsed?.year).toBe(2026);
    expect(parsed?.month).toBe(9);
    expect(parsed?.day).toBe(21);
  });

  it("returns null for null and undefined, so an absent value stays absent", () => {
    expect(isoToCalendarDate(null)).toBeNull();
    expect(isoToCalendarDate(undefined)).toBeNull();
  });

  // `parseDate` THROWS on malformed input. A design system that crashes the host application
  // because a prop held "2026-9-1" instead of "2026-09-01" is a trap, so the unparseable case
  // degrades to "no value" here. It is the one place the ISO decision costs something, and the
  // cost is paid deliberately and in one function rather than at every call site.
  it.each([
    ["", "empty string"],
    ["2026-9-1", "unpadded"],
    ["21/09/2026", "locale format"],
    ["not a date", "free text"],
    ["2026-13-01", "out-of-range month"],
    ["2026-02-30", "impossible day"],
  ])("treats %s (%s) as no value instead of throwing", (input) => {
    expect(() => isoToCalendarDate(input)).not.toThrow();
    expect(isoToCalendarDate(input)).toBeNull();
  });

  it("keeps a date-only string free of any time or zone component", () => {
    const parsed = isoToCalendarDate("2026-09-21");
    // A CalendarDate has no hour/offset at all; asserting on the round trip is what proves the
    // value never silently became a ZonedDateTime in the host's timezone.
    expect(calendarDateToIso(parsed)).toBe("2026-09-21");
  });
});

describe("isoToCalendarDateOrThrow", () => {
  // The strict twin exists for internal call sites that have already validated their input and
  // want a real failure rather than a silent null. Nothing in the public API reaches it.
  it("throws on malformed input", () => {
    expect(() => isoToCalendarDateOrThrow("2026-9-1")).toThrow();
  });

  it("parses a well-formed ISO date", () => {
    expect(isoToCalendarDateOrThrow("2026-09-21").day).toBe(21);
  });
});

describe("calendarDateToIso", () => {
  it("serialises to a zero-padded ISO date", () => {
    expect(calendarDateToIso(new CalendarDate(2026, 1, 5))).toBe("2026-01-05");
  });

  it("returns null for a null date, so a cleared field stays cleared", () => {
    expect(calendarDateToIso(null)).toBeNull();
  });

  it("round-trips every value it can parse", () => {
    for (const iso of ["2026-09-21", "2026-01-05", "1999-12-31", "2000-02-29"]) {
      expect(calendarDateToIso(isoToCalendarDate(iso))).toBe(iso);
    }
  });
});
