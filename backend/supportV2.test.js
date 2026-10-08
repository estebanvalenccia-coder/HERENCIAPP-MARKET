import test from "node:test";
import assert from "node:assert/strict";
import { validateSupportAttachment } from "./supportV2.js";
import { isPrivateSupportStorageKey } from "./supportStorageSecurity.js";

test("valid support image and PDF files pass magic-byte verification", () => {
  const png = "data:image/png;base64," + Buffer.from("89504e470d0a1a0a00000000","hex").toString("base64");
  const pdf = "data:application/pdf;base64," + Buffer.from("%PDF-1.7\nhello").toString("base64");
  assert.equal(validateSupportAttachment(png).mime,"image/png");
  assert.equal(validateSupportAttachment(pdf).mime,"application/pdf");
});
test("spoofed MIME, executable formats and overlarge files are rejected", () => {
  for(const file of [
    "data:image/png;base64," + Buffer.from("<script>alert(1)</script>").toString("base64"),
    "data:text/html;base64," + Buffer.from("<html>").toString("base64"),
    "data:image/jpeg;base64," + Buffer.from("hello world").toString("base64"),
    "data:image/webp;base64," + Buffer.from("WRONG_IMAGE").toString("base64"),
    "data:application/pdf;base64," + Buffer.alloc(1_500_001, 65).toString("base64"),
  ]) assert.throws(()=>validateSupportAttachment(file));
});
test("multi-ticket, media and index keys cannot be fetched through public storage", () => {
  for(const key of ["customerSupportTicketIndex","customerSupportTicket:t_abc",
    "customerSupportAttachment:abc","customerSupport:legacyid","customerSupportIndex"]) {
    assert.equal(isPrivateSupportStorageKey(key),true,key);
  }
  assert.equal(isPrivateSupportStorageKey("siteContent"),false);
});
