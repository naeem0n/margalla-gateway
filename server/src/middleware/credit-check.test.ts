import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextFunction, Request, Response } from "express";
import { checkCredits, getCreditStatus, updateCredits } from "./credit-check.js";
import { getDb } from "../db/index.js";

vi.mock("../db/index.js", () => ({
  getDb: vi.fn(),
}));

const getDbMock = getDb as unknown as ReturnType<typeof vi.fn>;

interface FakeDb {
  queryOne: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
}

function makeDb(overrides: Partial<FakeDb> = {}): FakeDb {
  return {
    queryOne: vi.fn().mockResolvedValue(null),
    run: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeReqRes(method = "GET") {
  const req = { method } as Request & { creditInfo?: unknown };
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  const next = vi.fn() as unknown as NextFunction;
  return { req, res, next };
}

function creditsRow(data: Record<string, unknown>) {
  return { setting_value: JSON.stringify(data) };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("checkCredits middleware", () => {
  it("initializes the credit row and allows the first request when none exists", async () => {
    const db = makeDb();
    getDbMock.mockResolvedValue(db);
    const { req, res, next } = makeReqRes("POST");

    await checkCredits(req, res as unknown as Response, next);

    expect(db.run).toHaveBeenCalledTimes(1);
    const [sql] = db.run.mock.calls[0];
    expect(sql).toContain("INSERT INTO system_settings");
    expect(next).toHaveBeenCalledOnce();
  });

  it("returns HTTP 402 when credits are exhausted", async () => {
    const db = makeDb({
      queryOne: vi
        .fn()
        .mockResolvedValue(creditsRow({ total_credits: 5, used_credits: 5, is_active: true })),
    });
    getDbMock.mockResolvedValue(db);
    const { req, res, next } = makeReqRes("POST");

    await checkCredits(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(402);
    expect((res.body as { remaining: number }).remaining).toBe(0);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns HTTP 402 when the subscription is inactive", async () => {
    const db = makeDb({
      queryOne: vi
        .fn()
        .mockResolvedValue(creditsRow({ total_credits: 100, used_credits: 1, is_active: false })),
    });
    getDbMock.mockResolvedValue(db);
    const { req, res, next } = makeReqRes("GET");

    await checkCredits(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(402);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns HTTP 402 when the subscription has expired", async () => {
    const db = makeDb({
      queryOne: vi.fn().mockResolvedValue(
        creditsRow({
          total_credits: 100,
          used_credits: 1,
          is_active: true,
          expiry_date: "2000-01-01T00:00:00.000Z",
        }),
      ),
    });
    getDbMock.mockResolvedValue(db);
    const { req, res, next } = makeReqRes("GET");

    await checkCredits(req, res as unknown as Response, next);

    expect(res.statusCode).toBe(402);
    expect((res.body as { expiry_date: string }).expiry_date).toBe("2000-01-01T00:00:00.000Z");
    expect(next).not.toHaveBeenCalled();
  });

  it("passes read requests through without incrementing usage", async () => {
    const db = makeDb({
      queryOne: vi
        .fn()
        .mockResolvedValue(creditsRow({ total_credits: 100, used_credits: 10, is_active: true })),
    });
    getDbMock.mockResolvedValue(db);
    const { req, res, next } = makeReqRes("GET");

    await checkCredits(req, res as unknown as Response, next);

    expect(db.run).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect((req as { creditInfo?: { remaining: number } }).creditInfo?.remaining).toBe(89);
  });

  it("increments usage for write requests and attaches credit info", async () => {
    const db = makeDb({
      queryOne: vi
        .fn()
        .mockResolvedValue(creditsRow({ total_credits: 100, used_credits: 10, is_active: true })),
    });
    getDbMock.mockResolvedValue(db);
    const { req, res, next } = makeReqRes("POST");

    await checkCredits(req, res as unknown as Response, next);

    expect(db.run).toHaveBeenCalledTimes(1);
    const [, params] = db.run.mock.calls[0];
    expect(JSON.parse((params as unknown[])[0] as string).used_credits).toBe(11);
    expect((req as { creditInfo?: { used: number } }).creditInfo?.used).toBe(11);
    expect(next).toHaveBeenCalledOnce();
  });

  it("fails open (calls next) when the database throws", async () => {
    getDbMock.mockRejectedValue(new Error("db down"));
    const { req, res, next } = makeReqRes("POST");

    await checkCredits(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledOnce();
  });
});

describe("getCreditStatus", () => {
  it("returns full defaults when no credit row exists", async () => {
    getDbMock.mockResolvedValue(makeDb());
    const status = await getCreditStatus();
    expect(status).toMatchObject({ used: 0, percentage: 100, is_active: true });
    expect(status.remaining).toBe(status.total);
  });

  it("computes the remaining percentage from stored values", async () => {
    getDbMock.mockResolvedValue(
      makeDb({
        queryOne: vi
          .fn()
          .mockResolvedValue(creditsRow({ total_credits: 200, used_credits: 50, is_active: true })),
      }),
    );
    const status = await getCreditStatus();
    expect(status.total).toBe(200);
    expect(status.used).toBe(50);
    expect(status.remaining).toBe(150);
    expect(status.percentage).toBe(75);
  });

  it("returns safe defaults when the database throws", async () => {
    getDbMock.mockRejectedValue(new Error("db down"));
    const status = await getCreditStatus();
    expect(status).toMatchObject({ used: 0, percentage: 100, is_active: true });
  });
});

describe("updateCredits", () => {
  it("resets used credits and upserts the new plan", async () => {
    const db = makeDb();
    getDbMock.mockResolvedValue(db);

    await updateCredits(5000, "2030-01-01T00:00:00.000Z", true);

    expect(db.run).toHaveBeenCalledTimes(1);
    const [sql, params] = db.run.mock.calls[0];
    expect(sql).toContain("ON CONFLICT");
    const stored = JSON.parse((params as unknown[])[1] as string);
    expect(stored).toEqual({
      total_credits: 5000,
      used_credits: 0,
      expiry_date: "2030-01-01T00:00:00.000Z",
      is_active: true,
    });
  });
});
