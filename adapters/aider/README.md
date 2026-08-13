# Aider adapter

Aider is git-centric, which fits germinate's grain. Drive the verbs with shell
aliases and (optionally) Aider's commit hook.

```bash
# session start
alias hl-pickup='germinate drift-check --manifest manifest.json; germinate pickup SESSION-HANDOFF.md'

# session end
hl-compact() {
  germinate compact --docset "$1" --belieflog belieflog.jsonl \
    --manifest manifest.json --starts-at "$2" --out SESSION-HANDOFF.md
  germinate serializability --strict
}
# usage: hl-compact 2026-08-13-build.1 "wire delivery to the sandbox"
```

Because Aider commits frequently, the pre-push serializability hook
(`germinate install-hooks`) is the highest-leverage guard here — it catches
force-push risk and untracked shared state at the push boundary without changing your
Aider workflow. Same contract as every other adapter — see [`../README.md`](../README.md).
