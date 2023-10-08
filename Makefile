create-pdf-resume:
	echo "Not implemented"

run:
	cargo build
	trunk serve

install-target: 
	rustup target add wasm32-unknown-unknown

build:
	cargo build
	ls ~/.cargo/bin
	trunk build --verbose

test: 
	cargo test --target wasm32-unknown-unknown --verbose