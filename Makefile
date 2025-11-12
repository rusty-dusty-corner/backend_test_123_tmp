SHELL := /bin/bash

install:
	npm install

dev:
	npm run dev

build:
	npm run build

start:
	npm start

compose-up:
	docker compose up --build

compose-down:
	docker compose down

