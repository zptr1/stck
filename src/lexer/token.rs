use crate::shared::location::Span;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Tokens {
    Str,
    Int,
    Bool,
    Word,

    Proc,
    Do,
    End,
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum TokenData {
    None,
    Str(String),
    Int(i64),
    Bool(bool),
    Word(String)
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Token {
    pub kind: Tokens,
    pub data: TokenData,
    pub span: Span,
}

impl Token {
    pub fn new(kind: Tokens, data: TokenData, span: Span) -> Self {
        Self { kind, span, data }
    }

    pub fn to_str(&self) -> &str {
        match self.kind {
            Tokens::Str => "<str>",
            Tokens::Int => "<int>",
            Tokens::Bool => "<bool>",
            Tokens::Word => "<word>",
            Tokens::Proc => "proc",
            Tokens::Do => "do",
            Tokens::End => "end"
        }
    }
}