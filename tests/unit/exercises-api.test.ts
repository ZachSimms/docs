/**
 * The exercise API: route handlers end to end with the model call mocked (`generateText`),
 * plus the guard (origin, size, schema, rate limit), error classification, normalization and
 * the prompts.
 */
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import * as ai from "ai";
import {
  LINKED_LIST_EXERCISE,
  PASSING_REVIEW,
  QUADRATIC_PROBLEM,
  SIGN_SLIP_VERDICT,
} from "../fixtures/exercises";

/** What the mocked `generateText` returns next (or throws), and what it was called with. */
let next: () => unknown = () => ({});
const calls: Record<string, unknown>[] = [];
const generateText = mock(async (options: Record<string, unknown>) => {
  calls.push(options);
  const value = next();
  if (value instanceof Error) throw value;
  // `output` for the constrained path, `text` for the JSON-in-the-prompt one.
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return { output: value, text, response: { modelId: "test/model" } };
});
mock.module("ai", () => ({ ...ai, generateText }));

const { POST: generateCode } = await import("@/app/api/exercises/code/route");
const { POST: repairCode } = await import("@/app/api/exercises/code/repair/route");
const { POST: review } = await import("@/app/api/exercises/code/review/route");
const { POST: generateMath } = await import("@/app/api/exercises/math/route");
const { POST: checkMath } = await import("@/app/api/exercises/math/check/route");
const { GET: status } = await import("@/app/api/exercises/status/route");
const {
  classifyError,
  modelConfig,
  gatewayConfigured,
  whereRunning,
  DEFAULT_MODEL,
  ExerciseError,
  extractJson,
  modelInfo,
  resetModelInfo,
} = await import("@/lib/exercises/ai");
const { allow, resetRateLimits, RATE_LIMITS, clientAddress } =
  await import("@/lib/exercises/guard");
const { normalizeCodeExercise, normalizeMathProblem, normalizeReview, stripFence } =
  await import("@/lib/exercises/normalize");
const prompts = await import("@/lib/exercises/prompts");

/**
 * A POST to one of the routes, from the same origin unless `headers` say otherwise.
 *
 * A plain object with what the handlers read, not a `Request`: happy-dom's `Request` (global in
 * these tests) drops `Origin` and `Host` like a browser does, and the server runtime doesn't.
 */
function post(body: unknown, headers: Record<string, string> = {}): Request {
  const all = new Map(
    Object.entries({
      "content-type": "application/json",
      origin: "http://localhost:3000",
      host: "localhost:3000",
      ...headers,
    }),
  );
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return {
    url: "http://localhost:3000/api/exercises/x/",
    method: "POST",
    headers: { get: (name: string) => all.get(name.toLowerCase()) ?? null },
    text: async () => text,
  } as unknown as Request;
}

/** The model output an exercise came from (the route adds the rest). */
function specOf(exercise: typeof LINKED_LIST_EXERCISE) {
  const { title, summary, brief, requirements, starterCode, tests, hints, solution, concepts } =
    exercise;
  return { title, summary, brief, requirements, starterCode, tests, hints, solution, concepts };
}

/**
 * The gateway's model catalog, as `fetch` serves it in these tests: `supported_parameters` per
 * model id, `null` for a model that doesn't exist; anything else fails like a network error.
 */
const CATALOG: Record<string, string[] | null> = {
  [DEFAULT_MODEL]: ["max_tokens", "tools", "reasoning"],
  "openai/gpt-oss-120b": ["max_tokens", "response_format", "structured_outputs"],
  "a/one": ["response_format"],
  "b/two": ["response_format"],
  "free/plain": ["max_tokens"],
  "gone/model": null,
};
const lookups: string[] = [];
const realFetch = globalThis.fetch;

