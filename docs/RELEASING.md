# Releasing (maintainer only)

> **germinate prepares the release pipeline; the maintainer performs every
> signed publish and holds every secret.** Claude / this repo never bundles, reads,
> or transmits your npm token, signing keys, or Apple/Developer credentials.

## What's automated vs. what's yours

| Step | Automated (workflow) | Yours (secret / action) |
|---|---|---|
| Build per-platform binaries | ✅ `release.yml` matrix | — |
| Checksums (SHA-256) | ✅ | — |
| Keyless signing (cosign/sigstore) | ✅ via OIDC, **no stored key** | approve the `release` environment |
| GitHub Release + assets | ✅ | approve the `release` environment |
| npm publish + provenance | ✅ (`--provenance`, OIDC) | provide `NPM_TOKEN`, approve |
| Homebrew formula bump | ⬜ (checksums produced) | update `homebrew/germinate.rb` / tap |

## One-time maintainer setup

1. **npm:** create an automation token, add it as the `NPM_TOKEN` repo secret. (npm
   provenance itself needs no key — it uses the workflow's OIDC identity.)
2. **Approval gate:** create a GitHub Environment named `release` with required
   reviewers = you. Both `npm-publish` and `github-release` jobs are gated on it, so
   nothing ships without your click.
3. **Homebrew tap (optional):** create `flashesofbrilliance/homebrew-tap`, place
   `homebrew/germinate.rb` at `Formula/germinate.rb`.

## Cutting a release

```bash
# 1. bump versions (keep the four in lockstep)
#    packages/node/package.json · packages/rust/Cargo.toml · packages/python (setup) · homebrew/*.rb
# 2. update CHANGELOG.md
# 3. tag + push — this triggers release.yml (which then WAITS for your approval)
git tag v0.1.0 && git push origin v0.1.0
# 4. approve the `release` environment in the Actions run
# 5. after binaries publish: copy the printed SHA-256 into homebrew/germinate.rb and push the tap
```

## Verifying signatures (what your users run)

```bash
# npm provenance
npm audit signatures         # or view the provenance on npmjs.com

# cosign keyless signature on a binary tarball
cosign verify-blob \
  --certificate germinate-<target>.tar.gz.pem \
  --signature   germinate-<target>.tar.gz.sig \
  --certificate-identity-regexp 'https://github.com/flashesofbrilliance/germinate' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  germinate-<target>.tar.gz
```

## Publishing checklist (public steps — require explicit owner authorization)

- [ ] `gh repo create --public` (owner authorizes)
- [ ] push to the public remote (owner authorizes)
- [ ] `npm publish` (via the gated workflow; owner approves)
- [ ] tap push / Homebrew (owner)

None of these are performed automatically by scaffolding — see [SECURITY posture in
INTEGRATION.md](INTEGRATION.md). Claude prepares; the owner ships.
