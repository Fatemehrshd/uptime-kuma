# Webhook Payload Invariants — Report (issue #3778)

Branch: `fix/webhook-multiline-payload`
Scope: payload-construction logic in `server/notification-providers/webhook.js` (+ custom-body rendering via `NotificationProvider.renderTemplate` in `server/notification-providers/notification-provider.js`).
Main code: **zero lines changed**.

All tests live in one new file:
`test/backend-test/notification-providers/test-webhook-payload-invariants.js`
(46 tests; framework: `node:test` + `node:assert`, same conventions as the rest of `test/backend-test/`).
`axios.post`/`axios.get` are monkey-patched in every test — **no test ever performs a real network request**.

Run:

```bash
TEST_BACKEND=1 node --test "test/backend-test/notification-providers/test-webhook-payload-invariants.js"
# or: npm run test-backend
```

Current result: **45 pass / 1 fail** (the failing test asserts a genuine invariant violation found during this review; see Invariant 22 and the Bug section).

## Invariants and status

### Default JSON object mode

| # | Invariant | Test (name in file) | Status |
|---|-----------|---------------------|--------|
| 1 | Payload is always a plain object with exactly the keys `msg`, `heartbeat`, `monitor`; the latter two are present as `null` when not provided | `send() payload is always an object with exactly msg/heartbeat/monitor keys, even when heartbeat/monitor are null` | pass |
| 2 | The payload is always serializable to valid JSON **and** `msg` survives round-trip byte-for-byte, regardless of content (newlines, `\r`, `"`/`'`, backslashes, control chars incl. NUL/ESC, unicode/emoji/RTL, lone surrogate, JSON-like or Liquid-like text, U+2028/U+2029, 100k-char strings) | 13 generated tests: `send() payload stays valid JSON with exact msg round-trip for content: <class>` | pass |
| 3 | Nested `heartbeat`/`monitor` fields deep round-trip, including adversarial string values (also applies to monitor name, heartbeat msg) | `send() heartbeat and monitor fields round-trip deeply including adversarial string values` | pass |
| 4 | `send()` never mutates the caller's `monitorJSON`/`heartbeatJSON` objects | `send() never mutates the caller-provided monitorJSON/heartbeatJSON objects` | pass |
| 5 | Any absent/unknown `webhookContentType` falls back to the default object mode | `send() falls back to default object mode for absent or unknown webhookContentType` | pass |

### HTTP method resolution

| # | Invariant | Test | Status |
|---|-----------|------|--------|
| 6 | Method detection is case-insensitive; only exact (case-insensitive) `get` uses the GET path, everything else (incl. garbage) POSTs | `send() treats only case-insensitive GET as GET, everything else as POST` | pass |
| 7 | GET takes precedence over `webhookContentType` (custom template is never rendered for GET) | `send() in GET mode takes precedence over webhookContentType (custom body is not rendered)` | pass |

### GET mode params

| # | Invariant | Test | Status |
|---|-----------|------|--------|
| 8 | `params.msg` is the raw string, exact regardless of newlines/quotes/content | `send() GET params.msg is the raw string, byte-for-byte, regardless of content` | pass |
| 9 | `params.heartbeat`/`params.monitor` are JSON strings that parse back to the originals | `send() GET heartbeat/monitor params are JSON strings that parse back to the originals` | pass |
| 10 | `heartbeat`/`monitor` params are omitted (not `null`, not `"null"`) when the objects are absent | `send() GET omits heartbeat/monitor params when they are null` | pass |

### form-data mode

| # | Invariant | Test | Status |
|---|-----------|------|--------|
| 11 | The multipart `data` field is valid JSON with full `msg`/`heartbeat`/`monitor` round-trip | `send() form-data field 'data' is valid JSON with full msg/heartbeat/monitor round-trip` | pass |
| 12 | A `multipart/form-data; boundary=…` content-type header is set | `send() form-data sets multipart content-type header with boundary` | pass |

### Custom body template mode (core of issue #3778)

| # | Invariant | Test | Status |
|---|-----------|------|--------|
| 13 | Body is the rendered template string passed through **unescaped/unmodified** (no hidden HTML/url escaping by Liquid) | `send() custom body is the rendered template string passed through unescaped and unmodified` | pass |
| 14 | With `| json_escape`, embedding `msg`/`monitorJSON.name` inside a JSON string literal **always yields valid JSON that parses back to the exact original** — for every adversarial content class | 13 generated tests: `send() custom body \|json_escape produces valid JSON with exact round-trip for content: <class>` | pass |
| 15 | `json_escape` of `null`/`undefined` renders empty string (documented; safe inside quoted contexts) | `send() custom body \|json_escape renders null/undefined values as empty string (documented)` | pass |
| 16 | `json_escape` of a non-string object degrades to `String(value)` = `"[object Object]"` (documented pitfall; use `| json` for objects) | `send() custom body \|json_escape on a non-string object falls back to String() conversion (documented pitfall)` | pass |
| 17 | With `| json`, string/object/null values embed as valid JSON literals that parse back exactly | `send() custom body \|json filter embeds valid JSON values for strings and objects` | pass |
| 22 | **BUG** — see below | `send() custom body \|json filter produces a valid JSON value (null) for undefined properties — KNOWN BUG, currently fails` | **fail** |

### Headers / request contract

| # | Invariant | Test | Status |
|---|-----------|------|--------|
| 18 | Additional headers are merged into the axios config **without touching the body** | `send() merges webhookAdditionalHeaders into config headers without touching the body` | pass |
| 19 | Invalid `webhookAdditionalHeaders` throws `"Additional Headers is not a valid JSON"` and **no request is sent** | `send() rejects invalid webhookAdditionalHeaders with a clear error and sends nothing` | pass |
| 20 | `send()` resolves with `"Sent Successfully."` only after the request went out | `send() resolves with the success marker only after a successful request` | pass |
| 21 | Transport failure never looks like success — it is rethrown (with error code) | `send() propagates transport failures as thrown errors (never a false success)` | pass |

## Bug found (asserted, not fixed)

**Invariant violated:** the `json` filter added by this branch is documented as "full JSON serialization", so `{{ x | json }}` should always produce a parseable JSON value.

**Actual behavior:** for an `undefined` value (e.g. a missing property, `{{ monitorJSON.nonexistent | json }}`), `JSON.stringify(undefined)` returns `undefined`, which Liquid renders as an **empty string** — the custom body becomes `{"interval": }`, i.e. invalid JSON, silently sent to the webhook endpoint.

**Location:** `server/notification-providers/notification-provider.js:96-98` (`json` filter). Note the filter is applied to context values that may be `undefined` for missing properties.

**Suggested fix (not applied, per task constraints):** `return JSON.stringify(value === undefined ? null : value);`

**Test:** `send() custom body |json filter produces a valid JSON value (null) for undefined properties — KNOWN BUG, currently fails`
Assertion output at time of writing: `Unexpected token '}', "{"interval": }" is not valid JSON`.

## Notes

- Invariants 14/17 confirm the actual fix of issue #3778 (multiline/quote-bearing `msg` in custom JSON bodies) works via the new `json_escape`/`json` filters. The bare `{{msg}}` in a custom JSON body remains the user's responsibility (documented behavior, invariant 13 intentionally asserts raw pass-through).
- Existing branch tests in `test-webhook.js` (3 tests) continue to pass unchanged.
