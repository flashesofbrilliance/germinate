//! handoff-ledger CLI (Rust). Verbs: belief validate, drift-check, docset-cmp, version, help.
use handoff_ledger as core;
use handoff_ledger::json;
use std::path::Path;
use std::process::exit;

const VERSION: &str = "0.1.0";

fn help() {
    println!(
        "handoff-ledger v{VERSION} (rust)\n\nUSAGE\n  handoff-ledger <command>\n\nCOMMANDS\n  belief validate <log.jsonl>          Validate a belief-log.\n  drift-check --manifest <m.json>      Are projections in sync with the docset?\n  docset-cmp <a> <b>                    Compare two docset versions (-1/0/1).\n  version | help"
    );
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    exit(run(&args));
}

fn flag<'a>(args: &'a [String], name: &str) -> Option<&'a str> {
    args.iter().position(|a| a == name).and_then(|i| args.get(i + 1)).map(|s| s.as_str())
}

fn run(args: &[String]) -> i32 {
    match args.first().map(|s| s.as_str()) {
        Some("belief") if args.get(1).map(|s| s.as_str()) == Some("validate") => {
            let file = match args.get(2) {
                Some(f) => f,
                None => {
                    eprintln!("usage: belief validate <log.jsonl>");
                    return 1;
                }
            };
            let contents = match std::fs::read_to_string(file) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("error: {}", e);
                    return 1;
                }
            };
            let (ok, failures) = core::validate_file(&contents);
            if ok {
                println!("OK: valid.");
            } else {
                println!("INVALID: {} bad line(s).", failures.len());
                for (n, errs) in &failures {
                    println!("  line {}: {}", n, errs.join("; "));
                }
            }
            if ok { 0 } else { 1 }
        }
        Some("belief") => {
            eprintln!("usage: belief validate <log.jsonl>");
            1
        }
        Some("drift-check") => {
            let m = flag(args, "--manifest").unwrap_or("manifest.json");
            let contents = match std::fs::read_to_string(m) {
                Ok(c) => c,
                Err(_) => {
                    eprintln!("error: manifest not found: {}", m);
                    return 1;
                }
            };
            let v = match json::parse(&contents) {
                Ok(v) => v,
                Err(e) => {
                    eprintln!("error: bad manifest json: {}", e);
                    return 1;
                }
            };
            let base = Path::new(m).parent().unwrap_or_else(|| Path::new("."));
            match core::drift_check(&v, base) {
                Ok((verdicts, ok)) => {
                    let header = v.get("docsetVersion").and_then(|x| x.as_str()).unwrap_or("?");
                    println!("drift-check @ {} — {}", header, if ok { "ALL IN SYNC" } else { "DRIFT DETECTED" });
                    for (id, verdict) in &verdicts {
                        println!("  {} {}: {}", if verdict == "IN_SYNC" { "v" } else { "x" }, id, verdict);
                    }
                    if ok { 0 } else { 1 }
                }
                Err(e) => {
                    eprintln!("error: {}", e);
                    1
                }
            }
        }
        Some("docset-cmp") => match (args.get(1), args.get(2)) {
            (Some(a), Some(b)) => match core::compare_docset(a, b) {
                Ok(c) => {
                    println!("{}", c);
                    0
                }
                Err(e) => {
                    eprintln!("error: {}", e);
                    1
                }
            },
            _ => {
                eprintln!("usage: docset-cmp <a> <b>");
                1
            }
        },
        Some("version") | Some("--version") => {
            println!("{VERSION}");
            0
        }
        Some("help") | Some("--help") | None => {
            help();
            0
        }
        Some(other) => {
            eprintln!("unknown command: {}", other);
            help();
            2
        }
    }
}
