//! Minimal zero-dependency JSON parser. Enough for the belief-log + manifest shapes.
use std::collections::BTreeMap;

#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Value>),
    Obj(BTreeMap<String, Value>),
}

impl Value {
    pub fn get(&self, k: &str) -> Option<&Value> {
        match self {
            Value::Obj(m) => m.get(k),
            _ => None,
        }
    }
    pub fn as_str(&self) -> Option<&str> {
        match self {
            Value::Str(s) => Some(s),
            _ => None,
        }
    }
    pub fn as_num(&self) -> Option<f64> {
        match self {
            Value::Num(n) => Some(*n),
            _ => None,
        }
    }
    pub fn as_arr(&self) -> Option<&Vec<Value>> {
        match self {
            Value::Arr(a) => Some(a),
            _ => None,
        }
    }
    pub fn has(&self, k: &str) -> bool {
        self.get(k).is_some()
    }
}

pub fn parse(s: &str) -> Result<Value, String> {
    let bytes: Vec<char> = s.chars().collect();
    let mut p = Parser { b: bytes, i: 0 };
    p.ws();
    let v = p.value()?;
    p.ws();
    if p.i != p.b.len() {
        return Err("trailing data".into());
    }
    Ok(v)
}

struct Parser {
    b: Vec<char>,
    i: usize,
}

impl Parser {
    fn peek(&self) -> Option<char> {
        self.b.get(self.i).copied()
    }
    fn ws(&mut self) {
        while let Some(c) = self.peek() {
            if c.is_whitespace() {
                self.i += 1;
            } else {
                break;
            }
        }
    }
    fn value(&mut self) -> Result<Value, String> {
        self.ws();
        match self.peek() {
            Some('{') => self.object(),
            Some('[') => self.array(),
            Some('"') => Ok(Value::Str(self.string()?)),
            Some('t') | Some('f') => self.boolean(),
            Some('n') => self.null(),
            Some(c) if c == '-' || c.is_ascii_digit() => self.number(),
            _ => Err(format!("unexpected char at {}", self.i)),
        }
    }
    fn object(&mut self) -> Result<Value, String> {
        self.i += 1; // {
        let mut m = BTreeMap::new();
        self.ws();
        if self.peek() == Some('}') {
            self.i += 1;
            return Ok(Value::Obj(m));
        }
        loop {
            self.ws();
            let k = self.string()?;
            self.ws();
            if self.peek() != Some(':') {
                return Err("expected :".into());
            }
            self.i += 1;
            let v = self.value()?;
            m.insert(k, v);
            self.ws();
            match self.peek() {
                Some(',') => {
                    self.i += 1;
                }
                Some('}') => {
                    self.i += 1;
                    break;
                }
                _ => return Err("expected , or }".into()),
            }
        }
        Ok(Value::Obj(m))
    }
    fn array(&mut self) -> Result<Value, String> {
        self.i += 1; // [
        let mut a = Vec::new();
        self.ws();
        if self.peek() == Some(']') {
            self.i += 1;
            return Ok(Value::Arr(a));
        }
        loop {
            let v = self.value()?;
            a.push(v);
            self.ws();
            match self.peek() {
                Some(',') => {
                    self.i += 1;
                }
                Some(']') => {
                    self.i += 1;
                    break;
                }
                _ => return Err("expected , or ]".into()),
            }
        }
        Ok(Value::Arr(a))
    }
    fn string(&mut self) -> Result<String, String> {
        if self.peek() != Some('"') {
            return Err("expected string".into());
        }
        self.i += 1;
        let mut out = String::new();
        while let Some(c) = self.peek() {
            self.i += 1;
            match c {
                '"' => return Ok(out),
                '\\' => {
                    let e = self.peek().ok_or("bad escape")?;
                    self.i += 1;
                    match e {
                        '"' => out.push('"'),
                        '\\' => out.push('\\'),
                        '/' => out.push('/'),
                        'n' => out.push('\n'),
                        't' => out.push('\t'),
                        'r' => out.push('\r'),
                        'b' => out.push('\u{0008}'),
                        'f' => out.push('\u{000C}'),
                        'u' => {
                            let hex: String = self.b[self.i..self.i + 4].iter().collect();
                            self.i += 4;
                            let n = u32::from_str_radix(&hex, 16).map_err(|_| "bad \\u")?;
                            out.push(char::from_u32(n).unwrap_or('\u{FFFD}'));
                        }
                        _ => return Err("bad escape".into()),
                    }
                }
                _ => out.push(c),
            }
        }
        Err("unterminated string".into())
    }
    fn number(&mut self) -> Result<Value, String> {
        let start = self.i;
        if self.peek() == Some('-') {
            self.i += 1;
        }
        while let Some(c) = self.peek() {
            if c.is_ascii_digit() || c == '.' || c == 'e' || c == 'E' || c == '+' || c == '-' {
                self.i += 1;
            } else {
                break;
            }
        }
        let s: String = self.b[start..self.i].iter().collect();
        s.parse::<f64>().map(Value::Num).map_err(|_| "bad number".into())
    }
    fn boolean(&mut self) -> Result<Value, String> {
        if self.b[self.i..].starts_with(&['t', 'r', 'u', 'e']) {
            self.i += 4;
            Ok(Value::Bool(true))
        } else if self.b[self.i..].starts_with(&['f', 'a', 'l', 's', 'e']) {
            self.i += 5;
            Ok(Value::Bool(false))
        } else {
            Err("bad bool".into())
        }
    }
    fn null(&mut self) -> Result<Value, String> {
        if self.b[self.i..].starts_with(&['n', 'u', 'l', 'l']) {
            self.i += 4;
            Ok(Value::Null)
        } else {
            Err("bad null".into())
        }
    }
}
