const { describe, test } = require("node:test");
const assert = require("node:assert");
const axios = require("axios");
const Webhook = require("../../../server/notification-providers/webhook");

// Adversarial message contents: every one of these must survive payload
// construction and a JSON round-trip unchanged (issue #3778 invariant suite).
const ADVERSARIAL_STRINGS = [
    { name: "newlines", value: "line1\nline2\rline3\n\nlast" },
    { name: "double-quotes", value: 'He said "Production API" is down' },
    { name: "single-quotes", value: "user's 'service' failed" },
    { name: "backslashes", value: "C:\\path\\to\\file\\na? \\n is literal" },
    { name: "control-chars", value: "tab\there bell\u0007 nul\u0000 ansi\u001b[0m" },
    { name: "unicode-emoji", value: "日本語 🎉 𝄞 café ünïcödé" },
    { name: "rtl", value: "العربية مرحبا ‏ עברית" },
    { name: "lone-surrogate", value: "abc\ud800def" },
    { name: "json-like", value: '{"fake": "json", "breaks": [\n]}' },
    { name: "template-like", value: "{{ not liquid }} {% raw %} {{msg}}" },
    { name: "line-separators", value: "sep \u2028 and \u2029 here" },
    { name: "quotes-and-braces", value: `{[]}<>&"'\\/` },
    { name: "very-long", value: "x".repeat(50000) + "\n" + "y".repeat(50000) },
];

/**
 * Mock axios.post / axios.get for the duration of fn, capturing requests.
 * No test ever performs a real network call.
 * @param {Function} fn Test body, receives {requests, restore}
 * @returns {Promise<any>} result of fn
 */
async function withMockedAxios(fn) {
    const requests = [];
    const originalPost = axios.post;
    const originalGet = axios.get;

    axios.post = async (url, data, config) => {
        requests.push({ method: "post", url, data, config });
        return { data: { ok: true }, status: 200 };
    };
    axios.get = async (url, config) => {
        requests.push({ method: "get", url, config });
        return { data: { ok: true }, status: 200 };
    };

    try {
        return await fn(requests);
    } finally {
        axios.post = originalPost;
        axios.get = originalGet;
    }
}

function sampleMonitor(extra = {}) {
    return { id: 7, name: "Test Monitor", type: "ping", hostname: "example.com", ...extra };
}

function sampleHeartbeat(extra = {}) {
    return {
        status: 0,
        time: "2023-09-20T14:51:51.000Z",
        timezone: "UTC",
        localDateTime: "2023-09-20 14:51:51",
        ...extra,
    };
}

