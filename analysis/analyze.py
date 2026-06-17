"""PsyMeter analysis pipeline (Phase 1).

Authoritative statistics are computed HERE, in Python, over the *published*
ledger - never trusting the live server (spec §8.1). This script:

  1. Re-verifies the ledger hash-chain INDEPENDENTLY of the TypeScript collector.
     The canonical form below must match packages/core/src/canonicalize.ts
     byte-for-byte; re-deriving a matching `entryHash` is the cross-language
     reproducibility check (pillar 4).
  2. Joins each `session.seal` to its `session.open` to recover the declared
     intention, then reports per-session and intention-aware aggregates
     (the directional HIGH/LOW effect, Stouffer-combined).

Uses only the Python standard library, so anyone can re-run it with a bare
install. EXPLORATORY by construction - this is not the pre-registered
confirmatory test (spec §5, D3).
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
            {"seq": e["seq"], "ts": e["ts"], "prevHash": e["prevHash"], "type": e["type"], "payload": e["payload"]}
        )
    )


def verify_chain(entries: list[dict]) -> int:
    for i, e in enumerate(entries):
        expected_seq = 0 if i == 0 else entries[i - 1]["seq"] + 1
        expected_prev = GENESIS_PREV if i == 0 else entries[i - 1]["entryHash"]
        if e["seq"] != expected_seq or e["prevHash"] != expected_prev or entry_hash(e) != e["entryHash"]:
            return i
    return -1


def session_z(ones: int, n: int) -> float:
    return (ones - n * 0.5) / math.sqrt(n * 0.25)


def phi(z: float) -> float:
    """Standard-normal CDF."""
    return 0.5 * math.erfc(-z / math.sqrt(2))


def stouffer(zs: list[float]) -> float:
    return sum(zs) / math.sqrt(len(zs))


def merkle_root(leaves: list[bytes]) -> str:
    """Domain-separated Merkle root mirroring packages/core/src/merkle.ts."""
    if not leaves:
        raise ValueError("no leaves")
    level = [hashlib.sha256(b"\x00" + leaf).digest() for leaf in leaves]
    while len(level) > 1:
        nxt = []
        for i in range(0, len(level), 2):
            if i + 1 < len(level):
                nxt.append(hashlib.sha256(b"\x01" + level[i] + level[i + 1]).digest())
            else:
                nxt.append(level[i])
        level = nxt
    return "sha256:" + level[0].hex()


def main(path: str) -> int:
    entries = [json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]
    print(f"ledger entries: {len(entries)}")

    bad = verify_chain(entries)
    if bad >= 0:
        print(f"chain integrity: BROKEN at index {bad}")
        return 1
    print("chain integrity: OK (re-derived independently in Python)\n")

    opens = {e["payload"]["sessionId"]: e["payload"] for e in entries if e["type"] == "session.open"}
    seals = [e["payload"] for e in entries if e["type"] == "session.seal"]

    print(f"{'session':10}{'intent':9}{'source':9}{'ones / N':>16}{'z':>9}{'dir-z':>8}{'p(1-tail)':>11}")
    print("-" * 72)
    by_intent: dict[str, list[float]] = {"HIGH": [], "LOW": [], "BASELINE": []}
    directional: list[float] = []
    n_confirmatory = 0
    for s in seals:
        op = opens.get(s["sessionId"], {})
        intent = op.get("intention", "?")
        src = op.get("entropySource", {})
        srcid, conf = src.get("id", "?"), src.get("confirmatory", False)
        n_confirmatory += 1 if conf else 0
        z = session_z(s["ones"], s["nSamples"])
        dirz = z if intent == "HIGH" else (-z if intent == "LOW" else None)
        if intent in by_intent:
            by_intent[intent].append(z)
        p1 = "" if dirz is None else f"{1 - phi(dirz):.3f}"
        dz = "" if dirz is None else f"{dirz:+.2f}"
        if dirz is not None:
            directional.append(dirz)
        print(f"{s['sessionId'][:8]:10}{intent:9}{srcid:9}{s['ones']:>8}/{s['nSamples']:<7}{z:>+9.3f}{dz:>8}{p1:>11}")

    dangling = [sid for sid in opens if sid not in {s["sessionId"] for s in seals}]
    if dangling:
        print(f"\n({len(dangling)} open session(s) with no seal - abandoned/in-progress, not scored)")

    print("\naggregates (EXPLORATORY - not the pre-registered confirmatory test):")
    for intent in ("HIGH", "LOW"):
        zs = by_intent[intent]
        if zs:
            print(f"  {intent:9} n={len(zs):<3} Stouffer z = {stouffer(zs):+.3f}")
    if directional:
        dz = stouffer(directional)
        print(f"  intended-direction (HIGH & LOW)  n={len(directional):<3} z = {dz:+.3f}  one-tailed p = {1 - phi(dz):.3f}")

    # raw-data verification (spec D2): the stored blob must reproduce BOTH the
    # flat SHA-256 and the streaming Merkle commitment recorded in the seal.
    ledger_dir = Path(path).parent
    blob_seals = [e["payload"] for e in entries if e["type"] == "session.seal" and "rawBlobRef" in e["payload"]]
    if blob_seals:
        print("\nraw-data verification (blob -> commitments):")
        for s in blob_seals:
            bp = ledger_dir / s["rawBlobRef"]
            if not bp.exists():
                print(f"  {s['sessionId'][:8]}  blob MISSING ({s['rawBlobRef']})")
                continue
            data = bp.read_bytes()
            flat_ok = ("sha256:" + hashlib.sha256(data).hexdigest()) == s.get("rawSha256")
            leaves = [data[i:i + s["leafBytes"]] for i in range(0, len(data), s["leafBytes"])]
            merkle_ok = merkle_root(leaves) == s["outputCommitment"]
            verdict = "OK" if (flat_ok and merkle_ok) else "MISMATCH"
            print(f"  {s['sessionId'][:8]}  {verdict}  ({len(data)} bytes; sha256 {'ok' if flat_ok else 'BAD'}, merkle {'ok' if merkle_ok else 'BAD'})")

    anchors = [e["payload"] for e in entries if e["type"] == "external.anchor"]
    if anchors:
        last = anchors[-1]
        print(f"\nexternal anchors: {len(anchors)} (latest head {last['headHash'][:20]}... at {last['anchoredAt']})")
        print("  publish these head hashes to an independent timestamp to freeze the corpus (D2).")

    print()
    if n_confirmatory == 0:
        print("NOTE: 0 confirmatory-grade sessions - all data here is pilot/plumbing (spec D1). Not publishable evidence.")
    print("A single session has ~no power (spec D13); only large, pre-registered aggregates can decide H1/H2.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "ledger/dev.jsonl"))
