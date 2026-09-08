import { describe, expect, test } from "bun:test";

import {
  BodyTooLargeError,
  MAX_BODY_BYTES,
  readLimitedBody,
} from "./request-body";

function request(body: string | ReadableStream<Uint8Array>): Request {
  return new Request("https://example.com/api/send", { method: "POST", body });
}

async function expectTooLarge(input: Request): Promise<void> {
  const error: unknown = await readLimitedBody(input).then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(BodyTooLargeError);
}

describe("readLimitedBody", () => {
  test("accepts exactly the byte limit", async () => {
    const body = "a".repeat(MAX_BODY_BYTES);
    expect(await readLimitedBody(request(body))).toBe(body);
  });

  test("rejects oversized bodies without a length header", async () => {
    await expectTooLarge(request("a".repeat(MAX_BODY_BYTES + 1)));
  });

  test("counts bytes rather than characters", async () => {
    await expectTooLarge(request("ä".repeat(MAX_BODY_BYTES)));
  });

  test("cancels a chunked stream immediately on overflow", async () => {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(20_000));
      },
      cancel() {
        cancelled = true;
      },
    });
    await expectTooLarge(request(stream));
    expect(cancelled).toBeTrue();
  });

  test("rejects an oversized declared Content-Length", async () => {
    const input = request("small");
    input.headers.set("Content-Length", String(MAX_BODY_BYTES + 1));
    await expectTooLarge(input);
  });

  test("preserves multibyte characters split across chunks", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([0xc3]));
        controller.enqueue(new Uint8Array([0xa4]));
        controller.close();
      },
    });
    expect(await readLimitedBody(request(stream))).toBe("ä");
  });
});
