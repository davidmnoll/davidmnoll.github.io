run:
	npm run dev

build:
	npm run build

install:
	npm install

refresh-gtoken:
	echo "GCP_ACCESS_TOKEN=$(gcloud auth print-access-token)" >> .env