# Homebrew formula for germinate (Rust single binary).
#
# For a tap: place this at Formula/germinate.rb in a repo named
# `homebrew-tap` under your org, then:  brew install <org>/tap/germinate
#
# The `url` + `sha256` below are placeholders. The release workflow
# (.github/workflows/release.yml) builds per-platform binaries, computes their
# SHA-256, and the MAINTAINER updates this formula (or a bottle) as part of the
# signed publish. germinate prepares this; it never holds your signing keys.
class Germinate < Formula
  desc "Serializable, provenance-carrying handoff protocol for multi-agent / multi-worktree dev"
  homepage "https://github.com/flashesofbrilliance/germinate"
  version "0.1.0"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/flashesofbrilliance/germinate/releases/download/v0.1.0/germinate-aarch64-apple-darwin.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
    on_intel do
      url "https://github.com/flashesofbrilliance/germinate/releases/download/v0.1.0/germinate-x86_64-apple-darwin.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/flashesofbrilliance/germinate/releases/download/v0.1.0/germinate-x86_64-unknown-linux-gnu.tar.gz"
      sha256 "0000000000000000000000000000000000000000000000000000000000000000"
    end
  end

  def install
    bin.install "germinate"
    # convenience alias, matching the npm package
    bin.install_symlink "germinate" => "hl"
  end

  test do
    assert_match "0.1.0", shell_output("#{bin}/germinate version")
    assert_equal "-1", shell_output("#{bin}/germinate docset-cmp 2026-08-13-a.1 2026-08-13-a.2").strip
  end
end
