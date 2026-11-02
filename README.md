# BushSCAD language and compiler

This public project contains the BushSCAD language, compiler and runtime
packages, language server, Three.js renderer, examples, and canonical reference.
The VS Code extension and documentation website are maintained in separate
private projects and consume the public packages from npm.

## Documentation

- [BushSCAD documentation site](https://bushscad.byaidan.com/)
- [Canonical language reference](BushSCAD_Language_Reference_v0.10.md)
- [Compiler pipeline](PIPELINE.md)

## Project layout

- `packages/` contains the parser, resolver, evaluator, compiler, CLI, renderer,
  language server, and supporting public packages.
- `examples/` contains runnable models and regression suites.
- `packages/language-content/` packages the canonical reference and example
  assets for the private website.
- `scripts/` contains reference publication, licensing, and analysis tools.

## Local development

Use the Node version in `.node-version` and the npm version in
`packageManager`. From this directory, run:

```sh
npm ci
npm run docs:check
npm run typecheck
npm test
npm run lint
npm run build:cli
```

Update the canonical reference first, then refresh its generated public
package assets with `npm run docs:publish`.

The package manifests define the public `@bushscad/*` npm packages and their
publishing configuration. Publish those packages only after setting their
initial versions and confirming control of the `@bushscad` npm scope.
