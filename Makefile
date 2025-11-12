SHELL := /bin/bash

install:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm start

format:
	npm run format

format-check:
	npm run format:check

compose-up:
	docker compose up --build

compose-down:
	docker compose down

