# BushSCAD Pipeline

This document describes how BushSCAD source becomes rendered or exported geometry.
It is intended to be enough context for a developer to modify one layer without
guessing how the rest of the system fits together.

## Full System Flow

BushSCAD has one core pipeline with two user-facing entry points:

```text
BushSCAD source
  -> Parser
  -> Resolver
  -> Evaluator
  -> IR program
  -> OCCT Bridge
  -> Meshes or export buffers
  -> VS Code viewport or CLI output
```

The CLI is the independent command-line entry point. It compiles, checks,
previews, and exports source without a graphical host. The VS Code extension
provides the text editor, language tools, viewport, and export commands while
launching that same CLI compiler service. Both use the parser, resolver,
evaluator, and OCCT bridge described here.

## Layer Responsibilities

### Parser

Location: `packages/parser`

The parser converts source text into an AST. It is responsible for syntax only:

- Tokenizing source text.
- Recognizing declarations, component bodies, functions, loops, conditionals,
  sketch primitives, object operations, placements, face references, imports,
  exports, and environment declarations.
- Preserving source spans for errors.
- Recovering after syntax errors where possible so language clients can still
  show useful diagnostics.

The parser does not decide whether a name exists, whether a referenced sketch is
valid for an operation, or whether a model can be built.

### Resolver

Location: `packages/resolver`

The resolver validates and annotates the AST. It is responsible for names,
imports, assets, and references:

- Building lexical scopes.
- Resolving imports and exported declarations.
- Loading font assets.
- Validating references to variables, sketches, objects, components, functions,
  parts, tags, planes, and face references.
- Recording profile segment names so named face references can be checked.
- Validating operation-level rules that are knowable before evaluation, such as
  `wrap:true` requiring a curved face placement.

The resolver keeps the AST shape. It does not generate IR operations or call
OpenCascade.

### Evaluator

Location: `packages/evaluator`

The evaluator turns a resolved AST into an IR program. It is responsible for
semantic execution:

- Evaluating expressions and environment overrides.
- Expanding loops, conditionals, components, functions, and placements.
- Assigning stable IR object and sketch names when source declarations are
  repeated by loops or placements.
- Converting sketch declarations into numeric IR primitives.
- Converting object declarations into IR operations such as extrude, cut,
  revolve, loft, shell, rotate, fillet, chamfer, and draft.
- Computing lightweight face and solid metrics used by `this`, anchors, inset
  sketches, and placement defaults.
- Carrying material, color, and part context into emitted operations.

The evaluator does not build geometry. It emits a declarative IR program that
the geometry backend can consume.

### IR

Location: `packages/ir`

The IR package defines the shared contracts between layers:

- AST node types.
- IR operation types.
- Sketch primitive and profile segment types.
- Placement, material, mesh, compile error, asset, and export types.
- Small shared geometry helpers used by compiler-adjacent packages.

IR types are the pipeline boundary. If a behavior crosses packages, its data
shape should usually be represented here instead of as ad hoc objects.

### OCCT Bridge

Location: `packages/occt-bridge`

The OCCT bridge turns an IR program into actual geometry using OpenCascade.js.
It is responsible for:

- Installing compile assets such as fonts into the OCCT filesystem.
- Partitioning operations by part.
- Building sketch wires and faces.
- Applying object operations in IR order.
- Maintaining face labels after topology-changing operations.
- Applying finishing modifiers in planned phases.
- Meshing built shapes for the renderer.
- Exporting built shapes to STEP or STL buffers.

The bridge is the only layer that should depend on OCCT APIs directly.

### Renderer

Locations:

- `packages/three-renderer`

The renderer displays meshes returned by the OCCT bridge. It is responsible for:

- Translating mesh buffers into Three.js geometry.
- Applying materials, colors, lighting, camera state, and viewport controls.
- Showing sketch previews and orientation tools.
- Supplying preview rendering components to editor integrations.

