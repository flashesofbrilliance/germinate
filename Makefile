# handoff-ledger — run the conformance suite across every implementation.
.PHONY: test test-node test-shell test-python test-rust build-rust clean

test: test-node test-shell test-python test-rust
	@echo "\nAll implementations passed the shared conformance suite."

test-node:
	@echo "== node =="
	@cd packages/node && node test/run.js

test-shell:
	@echo "== shell =="
	@sh packages/shell/test.sh

test-python:
	@echo "== python =="
	@cd packages/python && python3 -m unittest discover -s tests

test-rust:
	@echo "== rust =="
	@cd packages/rust && cargo test --offline 2>/dev/null || cargo test

build-rust:
	@cd packages/rust && cargo build --release
	@echo "binary: packages/rust/target/release/handoff-ledger"

clean:
	@rm -rf packages/rust/target packages/node/node_modules
