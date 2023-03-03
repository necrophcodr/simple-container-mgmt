{ pkgs ? import <nixpkgs> {}, ...}:
let
  src = pkgs.stdenv.mkDerivation {
    name = "simple-container-mgmt";
    version = "0.0.1";

    src = ./.;

    dontConfigure = true;
    dontFetch = true;
    dontBuild = true;

    installPhase = ''
      mkdir -p $out/
      mkdir -p $out/bin
      cp -a app $out/
      cp -a ${pkgs.bun}/bin/bun $out/bin/
    '';
  };
in
pkgs.dockerTools.buildImage {
  name = "simple-container-mgmt";
  tag = "0.0.1";
  copyToRoot = pkgs.buildEnv {
    name = "image-root";
    paths = [ pkgs.src pkgs.docker-client ];
    pathsToLink = [ "/bin" ];
  };
  config = {
    Entrypoint = [ "${src}/bin/bun" "run" "${src}/app/main.ts" ];
    WorkingDir = "/";
  };
}