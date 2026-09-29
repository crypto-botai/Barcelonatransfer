import { describe, it, expect } from "vitest";
import {
  endpointMoved,
  effectiveEndpoint,
  differenceFromQuote,
  SAME_PLACE_DEGREES,
} from "@/lib/journey-edit";

/**
 * Whether an endpoint really moved decides whether the booking is requoted,
 * and requoting reprices it at today's table rather than the fare the
 * customer agreed. Getting this wrong in either direction costs money: too
 * eager and an untouched booking is silently reprised, too lax and a genuine
 * change of destination is carried at the old fare.
 */

const BCN_AIRPORT = { address: "Barcelona El Prat Airport (BCN), Terminal 1", lat: 41.2971, lng: 2.0785 };

describe("an endpoint the office did not touch", () => {
  it("has not moved when no proposal was sent", () => {
    expect(endpointMoved(BCN_AIRPORT, null)).toBe(false);
    expect(endpointMoved(BCN_AIRPORT, undefined)).toBe(false);
  });

  it("keeps the stored endpoint byte for byte", () => {
    expect(effectiveEndpoint(BCN_AIRPORT, null)).toEqual(BCN_AIRPORT);
  });

  it("has not moved when the same suggestion is re-picked", () => {
    expect(endpointMoved(BCN_AIRPORT, { ...BCN_AIRPORT })).toBe(false);
  });

  /** Geocoders disagree slightly about the same address between calls. */
  it("tolerates provider jitter below the threshold", () => {
    const jittered = {
      ...BCN_AIRPORT,
      lat: BCN_AIRPORT.lat + SAME_PLACE_DEGREES / 2,
      lng: BCN_AIRPORT.lng - SAME_PLACE_DEGREES / 2,
    };
    expect(endpointMoved(BCN_AIRPORT, jittered)).toBe(false);
  });

  it("ignores whitespace and casing", () => {
    expect(endpointMoved(BCN_AIRPORT, {
      ...BCN_AIRPORT,
      address: "  barcelona el prat airport (BCN),   Terminal 1 ",
    })).toBe(false);
  });
});

describe("an endpoint the office changed", () => {
  it("moves when the address text is different", () => {
    expect(endpointMoved(BCN_AIRPORT, { ...BCN_AIRPORT, address: "Hotel Arts Barcelona" })).toBe(true);
  });

  it("moves when the coordinates are meaningfully different", () => {
    expect(endpointMoved(BCN_AIRPORT, { ...BCN_AIRPORT, lat: 41.3851, lng: 2.1734 })).toBe(true);
  });

  /**
   * Terminal 1 to Terminal 2 is the same airport, a different pick-up point,
   * and about 3 km apart. It must count as a move.
   */
  it("moves between two terminals of the same airport", () => {
    expect(endpointMoved(BCN_AIRPORT, {
      address: "Barcelona El Prat Airport (BCN), Terminal 2",
      lat: 41.3031, lng: 2.0787,
    })).toBe(true);
  });

  it("returns the new endpoint, trimmed", () => {
    const picked = { address: "  Hotel Arts Barcelona  ", lat: 41.3859, lng: 2.1966 };
    expect(effectiveEndpoint(BCN_AIRPORT, picked)).toEqual({
      address: "Hotel Arts Barcelona", lat: 41.3859, lng: 2.1966,
    });
  });
});

describe("what a requote does to the fare", () => {
  it("reports the rise when the new journey costs more", () => {
    expect(differenceFromQuote(65, 95)).toEqual({ oldTotal: 65, newTotal: 95, difference: 30 });
  });

  it("reports a fall as a negative difference", () => {
    expect(differenceFromQuote(95, 65)).toEqual({ oldTotal: 95, newTotal: 65, difference: -30 });
  });

  it("reports no difference when the price is unchanged", () => {
    expect(differenceFromQuote(80, 80).difference).toBe(0);
  });

  /**
   * The old total is what is on the booking, not a recomputation of it: a
   * fare the office adjusted by hand must not be quietly undone.
   */
  it("takes the old total as given, even when it is not a round quote", () => {
    expect(differenceFromQuote(72.5, 80)).toEqual({ oldTotal: 72.5, newTotal: 80, difference: 7.5 });
  });

  it("does not accumulate floating point noise", () => {
    expect(differenceFromQuote(0.1 + 0.2, 0.3).difference).toBe(0);
    expect(differenceFromQuote(19.99, 29.98).difference).toBe(9.99);
  });
});
