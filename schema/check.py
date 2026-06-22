#!/usr/bin/env python3
"""Validate PsiMeter artifacts against the JSON Schemas in this directory.

PsiMeter's analysis pipeline is standard-library-only (see analysis/analyze.py),
and neither `jsonschema` nor a Node validator is a project dependency. So this
script carries a tiny, self-contained validator for exactly the subset of JSON
Schema 2020-12 the PsiMeter schemas use — enough that any auditor can run it with
a bare Python install. It is NOT a general-purpose validator.

It validates, against the schemas:
  * the experiment-definition vectors (spec/test-vectors/experiment.json) and the
    two published experiment definitions (experiments/*.json);
  * the ledger chain vector (spec/test-vectors/ledger.json) entry by entry;
  * the committed example entries (schema/examples/*.json) — these exercise the
    witnessed micro-PK seal and the precognition open/seal shapes that the real
    dev artifacts do not;
  * the local dev ledger (ledger/*.jsonl) if present (git-ignored, optional).
It then runs negative cases that the schemas MUST reject.

Exit code 0 iff every positive case validates and every negative case is rejected.

Usage:  python schema/check.py
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SCHEMA_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCHEMA_DIR.parent

# ---------------------------------------------------------------------------
# Minimal JSON Schema 2020-12 validator (subset)
# ---------------------------------------------------------------------------

_SCHEMA_CACHE: dict[str, dict] = {}


def load_schema(name: str) -> dict:
    if name not in _SCHEMA_CACHE:
        _SCHEMA_CACHE[name] = json.loads((SCHEMA_DIR / name).read_text(encoding="utf-8"))
    return _SCHEMA_CACHE[name]


def json_equal(a: object, b: object) -> bool:
    # JSON booleans are distinct from numbers (True != 1 here).
    if isinstance(a, bool) != isinstance(b, bool):
        return False
    return a == b


def is_type(instance: object, t: str) -> bool:
    if t == "object":
        return isinstance(instance, dict)
    if t == "array":
        return isinstance(instance, list)
    if t == "string":
        return isinstance(instance, str)
    if t == "integer":
        return isinstance(instance, int) and not isinstance(instance, bool)
    if t == "number":
        return isinstance(instance, (int, float)) and not isinstance(instance, bool)
    if t == "boolean":
        return isinstance(instance, bool)
    if t == "null":
        return instance is None
    raise ValueError(f"unsupported type keyword: {t}")


def resolve_ref(ref: str, root: dict) -> tuple[dict, dict]:
    """Return (subschema, new_root) for a $ref. Cross-file refs load by filename."""
    file_part, _, fragment = ref.partition("#")
    doc = root if file_part == "" else load_schema(file_part)
    target: object = doc
    for token in fragment.split("/"):
        if token == "":
            continue
        token = token.replace("~1", "/").replace("~0", "~")
        target = target[token]
    return target, doc  # type: ignore[return-value]


def validate(instance: object, schema: dict, root: dict, path: str, errors: list[str]) -> None:
    if "$ref" in schema:
        sub, new_root = resolve_ref(schema["$ref"], root)
        validate(instance, sub, new_root, path, errors)
        # (none of PsiMeter's $refs carry sibling keywords, but fall through anyway)

    if "type" in schema:
        types = schema["type"]
        types = [types] if isinstance(types, str) else types
        if not any(is_type(instance, t) for t in types):
            errors.append(f"{path}: expected type {schema['type']}, got {type(instance).__name__}")
            return  # later keywords assume the type matched

    if "const" in schema and not json_equal(instance, schema["const"]):
        errors.append(f"{path}: expected const {schema['const']!r}")

    if "enum" in schema and not any(json_equal(instance, e) for e in schema["enum"]):
        errors.append(f"{path}: {instance!r} not in enum {schema['enum']}")

    if "pattern" in schema and isinstance(instance, str):
        if re.search(schema["pattern"], instance) is None:
            errors.append(f"{path}: {instance!r} does not match pattern {schema['pattern']!r}")

    if "minimum" in schema and isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if instance < schema["minimum"]:
            errors.append(f"{path}: {instance} < minimum {schema['minimum']}")

    if "minItems" in schema and isinstance(instance, list) and len(instance) < schema["minItems"]:
        errors.append(f"{path}: array shorter than minItems {schema['minItems']}")

    if isinstance(instance, dict):
        for key in schema.get("required", []):
            if key not in instance:
                errors.append(f"{path}: missing required property {key!r}")
        props = schema.get("properties", {})
        for key, value in instance.items():
            if key in props:
                validate(value, props[key], root, f"{path}/{key}", errors)
        if "additionalProperties" in schema:
            ap = schema["additionalProperties"]
            for key, value in instance.items():
                if key in props:
                    continue
                if ap is False:
                    errors.append(f"{path}: additional property {key!r} not allowed")
                elif isinstance(ap, dict):
                    validate(value, ap, root, f"{path}/{key}", errors)

    if isinstance(instance, list) and "items" in schema:
        for i, item in enumerate(instance):
            validate(item, schema["items"], root, f"{path}/{i}", errors)

    if "allOf" in schema:
        for i, sub in enumerate(schema["allOf"]):
            validate(instance, sub, root, f"{path}(allOf/{i})", errors)

    if "anyOf" in schema:
        if not any(is_valid(instance, sub, root) for sub in schema["anyOf"]):
            errors.append(f"{path}: matched none of anyOf")

    if "oneOf" in schema:
        matches = sum(1 for sub in schema["oneOf"] if is_valid(instance, sub, root))
        if matches != 1:
            errors.append(f"{path}: matched {matches} of oneOf (expected exactly 1)")

    if "if" in schema:
        if is_valid(instance, schema["if"], root):
            if "then" in schema:
                validate(instance, schema["then"], root, f"{path}(then)", errors)
        elif "else" in schema:
            validate(instance, schema["else"], root, f"{path}(else)", errors)


def is_valid(instance: object, schema: dict, root: dict) -> bool:
    errs: list[str] = []
    validate(instance, schema, root, "", errs)
    return not errs


# ---------------------------------------------------------------------------
# Test harness
# ---------------------------------------------------------------------------

passed = 0
failed = 0


def expect_valid(label: str, instance: object, schema_file: str) -> None:
    global passed, failed
    schema = load_schema(schema_file)
    errs: list[str] = []
    validate(instance, schema, schema, "", errs)
    if errs:
        failed += 1
        print(f"  FAIL  {label}  [{schema_file}]")
        for e in errs:
            print(f"          {e}")
    else:
        passed += 1
        print(f"  ok    {label}  [{schema_file}]")


def expect_invalid(label: str, instance: object, schema_file: str) -> None:
    global passed, failed
    schema = load_schema(schema_file)
    errs: list[str] = []
    validate(instance, schema, schema, "", errs)
    if errs:
        passed += 1
        print(f"  ok    {label}  (correctly rejected)")
    else:
        failed += 1
        print(f"  FAIL  {label}  (should have been rejected) [{schema_file}]")


def load_json(rel: str) -> object:
    return json.loads((REPO_ROOT / rel).read_text(encoding="utf-8"))


def main() -> int:
    print("Experiment definitions vs experiment-definition.schema.json")
    exp_vectors = load_json("spec/test-vectors/experiment.json")
    for v in exp_vectors["vectors"]:
        expect_valid(f"vector {v['id']}", v["definition"], "experiment-definition.schema.json")
    for f in ("experiments/binary-micropk-v1.json", "experiments/precognition-presentiment-v1.json"):
        expect_valid(f, load_json(f), "experiment-definition.schema.json")

    # The ledger.json vector is a hash-chain known-answer fixture: its payloads are
    # intentionally abbreviated (e.g. session.open = {sessionId, intention}) to test
    # entryHash/linkage, NOT payload completeness. We must not edit it (it feeds the
    # cross-language conformance gate), so we validate it at the ENVELOPE level only —
    # a copy of the schema without the per-type payload dispatch. The real ledger and
    # the committed examples below exercise the full payload schemas.
    print("\nLedger chain vector vs ledger-entry envelope (payloads abbreviated in this fixture)")
    envelope_only = {k: v for k, v in load_schema("ledger-entry.schema.json").items() if k != "allOf"}
    _SCHEMA_CACHE["__envelope_only__"] = envelope_only
    ledger_vec = load_json("spec/test-vectors/ledger.json")
    for entry in ledger_vec["chain"]:
        expect_valid(f"chain seq={entry['seq']} ({entry['type']})", entry, "__envelope_only__")

    print("\nCommitted example entries vs ledger-entry.schema.json")
    for f in sorted((SCHEMA_DIR / "examples").glob("*.json")):
        expect_valid(f"examples/{f.name}", json.loads(f.read_text(encoding="utf-8")), "ledger-entry.schema.json")

    print("\nLocal dev ledger vs ledger-entry.schema.json (optional)")
    dev_ledgers = sorted((REPO_ROOT / "ledger").glob("*.jsonl")) if (REPO_ROOT / "ledger").is_dir() else []
    if not dev_ledgers:
        print("  --    no ledger/*.jsonl present (skipped)")
    for lf in dev_ledgers:
        for i, line in enumerate(lf.read_text(encoding="utf-8").splitlines()):
            if line.strip():
                expect_valid(f"{lf.name} line {i}", json.loads(line), "ledger-entry.schema.json")

    print("\nNegative cases (MUST be rejected)")
    good_def = load_json("experiments/binary-micropk-v1.json")
    # float in params violates [PSI-EXP-2] (integers/strings only)
    bad = json.loads(json.dumps(good_def)); bad["params"]["trialBits"] = 200.5
    expect_invalid("definition with float param", bad, "experiment-definition.schema.json")
    # neither intentions nor choices violates [PSI-EXP-1]
    bad = json.loads(json.dumps(good_def)); del bad["intentions"]
    expect_invalid("definition with no vocabulary", bad, "experiment-definition.schema.json")
    # unknown kind not in the registry
    bad = json.loads(json.dumps(good_def)); bad["kind"] = "telekinesis"
    expect_invalid("definition with unknown kind", bad, "experiment-definition.schema.json")

    open_entry = next(e for e in ledger_vec["chain"] if e["type"] == "session.open")
    dev_open = None
    for lf in dev_ledgers:
        for line in lf.read_text(encoding="utf-8").splitlines():
            if line.strip() and json.loads(line)["type"] == "session.open":
                dev_open = json.loads(line)
    full_open = dev_open if dev_open else open_entry
    if dev_open:
        # missing a required payload member
        bad = json.loads(json.dumps(dev_open)); del bad["payload"]["operatorSig"]
        expect_invalid("session.open missing operatorSig", bad, "ledger-entry.schema.json")
        # stray payload member (additionalProperties:false)
        bad = json.loads(json.dumps(dev_open)); bad["payload"]["zScore"] = "1.23"
        expect_invalid("session.open with stray field", bad, "ledger-entry.schema.json")
    # malformed hash string in the envelope
    bad = json.loads(json.dumps(full_open)); bad["entryHash"] = "sha256:NOTHEX"
    expect_invalid("entry with malformed entryHash", bad, "ledger-entry.schema.json")

    micro_seal = json.loads((SCHEMA_DIR / "examples" / "session-seal.micro-pk-witnessed.json").read_text(encoding="utf-8"))
    # a derived real-valued statistic must not appear ([PSI-LEDGER-5]); also blocked by additionalProperties:false
    bad = json.loads(json.dumps(micro_seal)); bad["payload"]["z"] = 3
    expect_invalid("seal with stored z (PSI-LEDGER-5)", bad, "ledger-entry.schema.json")
    # a seal that mixes both kinds' counts matches neither oneOf branch
    bad = json.loads(json.dumps(micro_seal)); bad["payload"]["trials"] = 20
    expect_invalid("seal mixing micro-PK and precog counts", bad, "ledger-entry.schema.json")

    print(f"\n{'=' * 60}\n{passed} passed, {failed} failed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
