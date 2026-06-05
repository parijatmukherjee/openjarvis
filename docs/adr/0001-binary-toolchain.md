# ADR 0001 — Binary toolchain: Bun --compile

**Status:** Accepted (S1.0 spike)

**Decision:** Use `bun build --compile` to produce single-file binaries per OS.

**Evidence:** `dist/probe` built and ran on Darwin arm64, emitting platform + free
disk JSON identical to the Node run (`node packages/core/dist/bin/probe.js`).
`fs.statfs` works inside the Bun binary. Bun version: 1.3.14.

Node run output: `{"os":"macos","shell":"bash","configDir":"/Users/parijatmukherjee/Library/Application Support/openhawkins","freeDiskBytes":1122534903808}`
Bun binary output: `{"os":"macos","shell":"bash","configDir":"/Users/parijatmukherjee/Library/Application Support/openhawkins","freeDiskBytes":1122467028992}`

**Fallback:** Node SEA, if a native-dep blocker appears in a later milestone.