describe("Webhook payload construction invariants (issue #3778)", () => {
    const webhook = new Webhook();
    const url = "https://example.com/webhook";

    describe("default JSON object mode", () => {
        test("send() payload is always an object with exactly msg/heartbeat/monitor keys, even when heartbeat/monitor are null", async () => {
            await withMockedAxios(async (requests) => {
                await webhook.send({ webhookURL: url, httpMethod: "post" }, "plain test notification", null, null);

                assert.strictEqual(requests.length, 1, "exactly one request is made");
                assert.strictEqual(typeof requests[0].data, "object");
                assert.deepStrictEqual(Object.keys(requests[0].data).sort(), ["heartbeat", "monitor", "msg"]);
                assert.strictEqual(requests[0].data.heartbeat, null);
                assert.strictEqual(requests[0].data.monitor, null);
            });
        });

        for (const { name, value } of ADVERSARIAL_STRINGS) {
            test(`send() payload stays valid JSON with exact msg round-trip for content: ${name}`, async () => {
                await withMockedAxios(async (requests) => {
                    await webhook.send({ webhookURL: url }, value, sampleMonitor(), sampleHeartbeat({ msg: value }));

                    const json = JSON.stringify(requests[0].data);
                    const parsed = JSON.parse(json); // throws if payload is not valid JSON
                    assert.strictEqual(parsed.msg, value);
                });
            });
        }

        test("send() heartbeat and monitor fields round-trip deeply including adversarial string values", async () => {
            await withMockedAxios(async (requests) => {
                const value = 'multi\nline "quoted" C:\\path\ttab 日本語';
                const monitor = sampleMonitor({ name: value });
                const heartbeat = sampleHeartbeat({ msg: value });
                await webhook.send({ webhookURL: url }, value, monitor, heartbeat);

                const parsed = JSON.parse(JSON.stringify(requests[0].data));
                assert.deepStrictEqual(parsed.monitor, monitor);
                assert.deepStrictEqual(parsed.heartbeat, heartbeat);
                assert.strictEqual(parsed.monitor.name, value);
                assert.ok(parsed.heartbeat.msg.includes("\n"), "newlines survive round-trip");
            });
        });

        test("send() never mutates the caller-provided monitorJSON/heartbeatJSON objects", async () => {
            await withMockedAxios(async () => {
                const monitor = sampleMonitor();
                const heartbeat = sampleHeartbeat({ msg: "down\n\n\n" });
                const monitorBefore = JSON.parse(JSON.stringify(monitor));
                const heartbeatBefore = JSON.parse(JSON.stringify(heartbeat));

                await webhook.send({ webhookURL: url }, "msg with \n newline", monitor, heartbeat);

                assert.deepStrictEqual(monitor, monitorBefore);
                assert.deepStrictEqual(heartbeat, heartbeatBefore);
            });
        });

        test("send() falls back to default object mode for absent or unknown webhookContentType", async () => {
            await withMockedAxios(async (requests) => {
                for (const contentType of [undefined, "", "application/json", "json"]) {
                    await webhook.send({ webhookURL: url, httpMethod: "post", webhookContentType: contentType }, "m", null, null);
                }

                for (const req of requests) {
                    assert.strictEqual(typeof req.data, "object");
                    assert.deepStrictEqual(Object.keys(req.data).sort(), ["heartbeat", "monitor", "msg"]);
                }
            });
        });
    });

    describe("http method resolution", () => {
        test("send() treats only case-insensitive GET as GET, everything else as POST", async () => {
            await withMockedAxios(async (requests) => {
                for (const method of [undefined, null, "post", "POST", "Post", "put", "PATCH "]) {
                    await webhook.send({ webhookURL: url, httpMethod: method }, "m", null, null);
                }
                for (const method of ["get", "GET", "Get"]) {
                    await webhook.send({ webhookURL: url, httpMethod: method }, "m", null, null);
                }

                assert.deepStrictEqual(
                    requests.map((r) => r.method),
                    ["post", "post", "post", "post", "post", "post", "post", "get", "get", "get"]
                );
            });
        });

        test("send() in GET mode takes precedence over webhookContentType (custom body is not rendered)", async () => {
            await withMockedAxios(async (requests) => {
                await webhook.send(
                    {
                        webhookURL: url,
                        httpMethod: "get",
                        webhookContentType: "custom",
                        webhookCustomBody: '{"never":"rendered"}',
                    },
                    "msg\nwith newline",
                    sampleMonitor(),
                    null
                );

                assert.strictEqual(requests[0].method, "get");
                assert.strictEqual(requests[0].config.params.msg, "msg\nwith newline");
            });
        });
    });

    describe("GET mode params", () => {
        test("send() GET params.msg is the raw string, byte-for-byte, regardless of content", async () => {
            await withMockedAxios(async (requests) => {
                const value = 'line1\nline2 "q" \t 日本語 {"json": true}';
                await webhook.send({ webhookURL: url, httpMethod: "get" }, value, null, null);

                assert.strictEqual(requests[0].config.params.msg, value);
            });
        });

        test("send() GET heartbeat/monitor params are JSON strings that parse back to the originals", async () => {
            await withMockedAxios(async (requests) => {
                const monitor = sampleMonitor({ name: 'Monitor "X"\nwith newline' });
                const heartbeat = sampleHeartbeat({ msg: 'down: "refused"\nagain' });
                await webhook.send({ webhookURL: url, httpMethod: "get" }, "msg", monitor, heartbeat);

                const params = requests[0].config.params;
                assert.strictEqual(typeof params.heartbeat, "string");
                assert.strictEqual(typeof params.monitor, "string");
                assert.deepStrictEqual(JSON.parse(params.heartbeat), heartbeat);
                assert.deepStrictEqual(JSON.parse(params.monitor), monitor);
            });
        });

        test("send() GET omits heartbeat/monitor params when they are null", async () => {
            await withMockedAxios(async (requests) => {
                await webhook.send({ webhookURL: url, httpMethod: "get" }, "msg only", null, null);

                const params = requests[0].config.params;
                assert.strictEqual("heartbeat" in params, false);
                assert.strictEqual("monitor" in params, false);
                assert.strictEqual(params.msg, "msg only");
            });
        });
    });

    describe("form-data mode", () => {
        test("send() form-data field 'data' is valid JSON with full msg/heartbeat/monitor round-trip", async () => {
            await withMockedAxios(async (requests) => {
                const value = 'Error:\n"timeout"\nretrying 日本語 \\ back';
                const monitor = sampleMonitor();
                const heartbeat = sampleHeartbeat({ msg: value });
                await webhook.send(
                    { webhookURL: url, httpMethod: "post", webhookContentType: "form-data" },
                    value,
                    monitor,
                    heartbeat
                );

                const req = requests[0];
                assert.strictEqual(typeof req.data, "object");
                assert.strictEqual(req.data.constructor.name, "FormData");

                // form-data stores [header, value, null] for string fields
                const raw = req.data._streams[1];
                assert.strictEqual(typeof raw, "string");
                const parsed = JSON.parse(raw);
                assert.deepStrictEqual(Object.keys(parsed).sort(), ["heartbeat", "monitor", "msg"]);
                assert.strictEqual(parsed.msg, value);
                assert.deepStrictEqual(parsed.monitor, monitor);
                assert.deepStrictEqual(parsed.heartbeat, heartbeat);
            });
        });

        test("send() form-data sets multipart content-type header with boundary", async () => {
            await withMockedAxios(async (requests) => {
                await webhook.send({ webhookURL: url, webhookContentType: "form-data" }, "msg\n", null, null);

                const contentType = requests[0].config.headers["content-type"];
                assert.ok(/multipart\/form-data; boundary=/.test(contentType), `unexpected content-type: ${contentType}`);
            });
        });
    });

    describe("custom body template mode", () => {
        test("send() custom body is the rendered template string passed through unescaped and unmodified", async () => {
            await withMockedAxios(async (requests) => {
                const msg = 'down & <broken> "quoted"\nnext';
                const monitor = sampleMonitor({ name: "API \"Prod\"" });
                await webhook.send(
                    {
                        webhookURL: url,
                        webhookContentType: "custom",
                        webhookCustomBody: "Status={{status}} Name={{name}} Msg={{msg}}",
                    },
                    msg,
                    monitor,
                    null
                );

                assert.strictEqual(typeof requests[0].data, "string");
                assert.strictEqual(requests[0].data, `Status=⚠️ Test Name=API "Prod" Msg=${msg}`);
            });
        });

        for (const { name, value } of ADVERSARIAL_STRINGS) {
            test(`send() custom body |json_escape produces valid JSON with exact round-trip for content: ${name}`, async () => {
                await withMockedAxios(async (requests) => {
                    await webhook.send(
                        {
                            webhookURL: url,
                            webhookContentType: "custom",
                            webhookCustomBody: '{"message": "{{msg | json_escape}}", "monitor": "{{monitorJSON.name | json_escape}}"}',
                        },
                        value,
                        sampleMonitor({ name: value }),
                        null
                    );

                    const parsed = JSON.parse(requests[0].data); // throws if not valid JSON
                    assert.strictEqual(parsed.message, value);
                    assert.strictEqual(parsed.monitor, value);
                });
            });
        }

        test("send() custom body |json_escape renders null/undefined values as empty string (documented)", async () => {
            await withMockedAxios(async (requests) => {
                await webhook.send(
                    {
                        webhookURL: url,
                        webhookContentType: "custom",
                        webhookCustomBody: '{"monitor": "{{monitorJSON.name | json_escape}}"}',
                    },
                    "msg",
                    sampleMonitor({ name: null }),
                    null
                );

                const parsed = JSON.parse(requests[0].data);
                assert.strictEqual(parsed.monitor, "");
            });
        });

        test("send() custom body |json_escape on a non-string object falls back to String() conversion (documented pitfall)", async () => {
            await withMockedAxios(async (requests) => {
                await webhook.send(
                    {
                        webhookURL: url,
                        webhookContentType: "custom",
                        webhookCustomBody: '{"monitor": "{{monitorJSON | json_escape}}"}',
                    },
                    "msg",
                    sampleMonitor(),
                    null
                );

                const parsed = JSON.parse(requests[0].data);
                assert.strictEqual(parsed.monitor, "[object Object]");
            });
        });

        test("send() custom body |json filter embeds valid JSON values for strings and objects", async () => {
            await withMockedAxios(async (requests) => {
                const msg = 'Error:\n"timeout"\n日本語 \\ back';
                const monitor = sampleMonitor();
                const heartbeat = sampleHeartbeat({ msg });
                await webhook.send(
                    {
                        webhookURL: url,
                        webhookContentType: "custom",
                        webhookCustomBody: '{"message": {{msg | json}}, "monitor": {{monitorJSON | json}}, "heartbeat": {{heartbeatJSON | json}}}',
                    },
                    msg,
                    monitor,
                    heartbeat
                );

                const parsed = JSON.parse(requests[0].data);
                assert.strictEqual(parsed.message, msg);
                assert.deepStrictEqual(parsed.monitor, monitor);
                assert.deepStrictEqual(parsed.heartbeat, heartbeat);
            });
        });

        test("send() custom body |json filter produces a valid JSON value (null) for undefined properties — KNOWN BUG, currently fails", async () => {
            await withMockedAxios(async (requests) => {
                await webhook.send(
                    {
                        webhookURL: url,
                        webhookContentType: "custom",
                        webhookCustomBody: '{"interval": {{monitorJSON.nonexistent | json}}}',
                    },
                    "msg",
                    sampleMonitor(),
                    null
                );

                // The `json` filter is documented as "full JSON serialization",
                // so the rendered body must always be parseable. JSON.stringify(undefined)
                // is undefined, which liquidjs renders as an empty string -> `{"interval": }`.
                assert.doesNotThrow(() => JSON.parse(requests[0].data), `rendered body was: ${requests[0].data}`);
                assert.deepStrictEqual(JSON.parse(requests[0].data), { interval: null });
            });
        });
    });

    describe("headers and request contract", () => {
        test("send() merges webhookAdditionalHeaders into config headers without touching the body", async () => {
            await withMockedAxios(async (requests) => {
                const monitor = sampleMonitor();
                await webhook.send(
                    {
                        webhookURL: url,
                        webhookAdditionalHeaders: '{"X-Token":"abc123","Content-Type":"application/json"}',
                    },
                    "msg with \n newline",
                    monitor,
                    null
                );

                const req = requests[0];
                assert.strictEqual(req.config.headers["X-Token"], "abc123");
                assert.strictEqual(req.config.headers["Content-Type"], "application/json");
                assert.deepStrictEqual(req.data, { heartbeat: null, monitor, msg: "msg with \n newline" });
            });
        });

        test("send() rejects invalid webhookAdditionalHeaders with a clear error and sends nothing", async () => {
            await withMockedAxios(async (requests) => {
                await assert.rejects(
                    () => webhook.send({ webhookURL: url, webhookAdditionalHeaders: "{not json" }, "msg", null, null),
                    { message: "Additional Headers is not a valid JSON" }
                );
                assert.strictEqual(requests.length, 0, "no request may be sent when payload construction fails");
            });
        });

        test("send() resolves with the success marker only after a successful request", async () => {
            await withMockedAxios(async () => {
                const ok = await webhook.send({ webhookURL: url }, "msg\n", null, null);
                assert.strictEqual(ok, "Sent Successfully.");
            });
        });

        test("send() propagates transport failures as thrown errors (never a false success)", async () => {
            const originalPost = axios.post;
            axios.post = async () => {
                const err = new Error("connect ECONNREFUSED");
                err.code = "ECONNREFUSED";
                throw err;
            };
            try {
                await assert.rejects(() => webhook.send({ webhookURL: url }, "msg", null, null), {
                    message: /ECONNREFUSED/,
                });
            } finally {
                axios.post = originalPost;
            }
        });
    });
});
