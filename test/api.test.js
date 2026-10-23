const { test, describe, after } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../index");
const pool = require("../db");

describe("API Test Suite", () => {
    after(async () => {
        await pool.end();
    });

    test("GET /health returns 200 and ok status", async () => {
        const res = await request(app).get("/health");
        assert.strictEqual(res.status, 200);
        assert.deepStrictEqual(res.body, { status: "ok" });
    });

    test("POST /signup creates a new user and returns token", async () => {
        const uniqueEmail = `testuser_${Date.now()}@example.com`;
        const res = await request(app)
            .post("/signup")
            .send({
                name: "Test Runner",
                email: uniqueEmail,
                password: "securePassword123!"
            });

        assert.strictEqual(res.status, 201);
        assert.ok(res.body.token, "Expected token in signup response");
        assert.strictEqual(res.body.user.email, uniqueEmail);
    });

    test("POST /login succeeds with correct password", async () => {
        const res = await request(app)
            .post("/login")
            .send({
                email: "arshil@example.com",
                password: "password123"
            });

        assert.strictEqual(res.status, 200);
        assert.ok(res.body.token, "Expected token in login response");
        assert.strictEqual(res.body.user.email, "arshil@example.com");
    });

    test("POST /login fails with wrong password", async () => {
        const res = await request(app)
            .post("/login")
            .send({
                email: "arshil@example.com",
                password: "wrongPassword456!"
            });

        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.body.error, "Invalid credentials");
    });

    test("GET /me fails without authorization token", async () => {
        const res = await request(app).get("/me");
        assert.strictEqual(res.status, 401);
        assert.strictEqual(res.body.error, "Access token required");
    });
});
