use crate::shared::location::Span;

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Tokens {
    Str(String),
    Int(i64),
    Bool(bool),
    Word(String),

    Proc,
    Do,
    End,
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Token {
    pub kind: Tokens,
    pub span: Span,
}

impl Token {
    pub fn new(kind: Tokens, span: Span) -> Self {
        Self { kind, span }
    }

    pub fn to_str(&self) -> &str {
        match self.kind {
            Tokens::Str(_) => "<str>",
            Tokens::Int(_) => "<int>",
            Tokens::Bool(_) => "<bool>",
            Tokens::Word(_) => "<word>",
            Tokens::Proc => "proc",
            Tokens::Do => "do",
            Tokens::End => "end"
        }
    }
}