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


# ---- operator pre-commitment verification (mirrors packages/core + browser /verify) ----

EXPERIMENTS_DIR = Path(__file__).resolve().parent.parent / "experiments"
_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"  # base32, no I/L/O/U

try:
    from cryptography.exceptions import InvalidSignature
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

    _HAVE_ED25519 = True
except ImportError:  # stdlib-only fallback: chain, precommits, anchors, blobs still verified
    _HAVE_ED25519 = False


def experiment_hash(defn: dict) -> str:
    return sha256_str(canonicalize(defn))


def anchor_from_hash(prefixed: str) -> str:
    """Mirror of anchorFromHash in packages/core/src/commitment.ts (first 60 bits)."""
    hex15 = prefixed.split(":", 1)[1][:15]
    bits = "".join(f"{int(c, 16):04b}" for c in hex15)
    enc = "".join(_CROCKFORD[int(bits[i : i + 5], 2)] for i in range(0, 60, 5))
    return f"{enc[:4]}-{enc[4:8]}-{enc[8:12]}"


def recompute_precommit(open_entry: dict, defn: dict) -> str:
    """Rebuild the pre-commitment from the revealed fields (mirror of buildPrecommit)."""
    p = open_entry["payload"]
    return sha256_str(
        canonicalize(
            {
                "experimentId": p["experimentId"],
                "experimentVersion": p["experimentVersion"],
                "experimentHash": experiment_hash(defn),
                "intention": p["intention"],
                "operatorPubKey": p["operatorPubKey"],
                "beacon": p["beacon"],
                "sessionId": p["sessionId"],
                "serverNonce": p["serverNonce"],
                "prevHash": open_entry["prevHash"],
            }
        )
    )


def verify_operator_sig(pubkey: str, precommit: str, sig: str):
    """True/False when 'cryptography' is installed; None when it is not (skipped)."""
    if not _HAVE_ED25519:
        return None
    try:
        key = Ed25519PublicKey.from_public_bytes(bytes.fromhex(pubkey.split(":", 1)[1]))
        key.verify(bytes.fromhex(sig.split(":", 1)[1]), precommit.encode("utf-8"))
        return True
    except (InvalidSignature, ValueError):
        return False


def load_experiment_def(eid: str, version: int):
    path = EXPERIMENTS_DIR / f"{eid}-v{version}.json"
    return json.loads(path.read_text()) if path.exists() else None


def verify_commitments(open_entries: dict) -> None:
    """Recompute each pre-commitment + anchor (stdlib) and, if 'cryptography' is
    available, verify the operator's Ed25519 signature. This is the same check the
    browser /verify view performs — independent of the TypeScript collector."""
    if not open_entries:
        return
    print("operator commitments (recomputed independently):")
    for sid, oe in open_entries.items():
        p = oe["payload"]
        defn = load_experiment_def(p["experimentId"], p["experimentVersion"])
        if defn is None:
            print(f"  {sid[:8]}  SKIP (no definition {p['experimentId']}-v{p['experimentVersion']})")
            continue
        pre_ok = recompute_precommit(oe, defn) == p["precommit"]
        anc_ok = anchor_from_hash(p["precommit"]) == p["anchor"]
        sig = verify_operator_sig(p["operatorPubKey"], p["precommit"], p["operatorSig"])
        sig_txt = {True: "sig ok", False: "sig BAD", None: "sig -"}[sig]
        print(f"  {sid[:8]}  precommit {'ok' if pre_ok else 'BAD'}  anchor {'ok' if anc_ok else 'BAD'}  {sig_txt}")
    if not _HAVE_ED25519:
        print("  (install 'cryptography' to also verify Ed25519 operator signatures;")
        print("   the chain, pre-commitments, anchors and blobs are verified with the stdlib alone)")
    print()


def main(path: str) -> int:
    entries = [json.loads(line) for line in Path(path).read_text().splitlines() if line.strip()]
    print(f"ledger entries: {len(entries)}")

    bad = verify_chain(entries)
    if bad >= 0:
        print(f"chain integrity: BROKEN at index {bad}")
        return 1
    print("chain integrity: OK (re-derived independently in Python)\n")

    opens = {e["payload"]["sessionId"]: e for e in entries if e["type"] == "session.open"}
    seals = [e["payload"] for e in entries if e["type"] == "session.seal"]

    verify_commitments(opens)

    print(f"{'session':10}{'intent':9}{'source':9}{'ones / N':>16}{'z':>9}{'dir-z':>8}{'p(1-tail)':>11}")
    print("-" * 72)
    by_intent: dict[str, list[float]] = {"HIGH": [], "LOW": [], "BASELINE": []}
    directional: list[float] = []
    n_confirmatory = 0
    for s in seals:
        oe = opens.get(s["sessionId"])
        op = oe["payload"] if oe else {}
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
