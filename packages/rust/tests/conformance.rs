//! Conformance suite driven by ../../../conformance/cases.json. Zero-dep (uses the crate's own json parser).
use germinate::{compare_docset, drift_check, validate_file};
use std::path::Path;

fn conf_dir() -> std::path::PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../conformance")
}

fn read(p: &str) -> String {
    std::fs::read_to_string(conf_dir().join(p)).unwrap()
}

fn cases() -> germinate::json::Value {
    germinate::json::parse(&read("cases.json")).unwrap()
}

#[test]
fn belief_line_validation() {
    let c = cases();
    for case in c.get("beliefLogLineValidation").unwrap().as_arr().unwrap() {
        let file = case.get("file").unwrap().as_str().unwrap();
        let want = matches!(case.get("valid"), Some(germinate::json::Value::Bool(true)));
        let (ok, _) = validate_file(&read(file));
        assert_eq!(ok, want, "{}", file);
    }
}

#[test]
fn docset_ordering() {
    let c = cases();
    for case in c.get("docsetOrdering").unwrap().as_arr().unwrap() {
        let a = case.get("a").unwrap().as_str().unwrap();
        let b = case.get("b").unwrap().as_str().unwrap();
        let want = case.get("cmp").unwrap().as_num().unwrap() as i32;
        assert_eq!(compare_docset(a, b).unwrap(), want, "{} vs {}", a, b);
    }
}

#[test]
fn drift() {
    let c = cases();
    for case in c.get("driftCheck").unwrap().as_arr().unwrap() {
        let mpath = case.get("manifest").unwrap().as_str().unwrap();
        let manifest = germinate::json::parse(&read(mpath)).unwrap();
        let (verdicts, ok) = drift_check(&manifest, &conf_dir()).unwrap();
        let want_ok = matches!(case.get("expectExitZero"), Some(germinate::json::Value::Bool(true)));
        assert_eq!(ok, want_ok, "{}", mpath);
        if let Some(germinate::json::Value::Obj(vs)) = case.get("verdicts") {
            for (id, v) in vs {
                let got = verdicts.iter().find(|(i, _)| i == id).map(|(_, x)| x.as_str()).unwrap();
                assert_eq!(got, v.as_str().unwrap(), "{} surface {}", mpath, id);
            }
        }
    }
}