The renderer does not parse, resolve, evaluate, or build CAD topology.

### Interaction Provenance

Source/model interaction is a parallel, immutable output of a successful
preview build. Parser ranges identify authored declarations and selector
members; the evaluator records stable semantic entity/effect IDs and expanded
arrays; the OCCT bridge binds those IDs to realized face triangle ranges, edge
polylines, corner points, and placed-sketch transforms. The CLI returns this
`InteractionSnapshot` with preview meshes, and the VS Code extension keeps the
matching pair in its active model session.

The language server and Three.js query the snapshot rather than reparsing identifiers or
guessing from object names. This powers viewport-to-code navigation,
code-to-model highlights, generated-instance identity, and source-linked details for
selector variables and built-in collections such as `edges` and `perimeter`.
The snapshot contains plain transport data only—never VS Code objects, Three.js
objects, OCCT handles, or exported geometry state.

Interaction work is bounded at the UI boundary. Pointer and source-hover events
are coalesced to one accepted update per animation frame, language-server symbol
analysis is cached by document version, and expanded source details are capped while retaining
the complete count. The release budgets are a steady-state hover under one
16.7 ms frame, no compile caused by hover/click, and stable overlay resources
across repeated rebuild/disposal cycles. Spatial acceleration is added only if
the release-scale benchmark exceeds that budget; stable topology IDs must not
depend on the chosen acceleration structure.

Meshes and their matching snapshot are replaced only after a complete
successful build. A compiler or OCCT failure retains the last good pair. Links
for an unchanged document revision remain visibly stale and safe for navigation;
an edit or model switch invalidates them immediately. Malformed optional
provenance is reported as recoverable and disables only affected interaction
data—it must not blank otherwise usable last-good geometry.

## Data Flow

### VS Code Preview Flow

1. The extension collects the active file, project root, unsaved document
   overlays, environment overrides, and loaded assets.
2. The extension sends a versioned preview request to the CLI compiler service.
3. The compiler service parses the active source and any imports.
4. The resolver validates names, imports, and references.
5. The evaluator emits an IR program.
6. The OCCT service or worker builds meshes from the IR program.
7. The extension stores the matching status, errors, meshes, interaction
   snapshot, elapsed time, and environment manifest in its model session.
8. The viewport renders the meshes while the language server and Three.js
   consume the same immutable interaction snapshot.

Document overlays allow unsaved VS Code buffers to compile without waiting for
disk writes.

### VS Code Export Flow

1. The extension sends the same compiler request used for preview.
2. The compiler creates the IR program and assets.
3. The OCCT bridge builds shapes and returns export buffers.
4. The extension writes selected export files through workspace APIs.
5. Status and errors are reported in the extension's Output and Problems views.

### CLI Flow

1. The CLI reads a source file and command-line options.
2. The compiler parses, resolves, evaluates, and loads assets.
3. The node OCCT bridge builds and exports geometry.
4. The CLI writes output files and reports diagnostics.

The CLI performs these steps directly from command-line options and must not
bypass shared compiler semantics.

## Key Concepts

### VS Code Extension

The VS Code extension uses VS Code's native text editor, diagnostics, settings,
and terminal, then launches the independent CLI service for compilation,
preview, and export. Its webviews render models and expose CAD-specific controls.

### CLI

The CLI is the non-interactive command-line interface. It compiles and exports
models from files using the same core language pipeline as the extension.

### AST

The AST is the parsed source tree. It preserves language structure and source
spans. It may still contain unresolved references and unevaluated expressions.

### IR

The IR is the evaluated, numeric, backend-facing program. It contains ordered
operations, concrete placements, materials, parts, workplane information, and
asset references. The OCCT bridge consumes IR.

### Sketch

A sketch is a 2D profile primitive or a `path(...)` sketch. It can be placed on a
workplane or face. Sketches are inputs to object operations such as extrude,
cut, revolve, and loft.

