# Aider adapter

Aider is git-centric, which fits handoff-ledger's grain. Drive the verbs with shell
aliases and (optionally) Aider's commit hook.

```bash
# session start
alias hl-pickup='handoff-ledger drift-check --manifest manifest.json; handoff-ledger pickup SESSION-HANDOFF.md'

# session end
hl-compact() {
  handoff-ledger compact --docset "$1" --belieflog belieflog.jsonl \
    --manifest manifest.json --starts-at "$2" --out SESSION-HANDOFF.md
  handoff-ledger serializability --strict
}
# usage: hl-compact 2026-08-13-build.1 "wire delivery to the sandbox"
```

Because Aider commits frequently, the pre-push serializability hook
(`handoff-ledger install-hooks`) is the highest-leverage guard here — it catches
force-push risk and untracked shared state at the push boundary without changing your
Aider workflow. Same contract as every other adapter — see [`../README.md`](../README.md).
