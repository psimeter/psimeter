# entropy-provider (Rust sidecar)

A tiny, **zero-dependency** binary that emits **raw, unconditioned** random bytes
from a physical hardware source, so the TypeScript server never needs CPU-specific
code. Small on purpose — the entropy path should be auditable in one sitting.

Currently implements the `rdseed` source: the CPU's on-die thermal-noise entropy
source via the `RDSEED` instruction (a genuine physical, nondeterministic source —
*not* `rdrand`, which is a CSPRNG). It is whitened on-die and vendor-opaque, so
PsyMeter treats it as **pilot-grade / non-confirmatory** (spec D1). No conditioning
is applied here (D10).

```bash
cargo build --release
./target/release/entropy-provider --info        # capabilities + metadata (JSON)
./target/release/entropy-provider --bytes 32    # 32 raw bytes to stdout
```

Exit codes: `0` ok · `1` RDSEED unavailable · `2` bad arguments · `3` write error.

Roadmap: a `usb-trng` source (open-hardware avalanche-noise devices) and, later,
a quantum-RNG source for the confirmatory flagship.
