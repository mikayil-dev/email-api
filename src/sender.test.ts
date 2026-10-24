import { describe, expect, test } from "bun:test";

import { listSenders, switchSharedSender } from "./sender";

const oldSmtp = { host: "old.example.com", user: "old@example.com" };
const own = { host: "own.example.com", user: "own@example.com" };
const raw = {
  smtp: oldSmtp,
  sites: {
    "https://keep.example": { name: "Keep", toEmail: "keep@example.com" },
    "https://www.keep.example": { name: "Keep", toEmail: "keep@example.com" },
    "https://client.example": { name: "Client", toEmail: "c@example.com" },
    "https://own.example": { name: "Own", toEmail: "o@example.com", smtp: own },
  },
};
const change = {
  host: "mail.example.net",
  port: 587,
  user: "forms@example.net",
  pass: "secret",
  fromEmail: "forms@example.net",
  fromName: "Forms",
  keepOrigins: ["https://keep.example"],
};

describe("switchSharedSender", () => {
  test("switches the shared sender and pins kept origins to the old one", () => {
    const result = switchSharedSender(raw, change);
    expect(result.kept).toEqual([
      "https://keep.example",
      "https://www.keep.example",
    ]);
    expect(listSenders(result.config)).toEqual([
      {
        origin: "https://keep.example",
        fromEmail: "old@example.com",
        toEmail: "keep@example.com",
        override: true,
      },
      {
        origin: "https://www.keep.example",
        fromEmail: "old@example.com",
        toEmail: "keep@example.com",
        override: true,
      },
      {
        origin: "https://client.example",
        fromEmail: "forms@example.net",
        toEmail: "c@example.com",
        override: false,
      },
      {
        origin: "https://own.example",
        fromEmail: "own@example.com",
        toEmail: "o@example.com",
        override: true,
      },
    ]);
  });

  test("never pins the new account and keeps existing overrides", () => {
    const once = switchSharedSender(raw, change).config;
    const twice = switchSharedSender(once, change);
    expect(twice.kept).toEqual([]);
    expect(twice.config.sites).toEqual(once.sites);
  });
});