### Solid

A solid is built geometry produced by the OCCT bridge from object operations.
Solids have topology, faces, edges, labels, materials, and part ownership.

### Operation

An operation is an IR step consumed by the OCCT bridge. Examples include
`sketch`, `extrude`, `cut`, `revolve`, `loft`, `shell`, `rotate`, `fillet`,
`chamfer`, `draft`, and `part`.

### Command

A command is the source-language construct that a user writes. Commands parse
to AST nodes, resolve to validated references, evaluate into IR operations, and
finally execute in the bridge if they affect geometry.

## Command Processing

### Sketch Commands

1. Parser reads a sketch declaration and its primitive syntax.
2. Resolver checks expressions inside the primitive and records profile segment
   names for profile sketches.
3. Evaluator resolves numeric primitive data and emits an `IRSketch`.
4. OCCT bridge builds a wire or face and stores it by sketch name.

### Object Commands

Object commands consume sketches and create or modify solids.

#### Extrude

1. Parser reads `extrude(...)` options.
2. Resolver checks the source sketch, depth, optional placement, and wrap rules.
3. Evaluator emits `IRExtrude`, including material and placement data.
4. OCCT bridge positions the sketch face and extrudes it into a body.
5. Face labels and profile named edges are registered for later references.

#### Cut

1. Parser reads `cut(...)` options.
2. Resolver checks the sketch, through target, depth, placement, and wrap rules.
3. Evaluator emits `IRCut`; when `from` is omitted it may use active placement.
4. OCCT bridge builds a tool solid and subtracts it from the target body.
5. The target body is replaced and relabeled.

#### Revolve

1. Parser reads the sketch, angle, axis or face reference, and optional radius.
2. Resolver validates the sketch and non-cardinal face references.
3. Evaluator emits `IRRevolve`.
4. OCCT bridge positions the sketch and revolves it around the selected axis.

#### Loft

1. Parser reads two or more profile sketches and optional guide sketch.
2. Resolver validates all sketch names and guide references.
3. Evaluator checks profile closure and emits `IRLoft`.
4. OCCT bridge builds an unguided loft through positioned profile wires, or a
   guided loft by sweeping section wires along the guide sketch.

### Placement Commands

Placement commands resolve to `IRPlacement` data. A placement records a face
reference, local offsets, radial coordinates, angle, surface angle, rotation,
axis rotation, and optional anchor metadata. The evaluator uses placements to
position sketches and component instances. The OCCT bridge resolves placements
against the face-label map.

### Modifier Commands

Modifiers such as fillet, chamfer, draft, and shell operate on existing bodies
or selected faces/edges.

- Shell runs as a body operation.
- Draft, chamfer, and fillet are queued and flushed around topology-changing
  operations.
- Blend modifiers are grouped by body and phase so conflicting edge selections
  can be reported clearly.

### Parts and Materials

Part boundaries partition the IR operation stream. The OCCT bridge builds each
part, tracks dependencies between parts, and returns meshes or export buffers
with part names. Materials and colors are carried from evaluator context into
IR operations and then grouped by the bridge for rendering and export.

## Mental Model

Think of BushSCAD as three contracts:

1. Source contract: parser and resolver understand the language a user writes.
2. Semantic contract: evaluator executes that language into a deterministic IR
   program.
3. Geometry contract: OCCT bridge turns IR operations into labeled topology and
   renderer/export data.

When adding a feature, decide where it belongs:

- Syntax belongs in the parser.
- Name/reference validation belongs in the resolver.
- Expression evaluation, loop expansion, component placement, and IR emission
  belong in the evaluator.
- Geometry construction and topology labeling belong in the OCCT bridge.
- Mesh display belongs in the renderer; host state belongs in the extension.

Do not make the renderer understand source syntax. Do not make the parser call
OCCT. Do not make the evaluator depend on topology objects. Keeping these
boundaries intact is what makes the system maintainable.
