{ pkgs ? import <nixpkgs> {}, ...}:
with pkgs;
mkShell {
  packages = [
    bun
    gnumake
    docker
  ];
}