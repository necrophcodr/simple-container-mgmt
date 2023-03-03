{
  description = "Simple Container Management";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-22.11";
    utils.url = "github:numtide/flake-utils";
  };
  outputs = { self, nixpkgs, utils, ...}:
    utils.lib.eachDefaultSystem(system:
    let
      pkgs = import nixpkgs { inherit system; };
    in
    {
      devShells.default = import ./shell.nix { inherit pkgs; };
      packages.image = import ./. { inherit pkgs; };
      packages.default = self.packages.${system}.image;
    });
}