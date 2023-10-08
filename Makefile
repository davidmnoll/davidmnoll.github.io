create-pdf-resume:
	echo "Not implemented"

run:
	trunk serve

build:
	trunk build --verbose

test: 
	cargo test --target wasm32-unknown-unknown --verbose