use std::{collections::{HashMap, HashSet}, slice::Iter};
use crate::shared::{error::{Error, Errors}, location::Span};

use super::token::{Token, Tokens, TokenKind};

pub struct Preprocessor<'a> {
    pub macros: HashMap<String, Vec<Token>>,
    pub included_files: HashSet<String>,
    pub tokens: Iter<'a, Token>,
    pub last_token_loc: Option<&'a Span>
}

impl<'a> Preprocessor<'a> {
    pub fn new(tokens: Iter<'a, Token>) -> Self {
        Self {
            macros: HashMap::new(),
            included_files: HashSet::new(),
            last_token_loc: None,
            tokens,
        }
    }

    pub fn next(&mut self) -> Result<&Token, Errors> {
        if let Some(token) = self.tokens.next() {
            self.last_token_loc = Some(&token.span);
            Ok(token)
        } else {
            Err(Errors::UnexpectedEOF)
        }
    }

    pub fn read_macro(&mut self) -> Result<(), Errors> {
        let token = &self.next()?.kind;
        if let Tokens::Str(name) = token {
            todo!();
        } else {
            Err(Errors::InvalidToken {
                expected: TokenKind::Str,
                got: token.to_kind()
            })
        }
    }

    pub fn read_include(&mut self) -> Result<(), Error> {
        todo!();
    }

    pub fn preprocess(&mut self) -> Result<Vec<Token>, Error> {
        let mut tokens = vec![];

        while let Some(token) = self.tokens.next() {
            match token.kind {
                Tokens::Macro => self.read_macro().map_err(|err| Error::new(err, *self.last_token_loc.unwrap()))?,
                Tokens::Include => self.read_include()?,
                _ => tokens.push(token.to_owned())
            }
        }

        Ok(tokens)
    }
}