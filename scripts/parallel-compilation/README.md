# P0 Parallel Compilation Diagnostics

These scripts measure the classic compiler and isolated OCCT runtimes. They do
not register a compiler engine or change CLI/compiler behavior.

From the repository root, bundle the probes into the CLI `dist` directory:

```powershell
$aliases = @(
  '--alias:@bushscad/compiler=./packages/compiler/src/index.ts',
  '--alias:@bushscad/compiler/node=./packages/compiler/src/platform/node/node.ts',
  '--alias:@bushscad/evaluator=./packages/evaluator/src/index.ts',
  '--alias:@bushscad/ir=./packages/ir/src/index.ts',
  '--alias:@bushscad/occt-bridge=./packages/occt-bridge/src/index.ts',
  '--alias:@bushscad/parser=./packages/parser/src/index.ts',
  '--alias:@bushscad/resolver=./packages/resolver/src/index.ts'
)

npx esbuild scripts/parallel-compilation/occt-probe-worker.ts --bundle --platform=node --target=node18 --format=esm --outfile=packages/cli/dist/occt-probe-worker.js --external:opencascade.js '--external:opencascade.js/*' @aliases
npx esbuild scripts/parallel-compilation/occt-probe-runner.ts --bundle --platform=node --target=node18 --format=esm --outfile=packages/cli/dist/occt-probe-runner.js
npx esbuild scripts/parallel-compilation/occt-cancellation-probe.ts --bundle --platform=node --target=node18 --format=esm --outfile=packages/cli/dist/occt-cancellation-probe.js
npx esbuild scripts/parallel-compilation/classic-benchmark.ts --bundle --platform=node --target=node18 --format=esm --outfile=packages/cli/dist/classic-benchmark.js --external:opencascade.js '--external:opencascade.js/*' @aliases
npx esbuild scripts/parallel-compilation/p7-benchmark.ts --bundle --platform=node --target=node18 --format=esm --outfile=packages/cli/dist/p7-benchmark.js
```

Representative runs:

```powershell
node packages/cli/dist/occt-probe-runner.js --mode process --workers 2 --idle-ms 5000 --out .bushscad-analysis/parallel-compilation/p0-process-2-native.json
node packages/cli/dist/occt-probe-runner.js --mode thread --workers 2 --idle-ms 5000 --out .bushscad-analysis/parallel-compilation/p0-thread-2.json
node packages/cli/dist/occt-cancellation-probe.js
node packages/cli/dist/classic-benchmark.js --file examples/test_suite/09_assembly_patterns.bscd --out .bushscad-analysis/parallel-compilation/p0-classic-09-assembly-patterns.json
node packages/cli/dist/p7-benchmark.js --runs 3 --workers 1,2,4 --out .bushscad-analysis/parallel-compilation/p7-benchmark.json
```

Probe and benchmark output is intentionally written under
`.bushscad-analysis/`, which is ignored by Git. Keep frozen measurements and
phase decisions in local planning notes rather than the published npm package.
