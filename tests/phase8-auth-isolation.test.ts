import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  COOKIE_NAME,
} from "@/lib/auth";
import { POST as postLogin } from "@/app/api/auth/login/route";
import { POST as postSignup } from "@/app/api/auth/signup/route";
import { POST as postLogout } from "@/app/api/auth/logout/route";
import { GET as getHome } from "@/app/api/home/route";

const prisma = new PrismaClient();

describe("Phase 8: User Authentication & Per-User Workspace Data Isolation", () => {
  const testUserAEmail = `auth_tester_a_${Date.now()}@example.com`;
  const testUserBEmail = `auth_tester_b_${Date.now()}@example.com`;
  const testPassword = "securePassword123!";

  let userAId: string;
  let userBId: string;

  beforeAll(async () => {
    // Ensure clean state if needed
  });

  afterAll(async () => {
    // Cleanup created test users and cascaded records
    if (userAId) {
      await prisma.user.delete({ where: { id: userAId } }).catch(() => {});
    }
    if (userBId) {
      await prisma.user.delete({ where: { id: userBId } }).catch(() => {});
    }
    await prisma.$disconnect();
  });

  // ─────────────────────────────────────────────────────────────
  // 1. CRYPTOGRAPHIC PASSWORD HASHING & VERIFICATION
  // ─────────────────────────────────────────────────────────────
  it("hashes password with salt and verifies valid and invalid passwords correctly", () => {
    const hash = hashPassword(testPassword);
    expect(hash).toContain(":");
    const [salt, key] = hash.split(":");
    expect(salt.length).toBe(32); // 16 bytes hex
    expect(key.length).toBe(128); // 64 bytes hex

    // Valid verification
    expect(verifyPassword(testPassword, hash)).toBe(true);

    // Invalid password verification
    expect(verifyPassword("wrongPassword", hash)).toBe(false);
    expect(verifyPassword("", hash)).toBe(false);
  });

  // ─────────────────────────────────────────────────────────────
  // 2. SESSION TOKEN GENERATION & SIGNATURE VERIFICATION
  // ─────────────────────────────────────────────────────────────
  it("generates HMAC-signed session tokens and detects tampering", () => {
    const mockUser = { id: "test-user-id", email: "user@test.com", role: "USER" };
    const token = createSessionToken(mockUser);

    expect(token).toContain(".");
    const verified = verifySessionToken(token);
    expect(verified).not.toBeNull();
    expect(verified?.userId).toBe(mockUser.id);
    expect(verified?.email).toBe(mockUser.email);
    expect(verified?.role).toBe(mockUser.role);

    // Tampered token check
    const tampered = token.slice(0, -4) + "abcd";
    expect(verifySessionToken(tampered)).toBeNull();
  });

  // ─────────────────────────────────────────────────────────────
  // 3. USER SIGNUP API & DEFAULT SPACE CREATION
  // ─────────────────────────────────────────────────────────────
  it("handles POST /api/auth/signup, creates user, default space, and sets auth cookie", async () => {
    const req = new Request("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "User Alpha",
        email: testUserAEmail,
        password: testPassword,
      }),
    });

    const res = await postSignup(req);
    expect(res.status).toBe(201);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.email).toBe(testUserAEmail);
    expect(data.user.name).toBe("User Alpha");
    userAId = data.user.id;

    // Verify session cookie was set
    const setCookie = res.cookies.get(COOKIE_NAME);
    expect(setCookie).toBeDefined();
    expect(setCookie?.value).toBeDefined();

    // Verify user in SQLite has a hashed password (not plaintext!)
    const savedUser = await prisma.user.findUnique({ where: { id: userAId } });
    expect(savedUser?.password).not.toBe(testPassword);
    expect(savedUser?.password).toContain(":");

    // Verify default starter space was created
    const spaces = await prisma.space.findMany({ where: { userId: userAId } });
    expect(spaces.length).toBe(1);
    expect(spaces[0].name).toBe("My First Study Space");
  });

  it("rejects duplicate email signup with 409 status code", async () => {
    const req = new Request("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Duplicate User",
        email: testUserAEmail, // Already registered
        password: testPassword,
      }),
    });

    const res = await postSignup(req);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toContain("already exists");
  });

  // ─────────────────────────────────────────────────────────────
  // 4. USER LOGIN API & INVALID CREDENTIAL REJECTION
  // ─────────────────────────────────────────────────────────────
  it("handles POST /api/auth/login with valid credentials and sets session cookie", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUserAEmail,
        password: testPassword,
      }),
    });

    const res = await postLogin(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.user.id).toBe(userAId);

    const setCookie = res.cookies.get(COOKIE_NAME);
    expect(setCookie).toBeDefined();
  });

  it("rejects invalid password with 401 Unauthorized", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testUserAEmail,
        password: "wrongPassword123",
      }),
    });

    const res = await postLogin(req);
    expect(res.status).toBe(401);
  });

  // ─────────────────────────────────────────────────────────────
  // 5. USER LOGOUT API
  // ─────────────────────────────────────────────────────────────
  it("handles POST /api/auth/logout and clears the session cookie", async () => {
    const res = await postLogout();
    expect(res.status).toBe(200);

    const setCookie = res.cookies.get(COOKIE_NAME);
    expect(setCookie?.value).toBe("");
  });

  // ─────────────────────────────────────────────────────────────
  // 6. MULTI-USER WORKSPACE & PROJECT DATA ISOLATION
  // ─────────────────────────────────────────────────────────────
  it("guarantees strict workspace and project data isolation between User A and User B", async () => {
    // 1. Register User B
    const signupBReq = new Request("http://localhost:3000/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "User Beta",
        email: testUserBEmail,
        password: testPassword,
      }),
    });
    const signupBRes = await postSignup(signupBReq);
    const signupBData = await signupBRes.json();
    userBId = signupBData.user.id;

    // 2. Create custom space and project for User A
    const spaceA = await prisma.space.create({
      data: {
        userId: userAId,
        name: "Advanced Astrophysics Space A",
      },
    });
    const projectA = await prisma.project.create({
      data: {
        userId: userAId,
        spaceId: spaceA.id,
        name: "Black Hole Thermodynamics",
        learningGoal: "Understand Hawking radiation and Bekenstein-Hawking entropy",
      },
    });

    // 3. Create custom space and project for User B
    const spaceB = await prisma.space.create({
      data: {
        userId: userBId,
        name: "Organic Chemistry Space B",
      },
    });
    const projectB = await prisma.project.create({
      data: {
        userId: userBId,
        spaceId: spaceB.id,
        name: "Electrophilic Aromatic Substitution",
        learningGoal: "Understand Friedel-Crafts alkylation mechanisms",
      },
    });

    // 4. Query /api/home as User A using session token
    const tokenA = createSessionToken({ id: userAId, email: testUserAEmail, role: "USER" });
    const homeReqA = new Request("http://localhost:3000/api/home", {
      headers: {
        cookie: `${COOKIE_NAME}=${tokenA}`,
      },
    });
    const homeResA = await getHome(homeReqA);
    expect(homeResA.status).toBe(200);
    const homeDataA = await homeResA.json();

    // User A should ONLY see User A's spaces and projects!
    const userASpaceNames = homeDataA.spaces.map((s: any) => s.name);
    const userAProjectNames = homeDataA.projects.map((p: any) => p.name);

    expect(userASpaceNames).toContain("Advanced Astrophysics Space A");
    expect(userAProjectNames).toContain("Black Hole Thermodynamics");

    // Must NOT contain User B's content!
    expect(userASpaceNames).not.toContain("Organic Chemistry Space B");
    expect(userAProjectNames).not.toContain("Electrophilic Aromatic Substitution");

    // 5. Query /api/home as User B using session token
    const tokenB = createSessionToken({ id: userBId, email: testUserBEmail, role: "USER" });
    const homeReqB = new Request("http://localhost:3000/api/home", {
      headers: {
        cookie: `${COOKIE_NAME}=${tokenB}`,
      },
    });
    const homeResB = await getHome(homeReqB);
    expect(homeResB.status).toBe(200);
    const homeDataB = await homeResB.json();

    // User B should ONLY see User B's spaces and projects!
    const userBSpaceNames = homeDataB.spaces.map((s: any) => s.name);
    const userBProjectNames = homeDataB.projects.map((p: any) => p.name);

    expect(userBSpaceNames).toContain("Organic Chemistry Space B");
    expect(userBProjectNames).toContain("Electrophilic Aromatic Substitution");

    // Must NOT contain User A's content!
    expect(userBSpaceNames).not.toContain("Advanced Astrophysics Space A");
    expect(userBProjectNames).not.toContain("Black Hole Thermodynamics");
  });
});
