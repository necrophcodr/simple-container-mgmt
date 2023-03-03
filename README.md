# simple-container-mgmt

This is a VERY simple somewhat stateless container management system that, using Docker object labels, creates and removes containers and volumes as needed based on what is currently running, and what has been defined to be running.

Note that it does not currently modify existing containers or volumes, it merely creates/starts and removes these.

The entire project is licensed under the European Union Public License, version 1.2 (EUPL-1.2). See LICENSE.txt for more information.

## Developing

This project uses Nix Flakes and a default development shell is provided. To begin developing, simply use either:

```bash
$ nix-shell
```

or

```bash
$ nix develop
```

to get started.

To run the project in a development shell, run

```bash
bun run app/main.ts
```

Else, it is possible to run this using Docker by letting Nix build a container, and running it with Docker, as follows:

```bash
$ make run
```

## Deployment

To use this project, simply clone it elsewhere, and add a local `config.json` file that corresponds with the following schema:

```json
{
    "label": "a_docker_label",
    "containers":[
        {
            "name": "my-container",
            "image":"registry.io/my_image:tag",
            "restart":"unless-stopped",
            "cap_add": ["SYS_PTRACE"],
            "security_opt":["apparmor=unconfined"],
            "volumes":[{ 
                    src: "/a",
                    dest: "/b" 
                    }],
            "ports":[
                "1234:4321"
            ],
            "entrypoint":["/entrypoint.sh"],
            "cmd": ["-a", "b"]
        }
    ],
    "volumes":[
        {
            "name":"netshare",
            "driver":"local",
            "opts":[
                "type=nfs",
                "o=addr=1.2.3.4,rw",
                "device=/p/a/t/h/"
            ]
        }
    ]
}
```

This system can also be deployed directly from a CI/CD chain. An example GitLab Runner based `.gitlab-ci.yml` is defined below:

```yaml
stages:
- deploy

image: nixpkgs/nix-flakes:nixos-22.11

deploy:
    stage: deploy
    parallel:
        matrix:
        - env: production
          node: prod.labs.local
        - env: development
          node: dev.labs.local
    script:
    - nix develop -c make run TAG=$CI_COMMIT_REF_NAME
    tags:
    - $node
```

The above GitLab CI example of course assumes that a local GitLab runner on the respective nodes matching tags are running with 

```toml
...
[[runners]]
...
  [runners.docker]
  ...
  volumes = ["/var/run/docker.sock:/var/run/docker.sock"]
```

Assuming that the GitLab runner is running with the Docker executor.