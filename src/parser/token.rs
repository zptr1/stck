use crate::shared::location::Span;

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Tokens {
    Str(String),
    Int(i64),
    Bool(bool),
    Word(String),

    Macro,
    Include,

    Proc,
    Do,
    End,
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum TokenKind {
    Str,
    Int,
    Bool,
    Word,
    Macro,
    Include,
    Proc,
    Do,
    End
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
}

impl Tokens {
    pub fn to_kind(&self) -> TokenKind {
        match self {
            Tokens::Str(_) => TokenKind::Str,
            Tokens::Int(_) => TokenKind::Int,
            Tokens::Bool(_) => TokenKind::Bool,
            Tokens::Word(_) => TokenKind::Word,
            Tokens::Macro => TokenKind::Macro,
            Tokens::Include => TokenKind::Include,
            Tokens::Proc => TokenKind::Proc,
            Tokens::Do => TokenKind::Do,
            Tokens::End => TokenKind::End,
        }
    }

    pub fn to_str(&self) -> &'static str {
        self.to_kind().to_str()
    }
}

impl TokenKind {
    pub fn to_str(&self) -> &'static str {
        match self {
            TokenKind::Str => "<str>",
            TokenKind::Int => "<int>",
            TokenKind::Bool => "<bool>",
            TokenKind::Word => "<word>",
            TokenKind::Macro => "macro",
            TokenKind::Include => "include",
            TokenKind::Proc => "proc",
            TokenKind::Do => "do",
            TokenKind::End => "end"
        }
    }
}