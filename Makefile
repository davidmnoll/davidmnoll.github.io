create-pdf-resume:
	echo "Not implemented"

run:
	cargo build
	trunk serve


build:
	cargo build
	trunk build --verbose

test: 
	cargo test --target wasm32-unknown-unknown --verbose