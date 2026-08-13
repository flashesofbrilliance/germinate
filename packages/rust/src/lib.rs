//! germinate core (Rust). Zero-dependency. Conformant against ../../conformance/cases.json.
pub mod json;

use json::Value;
use std::path::Path;

const KINDS: [&str; 5] = ["trace.open", "belief.open", "belief.update", "belief.close", "note"];
const STATUSES: [&str; 5] = ["OPEN", "ALIGNED", "SUPERSEDED", "DEFERRED", "CLOSED"];

// ---- docset — SPEC.md §4 ----
pub struct Docset {
    pub date: String,
    pub phase: String,
    pub n: u64,
}

pub fn parse_docset(v: &str) -> Result<Docset, String> {
    // YYYY-MM-DD-<phase>.<n>
    let dot = v.rfind('.').ok_or("invalid docset: no .n")?;
    let n: u64 = v[dot + 1..].parse().map_err(|_| "invalid docset: n not a number")?;
    let head = &v[..dot];
    if head.len() < 12 || &head[4..5] != "-" || &head[7..8] != "-" || &head[10..11] != "-" {
        return Err("invalid docset: bad date/phase".into());
    }
    let date = head[..10].to_string();
    let phase = head[11..].to_string();
    if date.chars().enumerate().all(|(i, c)| if i == 4 || i == 7 { c == '-' } else { c.is_ascii_digit() })
        && !phase.is_empty()
        && phase.chars().all(|c| c.is_ascii_alphanumeric())
    {
        Ok(Docset { date, phase, n })
    } else {
        Err("invalid docset".into())
    }
}

pub fn compare_docset(a: &str, b: &str) -> Result<i32, String> {
    let (pa, pb) = (parse_docset(a)?, parse_docset(b)?);
    if pa.date != pb.date {
        return Ok(if pa.date < pb.date { -1 } else { 1 });
    }
    if pa.phase != pb.phase {
        return Ok(if pa.phase < pb.phase { -1 } else { 1 });
    }
    Ok(if pa.n < pb.n { -1 } else if pa.n > pb.n { 1 } else { 0 })
}

// ---- belief-log — SPEC.md §2 ----
pub fn validate_line(obj: &Value) -> Vec<String> {
    let mut e = Vec::new();
    for k in ["ts", "trace", "span", "kind"] {
        if obj.get(k).map_or(true, |v| matches!(v, Value::Null)) {
            e.push(format!("missing required field: {}", k));
        }
    }
    if let Some(k) = obj.get("kind").and_then(|v| v.as_str()) {
        if !KINDS.contains(&k) {
            e.push(format!("kind not in enum: {}", k));
        }
    }
    for k in ["confidence", "risk"] {
        if let Some(v) = obj.get(k) {
            match v.as_num() {
                Some(n) if (0.0..=1.0).contains(&n) => {}
                _ => e.push(format!("{} must be a number in [0,1]", k)),
            }
        }
    }
    if let Some(ev) = obj.get("evidence") {
        match ev.as_arr() {
            Some(a) if a.iter().all(|x| x.as_str().is_some()) => {}
            _ => e.push("evidence must be an array of strings".into()),
        }
    }
    if let Some(s) = obj.get("status").and_then(|v| v.as_str()) {
        if !STATUSES.contains(&s) {
            e.push(format!("status not in enum: {}", s));
        }
    }
    let kind = obj.get("kind").and_then(|v| v.as_str()).unwrap_or("");
    if kind == "belief.open" && obj.get("belief").and_then(|v| v.as_str()).unwrap_or("").is_empty() {
        e.push("belief.open requires belief".into());
    }
    if kind == "note" && obj.get("note").and_then(|v| v.as_str()).unwrap_or("").is_empty() {
        e.push("note kind requires note".into());
    }
    if kind == "trace.open" && obj.get("note").and_then(|v| v.as_str()).unwrap_or("").is_empty() {
        e.push("trace.open requires note".into());
    }
    e
}

pub fn validate_file(contents: &str) -> (bool, Vec<(usize, Vec<String>)>) {
    let mut failures = Vec::new();
    for (i, line) in contents.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        match json::parse(line) {
            Ok(v) => {
                let errs = validate_line(&v);
                if !errs.is_empty() {
                    failures.push((i + 1, errs));
                }
            }
            Err(msg) => failures.push((i + 1, vec![format!("not valid JSON: {}", msg)])),
        }
    }
    (failures.is_empty(), failures)
}

// ---- manifest / drift-check — SPEC.md §3 ----
pub fn drift_check(manifest: &Value, base_dir: &Path) -> Result<(Vec<(String, String)>, bool), String> {
    let header = manifest.get("docsetVersion").and_then(|v| v.as_str()).ok_or("manifest missing docsetVersion")?;
    let surfaces = manifest.get("surfaces").and_then(|v| v.as_arr()).ok_or("manifest missing surfaces[]")?;
    let mut verdicts = Vec::new();
    for s in surfaces {
        let id = s.get("id").and_then(|v| v.as_str()).unwrap_or("?").to_string();
        let kind = s.get("kind").and_then(|v| v.as_str()).unwrap_or("");
        let docset = s.get("docset").and_then(|v| v.as_str()).unwrap_or("");
        let verdict = if compare_docset(docset, header)? < 0 {
            "STALE"
        } else if kind == "projection"
            && s.get("status").and_then(|v| v.as_str()).map_or(false, |st| st != "IN_SYNC")
        {
            "OUT_OF_SYNC"
        } else if kind == "canonical" {
            let p = s.get("path").and_then(|v| v.as_str()).unwrap_or("");
            if base_dir.join(p).exists() {
                "IN_SYNC"
            } else {
                "MISSING"
            }
        } else {
            "IN_SYNC"
        };
        verdicts.push((id, verdict.to_string()));
    }
    let ok = verdicts.iter().all(|(_, v)| v == "IN_SYNC");
    Ok((verdicts, ok))
}
