use super::location::Span;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Errors {
    UnexpectedEOF,
    UnclosedString,
    EmptyString,
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