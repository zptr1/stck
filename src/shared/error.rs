use crate::parser::token::{TokenKind};
use super::location::Span;

#[derive(Clone, PartialEq, Eq, Debug)]
pub enum Errors {
    UnexpectedEOF,
    UnclosedString,
    EmptyString,
    InvalidToken {
        expected: TokenKind,
        got: TokenKind
    }
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct Error {
    pub kind: Errors,
    pub span: Span,
}

impl Error {
    pub fn new(kind: Errors, span: Span) -> Self {
        Self { kind, span }
    }
}