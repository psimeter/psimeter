"""PsyMeter analysis pipeline (Phase 1 skeleton).

Authoritative statistics are computed HERE, in Python, over the published raw
ledger — never trusting the live server (spec §8.1). This starter script:

  1. Re-verifies the ledger hash-chain INDEPENDENTLY of the TypeScript
     implementation. The canonical form below must match
     packages/core/src/canonicalize.ts byte-for-byte; reproducing a matching
     `entryHash` is the cross-language reproducibility check (pillar 4).
  2. Recomputes per-session z-scores and the Stouffer-combined z.

The core checks use only the Python standard library, so they run with no
dependencies. numpy / scipy (requirements.txt) are reserved for the richer
analyses to come (calibrated null, variance/tail tests, per-operator reliability).
"""

from __future__ import annotations

import hashlib
import json
import math
import sys
from pathlib import Path

GENESIS_PREV = "sha256:" + "0" * 64


def canonicalize(obj) -> str:
    """Mirror of packages/core/src/canonicalize.ts: sorted keys, integers only,
    compact separators, non-ASCII preserved. Floats are rejected by contract."""
    _reject_floats(obj)
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _reject_floats(obj) -> None:
    if isinstance(obj, float):
        raise ValueError("floats are not allowed in committed payloads")
    if isinstance(obj, dict):
        for v in obj.values():
            _reject_floats(v)
    elif isinstance(obj, list):
        for v in obj:
            _reject_floats(v)


def sha256_str(s: str) -> str:
    return "sha256:" + hashlib.sha256(s.encode("utf-8")).hexdigest()


def entry_hash(e: dict) -> str:
    return sha256_str(
        canonicalize(
            {
                "seq": e["seq"],
                "ts": e["ts"],
                "prevHash": e["prevHash"],
                "type": e["type"],
                "payload": e["payload"],
            }
        )
    )


def verify_chain(entries: list[dict]) -> int:
    """Return the index of the first bad entry, or -1 if the chain is intact."""
    for i, e in enumerate(entries):
        expected_seq = 0 if i == 0 else entries[i - 1]["seq"] + 1
        expected_prev = GENESIS_PREV if i == 0 else entries[i - 1]["entryHash"]
        if e["seq"] != expected_seq:
            return i
        if e["prevHash"] != expected_prev:
            return i
        if entry_hash(e) != e["entryHash"]:
            return i
    return -1


def session_z(ones: int, n: int) -> float:
    return (ones - n * 0.5) / math.sqrt(n * 0.25)


def two_sided_p(z: float) -> float:
    return math.erfc(abs(z) / math.sqrt(2))


def main(path: str) -> int:
    entries = [json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]
    print(f"ledger entries: {len(entries)}")

    bad = verify_chain(entries)
    if bad >= 0:
        print(f"chain integrity: BROKEN at index {bad}")
        return 1
    print("chain integrity: OK (re-derived independently in Python)")

    zs: list[float] = []
    for e in entries:
        if e["type"] == "session.seal":
            p = e["payload"]
            z = session_z(p["ones"], p["nSamples"])
            zs.append(z)
            print(
                f"  session {p['sessionId'][:8]}  ones={p['ones']}/{p['nSamples']}  "
                f"z={z:+.3f}  p={two_sided_p(z):.3f}"
            )

    if zs:
        combined = sum(zs) / math.sqrt(len(zs))
        print(f"Stouffer combined z over {len(zs)} session(s): {combined:+.3f}  (p={two_sided_p(combined):.3f})")
    else:
        print("no sealed sessions found")
    return 0


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "ledger/dev.jsonl"
    sys.exit(main(target))
