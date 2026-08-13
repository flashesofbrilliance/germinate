"""germinate — stdlib-only Python implementation.

A serializable, provenance-carrying handoff protocol: append-only belief-log,
drift-visible manifest, coal->diamond compaction, git-serializability check.
Conformant against ../../conformance/cases.json.
"""
from .docset import compare_docset, parse_docset  # noqa: F401
from .belieflog import validate_line, validate_file, append  # noqa: F401
from .manifest import load_manifest, drift_check  # noqa: F401

__version__ = "0.1.0"
