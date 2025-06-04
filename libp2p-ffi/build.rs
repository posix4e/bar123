use std::env;
use std::path::PathBuf;

fn main() {
    let crate_dir = env::var("CARGO_MANIFEST_DIR").unwrap();

    cbindgen::Builder::new()
        .with_crate(crate_dir)
        .with_language(cbindgen::Language::C)
        .with_style(cbindgen::Style::Both)
        .with_no_includes()
        .with_parse_deps(true)
        .with_parse_include(&["libp2p"])
        .generate()
        .expect("Unable to generate bindings")
        .write_to_file("libp2p_ffi.h");
}