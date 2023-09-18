use std::{fs::File, io::Read};

use parser::lexer::Lexer;

mod parser;
mod shared;

fn main() {
    let mut file = File::open("test.stck").unwrap();
    let mut contents = String::new();

    file.read_to_string(&mut contents).unwrap();

    let tokens = Lexer::new(contents.as_str()).collect();

    println!("{:#?}", tokens);
}
