# Homebrew formula for handoff-ledger (Rust single binary).
#
# For a tap: place this at Formula/handoff-ledger.rb in a repo named
# `homebrew-tap` under your org, then:  brew install <org>/tap/handoff-ledger
#
# The `url` + `sha256` below are placeholders. The release workflow
# (.github/workflows/release.yml) builds per-platform binaries, computes their
# SHA-256, and the MAINTAINER updates this formula (or a bottle) as part of the
# signed publish. handoff-ledger prepares this; it never holds your signing keys.
class HandoffLedger < Formula
  desc "Serializable, provenance-carrying handoff protocol for multi-agent / multi-worktree dev"
  homepage "https://github.com/flashesofbrilliance/handoff-ledger"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/flashesofbrilliance/handoff-ledger/releases/download/v0.1.0/handoff-ledger-aarch64-apple-darwin.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
    on_intel do
      url "https://github.com/flashesofbrilliance/handoff-ledger/releases/download/v0.1.0/handoff-ledger-x86_64-apple-darwin.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/flashesofbrilliance/handoff-ledger/releases/download/v0.1.0/handoff-ledger-x86_64-unknown-linux-gnu.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
  end

  def install
    bin.install "handoff-ledger"
    # convenience alias, matching the npm package
    bin.install_symlink "handoff-ledger" => "hl"
  end

  test do
    assert_match "0.1.0", shell_output("#{bin}/handoff-ledger version")
    assert_equal "-1", shell_output("#{bin}/handoff-ledger docset-cmp 2026-08-13-a.1 2026-08-13-a.2").strip
  end
end