const savedKey = process.env.AI_GATEWAY_API_KEY;
beforeEach(() => {
  resetModelInfo();
  lookups.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const id = decodeURIComponent(String(input).replace(/^.*\/v1\/models\//, ""));
    lookups.push(id);
    if (!(id in CATALOG)) throw new TypeError("offline");
    const params = CATALOG[id];
    return params === null
      ? new Response(JSON.stringify({ error: { code: "model_not_found" } }), { status: 404 })
      : new Response(JSON.stringify({ id, supported_parameters: params }));
  }) as typeof fetch;
  process.env.AI_GATEWAY_API_KEY = "test-key";
  delete process.env.EXERCISE_MODEL;
  delete process.env.EXERCISE_FALLBACK_MODELS;
  resetRateLimits();
  calls.length = 0;
  generateText.mockClear();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (savedKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
  else process.env.AI_GATEWAY_API_KEY = savedKey;
});

describe("POST /api/exercises/code/", () => {
  it("generates an exercise, cleans it up and adds the request's details", async () => {
    const spec = specOf(LINKED_LIST_EXERCISE);
    next = () => ({ ...spec, solution: `\`\`\`python\n${spec.solution}\`\`\`` });
    const response = await generateCode(
      post({
        request: "I need to practice linked lists",
        language: "python",
        difficulty: "intermediate",
        theme: "linked-lists",
      }),
    );
    expect(response.status).toBe(200);
    const exercise = await response.json();
    expect(exercise).toMatchObject({
      title: spec.title,
      language: "python",
      difficulty: "intermediate",
      theme: "linked-lists",
      size: "exercise",
      request: "I need to practice linked lists",
      model: "test/model",
    });
    expect(exercise.solution).toBe(spec.solution); // the fence is gone
    expect(exercise.id).toMatch(/^[0-9a-f-]{36}$/);
    const call = calls[0];
    expect(call.model).toBe(DEFAULT_MODEL);
    expect(String(call.system)).toContain("assert_equal(actual, expected");
    expect(String(call.prompt)).toContain('"""\nI need to practice linked lists\n"""');
    // The default (free) model has no schema-constrained output: the schema goes in the prompt.
    expect(call.output).toBeUndefined();
    expect(String(call.system)).toContain("It must validate against this JSON Schema");
    expect(String(call.system)).toContain('"starterCode"');
  });

  it("uses the configured model and passes fallbacks to the gateway", async () => {
    process.env.EXERCISE_MODEL = "openai/gpt-oss-120b";
    process.env.EXERCISE_FALLBACK_MODELS = "a/one, b/two ,,openai/gpt-oss-120b";
    next = () => specOf(LINKED_LIST_EXERCISE);
    await generateCode(post({}));
    expect(calls[0].model).toBe("openai/gpt-oss-120b");
    expect(calls[0].providerOptions).toEqual({ gateway: { models: ["a/one", "b/two"] } });
    expect(calls[0].output).toBeDefined(); // every model takes a schema: constrained output
  });

  it("says how to set up the gateway when there are no credentials", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const response = await generateCode(post({}));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "config",
      error: expect.stringContaining("AI_GATEWAY_API_KEY"),
    });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("rejects bad input before calling the model", async () => {
    const cases: [Request, number][] = [
      [post({ language: "cobol" }), 400],
      [post("not json"), 400],
      [post({ request: "x".repeat(501) }), 400],
      [post({}, { origin: "https://evil.example" }), 403],
      [post({}, { origin: "not a url" }), 403],
      [post({ request: "x".repeat(70_000) }), 413],
    ];
    for (const [request, status] of cases) {
      const response = await generateCode(request);
      expect(response.status).toBe(status);
      expect((await response.json()).code).toBe("input");
    }
    expect(generateText).not.toHaveBeenCalled();
  });

  it("retries once when the model's JSON doesn't parse, then gives up with a clear message", async () => {
    process.env.EXERCISE_MODEL = "openai/gpt-oss-120b";
    let n = 0;
    next = () =>
      n++ === 0
        ? new ai.NoObjectGeneratedError({
            message: "bad",
            text: "{",
            response: {} as never,
            usage: {} as never,
            finishReason: "stop",
          })
        : specOf(LINKED_LIST_EXERCISE);
    expect((await generateCode(post({}))).status).toBe(200);
    expect(generateText).toHaveBeenCalledTimes(2);

    generateText.mockClear();
    next = () =>
      new ai.NoObjectGeneratedError({
        message: "bad",
        text: "{",
        response: {} as never,
        usage: {} as never,
        finishReason: "stop",
      });
    const response = await generateCode(post({}));
    expect(response.status).toBe(502);
    expect((await response.json()).code).toBe("model");
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("reads JSON wrapped in prose, fences or thinking from a model without constrained output", async () => {
    const spec = specOf(LINKED_LIST_EXERCISE);
    next = () =>
      `<think>{draft}</think>Sure! Here it is:\n\`\`\`json\n${JSON.stringify(spec)}\n\`\`\`\nEnjoy.`;
    const response = await generateCode(post({}));
    expect(response.status).toBe(200);
    expect((await response.json()).title).toBe(spec.title);
    expect(generateText).toHaveBeenCalledTimes(1);
  });

  it("sends the validation errors back once, and accepts the corrected reply", async () => {
    const spec = specOf(LINKED_LIST_EXERCISE);
    let n = 0;
    next = () => (n++ === 0 ? { ...spec, tests: [] } : spec);
    const response = await generateCode(post({}));
    expect(response.status).toBe(200);
    const followUp = calls[1].messages as { role: string; content: string }[];
    expect(followUp.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(followUp[2].content).toContain("- tests:");
  });

  it("gives up after the corrective turn with a clear message", async () => {
    next = () => "I can't do that.";
    const response = await generateCode(post({}));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ code: "model" });
    expect(generateText).toHaveBeenCalledTimes(2);
  });

  it("says so when the configured model no longer exists, without calling it", async () => {
    process.env.EXERCISE_MODEL = "gone/model";
    const response = await generateCode(post({}));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      code: "config",
      error: expect.stringContaining('"gone/model" isn\'t on the AI Gateway'),
    });
    expect(generateText).not.toHaveBeenCalled();
  });

  it("drops missing fallbacks, and avoids constrained output if a fallback can't do it", async () => {
    process.env.EXERCISE_MODEL = "openai/gpt-oss-120b";
    process.env.EXERCISE_FALLBACK_MODELS = "gone/model, free/plain";
    next = () => specOf(LINKED_LIST_EXERCISE);
    expect((await generateCode(post({}))).status).toBe(200);
    expect(calls[0].providerOptions).toEqual({ gateway: { models: ["free/plain"] } });
    expect(calls[0].output).toBeUndefined();
  });

  it("uses the prompt path when the catalog can't be reached, and asks again next time", async () => {
    process.env.EXERCISE_MODEL = "unknown/offline";
    next = () => specOf(LINKED_LIST_EXERCISE);
    expect((await generateCode(post({}))).status).toBe(200);
    expect(calls[0].output).toBeUndefined();
    await generateCode(post({}));
    expect(lookups.filter((id) => id === "unknown/offline")).toHaveLength(2);
  });

  it("reports what an unrecognized gateway failure said", async () => {
    next = () =>
      Object.assign(new Error("\u001b[31mUpstream provider timed out\u001b[0m"), {
        statusCode: 500,
      });
    const body = await (await generateCode(post({}))).json();
    expect(body).toMatchObject({ code: "upstream" });
    expect(body.error).toBe(
      "The AI service failed (500 Upstream provider timed out). Try again in a moment.",
    );
  });

  it("turns a rejected request into advice to change the model", async () => {
    next = () =>
      Object.assign(new Error("response_format is not supported"), {
        name: "GatewayInvalidRequestError",
        statusCode: 400,
      });
    const body = await (await generateCode(post({}))).json();
    expect(body.code).toBe("config");
    expect(body.error).toContain(
      `refused the request for ${DEFAULT_MODEL} (400 response_format is not supported)`,
    );
    expect(body.error).toContain("EXERCISE_MODEL");
  });

  it("turns a rate limit into a 429 without retrying", async () => {
    next = () =>
      Object.assign(new Error("slow down"), { name: "GatewayRateLimitError", statusCode: 429 });
    const response = await generateCode(post({}));
    expect(response.status).toBe(429);
    expect((await response.json()).code).toBe("busy");
    expect(generateText).toHaveBeenCalledTimes(1);
  });
});

