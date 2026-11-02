# OpenCascade.js / OCCT source correspondence

BushSCAD redistributes the files listed below without modifying their bytes from
the published **opencascade.js 2.0.0-beta.fdece36** npm artifact.
They are licensed under LGPL-2.1-only with the Open CASCADE Technology exception;
see `THIRD-PARTY-NOTICES.txt` for the complete notices and exception text.

## Exact upstream source and build inputs

- npm artifact: https://registry.npmjs.org/opencascade.js/-/opencascade.js-2.0.0-beta.fdece36.tgz
- npm SHA-512 integrity: `sha512-4IJNYeG9AzowigwGGHOlwY5KmcVQHskbvPdF9J9JhKJdZaUeHGo+8himg4DtyyZLKWDfUlPh430HDbt6jMJWTw==`
- npm tarball SHA-256: `acd6f5bea339a50e71d3270458862128384a351abb6e0186f1eecdc68bac8df2`
- OpenCascade.js source: https://github.com/donalffons/opencascade.js/archive/29d1a8db1bf500eaeaf505f76b85873674c3f0e2.tar.gz
- OpenCascade.js tag/commit: `v2.0.0-beta.fdece36` / `29d1a8db1bf500eaeaf505f76b85873674c3f0e2`
- OCCT source: https://github.com/Open-Cascade-SAS/OCCT/archive/0dc2c377fc5a2d8cf065f4ec005e356240cb484c.tar.gz
- OCCT tag/commit: `V7_5_2` / `0dc2c377fc5a2d8cf065f4ec005e356240cb484c`
- build image: `emscripten/emsdk:2.0.23@sha256:5871ba43a788243cbf890e2cb1a95e33e9cb72dcf52e1d2077ca39f2171f8b07`

The exact npm artifact contains the Dockerfile, GitHub build workflow,
`src_build/` compiler and patch scripts, `src/build.py`, WebAssembly generator,
and `src/builds/opencascade.combined.yml` used for the split modules. Start with
its `README.md`, `Dockerfile`, and `.github/workflows/buildDefault.yml` to
rebuild. The Dockerfile pins the OCCT commit above and the build image records
the Emscripten toolchain. The npm integrity is also pinned in BushSCAD's root
`package-lock.json`.

## Redistributed files

| npm package path                           |    bytes | SHA-256                                                            |
| ------------------------------------------ | -------: | ------------------------------------------------------------------ |
| `package.json`                             |      677 | `d9167b53a296adf4659134f701487e245e961eb6c190576120e55ef838cf83dc` |
| `dist/opencascade.js`                      |  8438113 | `d4355652b7977c2c367ad66c84d4fb9ec15794a9f293027df6116e0d7bf6650c` |
| `dist/opencascade.wasm`                    |  6261201 | `a0c58dc549b05348d9bee65bb62cb5757f95b7daff4d7a8dd994c6cb282cf8b8` |
| `dist/opencascade.core.wasm`               | 18272666 | `98c61ba98772d9966d51ba7ec852e7077ab1e4df74eba33a051da7afec70ccd6` |
| `dist/opencascade.modelingAlgorithms.wasm` | 35290325 | `aee9f57b36dbac249f52d1aa2a188f1d2a45e791da0ba7e24b2bfb2c66270b56` |
| `dist/opencascade.visualApplication.wasm`  | 18129361 | `5de6b3e5fe180f1bbcec98e56117a9f092c2aab354dd6aa32092d0b4bcadb298` |
| `dist/opencascade.dataExchangeBase.wasm`   | 22563464 | `5b3885f5ed38d62789ef73465a65d95adbd18561b9ae1bbf9c10ea62aae073a9` |
| `dist/opencascade.dataExchangeExtra.wasm`  | 14777733 | `f5f4e511a733efe6570492ce7e897d7dff175921f28613d74d11de1fde7730f3` |

BushSCAD packaging verifies the lock identity, byte count, and SHA-256 of every
listed file before creating a VSIX, then independently verifies that the VSIX
contains those same bytes. This record identifies corresponding source and build
instructions; it does not claim that BushSCAD independently reproduced the
upstream binaries.
