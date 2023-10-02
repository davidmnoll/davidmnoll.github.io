create-pdf-resume:
	echo "Not implemented"

run:
	trunk serve

build:
	trunk build

test: 
	cargo test --target wasm32-unknown-unknown