describe("the other routes", () => {
  it("repairs an exercise, keeping its id and request", async () => {
    next = () => ({ ...specOf(LINKED_LIST_EXERCISE), title: "Fixed" });
    const response = await repairCode(
      post({ exercise: LINKED_LIST_EXERCISE, failures: "FAILED x" }),
    );
    const repaired = await response.json();
    expect(repaired).toMatchObject({
      id: LINKED_LIST_EXERCISE.id,
      request: LINKED_LIST_EXERCISE.request,
      title: "Fixed",
    });
    expect(String(calls[0].prompt)).toContain("FAILED x");
  });

  it("reviews code, and never passes it while a test fails", async () => {
    next = () => PASSING_REVIEW;
    const { title, brief, requirements, language, difficulty } = LINKED_LIST_EXERCISE;
    const body = {
      exercise: { title, brief, requirements, language, difficulty },
      code: "print(1)\nprint(2)",
      tests: [
        { name: "a", ok: true },
        { name: "b", ok: false, message: "expected 1, got 2" },
      ],
    };
    const verdict = await (await review(post(body))).json();
    expect(verdict.verdict).toBe("revise");
    expect(String(calls[0].prompt)).toContain("  1 | print(1)");
    expect(String(calls[0].prompt)).toContain("- FAIL b: expected 1, got 2");
    const passing = await (
      await review(post({ ...body, tests: [{ name: "a", ok: true }] }))
    ).json();
    expect(passing.verdict).toBe("pass");
  });

  it("generates a math problem and checks an answer", async () => {
    const { title, statement, answerFormat, answer, hints, solution, concepts } = QUADRATIC_PROBLEM;
    next = () => ({
      title,
      statement,
      answerFormat,
      answer: { ...answer, display: `$${answer.display}$` },
      hints,
      solution,
      concepts,
    });
    const problem = await (await generateMath(post({ area: "equations" }))).json();
    expect(problem).toMatchObject({ area: "equations", difficulty: "beginner", title });
    expect(problem.answer.display).toBe(answer.display);

    next = () => SIGN_SLIP_VERDICT;
    const verdict = await (
      await checkMath(
        post({
          problem: { statement, answerFormat, answer, solution },
          answer: "x = 3",
          working: "x + 3 = 0 so x = 3",
        }),
      )
    ).json();
    expect(verdict).toEqual(SIGN_SLIP_VERDICT);
    expect(String(calls[1].prompt)).toContain("x + 3 = 0 so x = 3");
  });
});

