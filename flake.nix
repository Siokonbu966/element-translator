{
  description = "Description for the project";

  inputs = {
    flake-parts.url = "github:hercules-ci/flake-parts";
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
  };

  outputs = inputs@{ flake-parts, ... }:
    flake-parts.lib.mkFlake { inherit inputs; } {
      imports = [
        # To import an internal flake module: ./other.nix
        # To import an external flake module:
        #   1. Add foo to inputs
        #   2. Add foo as a parameter to the outputs function
        #   3. Add here: foo.flakeModule
      ];
      systems = [ "x86_64-linux" "aarch64-linux" "aarch64-darwin" "x86_64-darwin" ];
      perSystem = { config, self', inputs', pkgs, system, ... }: {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_24
            pnpm_10
          ];
          
          shellHook = ''
            export NPM_CONFIG_MANAGE_PACKAGE_MANAGER_VERSIONS=false

            echo "completed!"
            echo "Node.js version: $(node -v)"
            echo "pnpm version: $(pnpm -v)"

            if [ ! -d node_modules ] || [ pnpm-lock.yaml -nt node_modules/.modules.yaml ]; then
              echo "Installing dependencies with pnpm..."
              pnpm install
            fi
          '';
        };
      };
    };
}
