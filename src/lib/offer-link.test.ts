import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { offerFromSearch, offerSearch } from "./offer-link.ts";

describe("offer links", () => {
  const offer = {
    priceCents: 800,
    cadence: "month" as const,
    paymentUrl: "https://buy.stripe.com/test_circle",
    pitch: "Hosting and the quiet fixes.",
  };

  it("round-trips a hosting offer through the public URL", () => {
    const link = offerSearch(offer);
    const query = link.slice(link.indexOf("?"));
    assert.deepEqual(offerFromSearch(query), offer);
  });

  it("drops javascript and non-https payment links", () => {
    assert.equal(offerFromSearch("?pay=javascript:alert(1)&price=800"), null);
    assert.equal(offerFromSearch("?pay=http://example.com/pay&price=500"), null);
  });

  it("ignores a bare visit with no offer", () => {
    assert.equal(offerFromSearch(""), null);
    assert.equal(offerFromSearch("?utm=github"), null);
  });
});