describe("guard", () => {
  it("limits requests per client and window", () => {
    const { max, windowMs } = RATE_LIMITS.generate;
    for (let i = 0; i < max; i++) expect(allow("generate", "1.2.3.4", 1000)).toBe(true);
    expect(allow("generate", "1.2.3.4", 1000)).toBe(false);
    expect(allow("generate", "5.6.7.8", 1000)).toBe(true);
    expect(allow("check", "1.2.3.4", 1000)).toBe(true);
    expect(allow("generate", "1.2.3.4", 1000 + windowMs)).toBe(true);
  });

  it("answers 429 once a client is over the limit", async () => {
    next = () => SIGN_SLIP_VERDICT;
    const { statement, answerFormat, answer, solution } = QUADRATIC_PROBLEM;
    const body = { problem: { statement, answerFormat, answer, solution }, answer: "1" };
    for (let i = 0; i < RATE_LIMITS.check.max; i++)
      await checkMath(post(body, { "x-forwarded-for": "9.9.9.9" }));
    const response = await checkMath(post(body, { "x-forwarded-for": "9.9.9.9, 10.0.0.1" }));
    expect(response.status).toBe(429);
  });

  it("reads the client address from the proxy headers", () => {
    const at = (headers: Record<string, string>) => clientAddress(post({}, headers));
    expect(at({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" })).toBe("1.1.1.1");
    expect(at({ "x-real-ip": "3.3.3.3" })).toBe("3.3.3.3");
    expect(at({})).toBe("local");
  });
});

describe("classifyError", () => {
  const named = (name: string, extra: Record<string, unknown> = {}) =>
    Object.assign(new Error("x"), { name, ...extra });

  it("maps gateway failures to what the learner can do about them", () => {
    expect(classifyError(named("GatewayAuthenticationError")).code).toBe("config");
    expect(classifyError(named("GatewayModelNotFoundError")).message).toContain("EXERCISE_MODEL");
    expect(classifyError(named("X", { statusCode: 402 })).message).toContain("free credits");
    expect(classifyError(named("TimeoutError")).status).toBe(504);
    expect(classifyError(new Error("?")).code).toBe("upstream");
    const known = new ExerciseError("input", "no", 400);
    expect(classifyError(known)).toBe(known);
  });

  it("looks inside retry errors and causes", () => {
    const wrapped = Object.assign(new Error("retry"), {
      name: "AI_RetryError",
      lastError: named("X", { statusCode: 429 }),
    });
    expect(classifyError(wrapped).code).toBe("busy");
    const caused = new Error("outer", { cause: named("GatewayAuthenticationError") });
    expect(classifyError(caused).code).toBe("config");
    const listed = Object.assign(new Error("all"), {
      errors: [new Error("a"), named("X", { statusCode: 401 })],
    });
    expect(classifyError(listed).code).toBe("config");
  });
});

describe("model catalog and JSON extraction", () => {
  it("caches what the gateway says about a model", async () => {
    expect(await modelInfo("openai/gpt-oss-120b")).toEqual({ exists: true, structured: true });
    expect(await modelInfo("openai/gpt-oss-120b")).toEqual({ exists: true, structured: true });
    expect(await modelInfo(DEFAULT_MODEL)).toEqual({ exists: true, structured: false });
    expect(await modelInfo("gone/model")).toEqual({ exists: false, structured: false });
    expect(await modelInfo("unknown/offline")).toEqual({ exists: null, structured: false });
    expect(lookups.filter((id) => id === "openai/gpt-oss-120b")).toHaveLength(1);
  });

  it("finds the JSON object in a reply", () => {
    expect(extractJson('{"a": 1}')).toEqual({ a: 1 });
    expect(extractJson('text ```json\n{"a": {"b": [1]}}\n``` text')).toEqual({ a: { b: [1] } });
    expect(extractJson('<think>{"a": 0}</think>{"a": 2}')).toEqual({ a: 2 });
    expect(extractJson("none")).toBeUndefined();
    expect(extractJson("{broken")).toBeUndefined();
    expect(extractJson("} {")).toBeUndefined();
  });
});

describe("configuration", () => {
  it("defaults to the free model and reads overrides", () => {
    expect(modelConfig({})).toEqual({ model: DEFAULT_MODEL, fallbacks: [] });
    expect(modelConfig({ EXERCISE_MODEL: " m/x ", EXERCISE_FALLBACK_MODELS: "m/y,m/x" })).toEqual({
      model: "m/x",
      fallbacks: ["m/y"],
    });
  });

  it("accepts an API key or Vercel's OIDC token", () => {
    expect(gatewayConfigured({})).toBe(false);
    expect(gatewayConfigured({ AI_GATEWAY_API_KEY: " " })).toBe(false);
    expect(gatewayConfigured({ AI_GATEWAY_API_KEY: "k" })).toBe(true);
    expect(gatewayConfigured({ VERCEL_OIDC_TOKEN: "t" })).toBe(true);
  });

  it("lets a Vercel deployment try OIDC, whose token comes with the request, not the environment", () => {
    expect(gatewayConfigured({ VERCEL: "1" })).toBe(true);
    expect(whereRunning({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe(
      'the Vercel "preview" environment',
    );
    expect(whereRunning({})).toBe("this server");
  });

  it("explains a missing or rejected credential", () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const missing = classifyError(
      Object.assign(new Error("x"), { name: "GatewayAuthenticationError" }),
    );
    expect(missing.message).toContain("AI_GATEWAY_API_KEY isn't set there");
    expect(missing.message).toContain("/api/exercises/status/");
    process.env.AI_GATEWAY_API_KEY = "stale";
    const rejected = classifyError(Object.assign(new Error("x"), { statusCode: 401 }));
    expect(rejected.message).toContain("rejected the AI_GATEWAY_API_KEY");
  });
});

describe("GET /api/exercises/status/", () => {
  /** A GET with the given headers (a plain object, like `post`). */
  const get = (headers: Record<string, string> = {}) =>
    ({
      headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    }) as unknown as Request;

  it("reports what the deployment sees, without secrets", async () => {
    process.env.AI_GATEWAY_API_KEY = "secret-key";
    const body = await status(get()).json();
    expect(body).toMatchObject({
      ready: true,
      auth: "api-key",
      apiKey: true,
      model: DEFAULT_MODEL,
    });
    expect(JSON.stringify(body)).not.toContain("secret-key");
  });

  it("sees the OIDC token Vercel sends with the request", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    expect(await status(get()).json()).toMatchObject({ ready: false, auth: "none" });
    const body = await status(get({ "x-vercel-oidc-token": "t0ken" })).json();
    expect(body).toMatchObject({ ready: true, auth: "oidc", oidc: true });
    expect(JSON.stringify(body)).not.toContain("t0ken");
  });
});

describe("normalize", () => {
  it("strips a fence around the whole code, and only then", () => {
    expect(stripFence("```python\nx = 1\n```")).toBe("x = 1");
    expect(stripFence("~~~\na\n~~~\n")).toBe("a");
    expect(stripFence("x = 1\n```\ny\n```")).toBe("x = 1\n```\ny\n```");
  });

  it("ends code with one newline and trims tests", () => {
    const spec = normalizeCodeExercise({
      ...specOf(LINKED_LIST_EXERCISE),
      starterCode: "a\n\n\n",
      tests: [{ name: " n ", code: "\n```\nx\n```\n" }],
    });
    expect(spec.starterCode).toBe("a\n");
    expect(spec.tests).toEqual([{ name: "n", code: "x" }]);
  });

  it("revises a review with an unmet requirement", () => {
    const unmet = { ...PASSING_REVIEW, requirements: [{ requirement: "r", met: false, note: "" }] };
    expect(normalizeReview(unmet, [{ ok: true }]).verdict).toBe("revise");
    expect(normalizeReview(PASSING_REVIEW, []).verdict).toBe("revise");
  });

  it("sends a numeric answer with no values to the model", () => {
    const { title, statement, answerFormat, hints, solution, concepts } = QUADRATIC_PROBLEM;
    const spec = normalizeMathProblem({
      title,
      statement,
      answerFormat,
      hints,
      solution,
      concepts,
      answer: { kind: "numeric", display: "$2x$", values: [], tolerance: 0 },
    });
    expect(spec.answer).toEqual({ kind: "expression", display: "2x", values: [], tolerance: 0 });
  });
});

describe("prompts", () => {
  it("describes each language's test helpers and file", () => {
    expect(prompts.codeSystemPrompt("python")).toContain("solution.py");
    expect(prompts.codeSystemPrompt("typescript")).toContain("assertThrows(fn, ErrorClass?");
    expect(prompts.codeSystemPrompt("typescript")).toContain("no type annotations");
  });

  it("asks for a mini-project in parts and avoids recent titles", () => {
    const prompt = prompts.codePrompt({
      request: "",
      theme: "classes",
      difficulty: "advanced",
      language: "javascript",
      size: "project",
      avoid: ["Old one"],
    });
    expect(prompt).toContain("### Part 1");
    expect(prompt).toContain("Theme: Classes and object-oriented design.");
    expect(prompt).toContain('"Old one"');
    expect(prompt).not.toContain('"""');
  });

  it("describes a math request", () => {
    const prompt = prompts.mathPrompt({
      request: "dice",
      area: "probability",
      difficulty: "advanced",
      avoid: [],
    });
    expect(prompt).toContain("Area: Probability and counting.");
    expect(prompt).toContain("competition-style");
    expect(prompt).toContain('"""\ndice\n"""');
  });
});
