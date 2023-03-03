.ONELINE:

IMAGE := simple-container-mgmt
TAG := 0.0.1

OCI := docker

.PHONY: all import run
all: import

result: app/main.ts flake.nix flake.lock default.nix
	nix build .#image

import: result
	$(OCI) load -i result

run: import result
	$(OCI) run -ti -v $$(pwd)/config.json:/config.json:ro -v /var/run/docker.sock:/var/run/docker.sock:ro $(IMAGE):$(TAG)