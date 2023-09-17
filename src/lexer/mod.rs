use std::{str::Chars, iter::Peekable};

use crate::shared::{error::{Errors, Error}, location::Span};

use self::token::{Token, Tokens, TokenData};

pub mod token;

pub struct Lexer<'a> {
    pub cursor: usize,
    pub span_start: usize,
    pub contents: Peekable<Chars<'a>>
}

impl<'a> Lexer<'a> {
    pub fn new(contents: &'a str) -> Self {
        Self {
            cursor: 0,
            span_start: 0,
            contents: contents.chars().peekable()
        }
    }

    #[inline]
    pub fn span(&mut self) -> Span {
        let start = self.span_start;
        self.span_start = self.cursor;
        Span::new(start, self.cursor)
    }

    #[inline]
    pub fn next(&mut self) -> Result<char, Errors> {
        self.cursor += 1;
        self.contents.next().ok_or(Errors::UnexpectedEOF)
    }

    #[inline]
    pub fn peek(&mut self) -> Result<char, Errors> {
        self.contents.peek().ok_or(Errors::UnexpectedEOF).copied()
    }

    #[inline]
    pub fn is_end(&mut self) -> bool {
        self.contents.peek().is_none()
    }

    #[inline]
    pub fn is_whitespace(&mut self) -> bool {
        matches!(self.contents.peek(), Some(' ' | '\n' | '\r'))
    }

    pub fn read_word(&mut self) -> Result<Token, Errors> {
        let mut word = String::new();
        let mut numeric = true;

        while !self.is_end() && !self.is_whitespace() {
            let ch = self.next()?;

            // TODO: negative integers
            // TODO: hexadecimal integers?
            if !ch.is_ascii_digit() {
                numeric = false;
            }

            word.push(ch);
        }

        if numeric {
            Ok(Token::new(
                Tokens::Int,
                TokenData::Int(word.parse().unwrap()),
                self.span()
            ))
        } else {
            // TODO: find a better way to do this
            Ok(
                match word.as_str() {
                    "true"  => Token::new(Tokens::Bool, TokenData::Bool(true), self.span()),
                    "false" => Token::new(Tokens::Bool, TokenData::Bool(false), self.span()),
                    "proc"  => Token::new(Tokens::Proc, TokenData::None, self.span()),
                    "do"    => Token::new(Tokens::Do, TokenData::None, self.span()),
                    "end"   => Token::new(Tokens::End, TokenData::None, self.span()),
                    _ => Token::new(Tokens::Word, TokenData::Word(word), self.span())
                }
            )
        }
    }

    pub fn read_str(&mut self) -> Result<Token, Errors> {
        let mut string = String::new();

        self.contents.next();
        loop {
            match self.next()? {
                '"' => break,
                '\\' => {
                    match self.next()? {
                        'n' => string.push('\n'),
                        'r' => string.push('\r'),
                        't' => string.push('\t'),
                        // TODO: should this be stricter and error on escaping unknown characters?
                        ch => string.push(ch)
                    }
                },
                ch => string.push(ch)
            }
        }

        if string.is_empty() {
            Err(Errors::EmptyString)
        } else {
            Ok(Token::new(Tokens::Str, TokenData::Str(string), self.span()))
        }
    }

    pub fn skip_whitespace(&mut self) {
        while self.is_whitespace() {
            self.contents.next();
        }

        self.span();
    }

    pub fn next_token(&mut self) -> Result<Token, Errors> {
        match self.peek()? {
            '"' => self.read_str().map_err(|err| {
                // TODO: find a better way to do this
                if err == Errors::UnexpectedEOF {
                    Errors::UnclosedString
                } else { err }
            }),
            _ => self.read_word()
        }
    }

    pub fn collect(&mut self) -> Result<Vec<Token>, Vec<Error>> {
        let mut tokens = vec![];
        let mut errors = vec![];

        loop {
            self.skip_whitespace();
            self.span();

            if self.is_end() {
                break;
            } else {
                match self.next_token() {
                    Ok(token) => tokens.push(token),
                    Err(error) => errors.push(Error::new(error, self.span()))
                }
            }
        }

        if errors.is_empty() {
            Ok(tokens)
        } else {
            Err(errors)
        }
    }
}