# BushSCAD Language Specification (Draft)

## 1. Overview

BushSCAD is a domain-specific language for defining geometric models through a deterministic, staged pipeline. The language is declarative at the surface level but executes through a structured evaluation model.

A BushSCAD program defines sketches, objects, and operations that are resolved into a normalized intermediate representation (IR), which is then consumed by downstream systems such as geometry kernels and renderers.

BushSCAD source files use the `.bscd` extension.

---

## 2. Execution Model

A BushSCAD program is processed in the following stages:

```txt
Source → Parser → AST → Resolver → Evaluator → IR → Geometry/Export
```

### 2.1 Parser

Transforms source text into an Abstract Syntax Tree (AST). No semantic validation is performed at this stage beyond syntax correctness.

### 2.2 Resolver

Performs semantic analysis:

- symbol resolution
- scope binding
- reference validation
- import resolution

Produces a semantically valid AST or emits errors.

### 2.3 Evaluator

Executes the resolved AST:

- computes expressions
- applies operations
- builds a normalized IR

### 2.4 Intermediate Representation (IR)

A structured, runtime-independent representation of the model:

- contains only validated, concrete data
- no source-level constructs
- no unresolved references

---

## 3. Core Concepts

### 3.1 Program

A sequence of statements evaluated in order. Statements may define named entities or produce geometry.

### 3.2 Sketch

A 2D geometric definition. Sketches are used as inputs to 3D operations.

Characteristics:

- defined in a local coordinate space
- composed of primitives (e.g. rectangle, circle)
- may include transformations

### 3.3 Object

A 3D solid. Objects are produced by operations such as extrusion or boolean composition.

### 3.4 Operation

A transformation applied to sketches or objects.

Categories:

- construction (e.g. extrude)
- boolean (e.g. cut, union)
- transform (e.g. translate, rotate)

Operations are pure: given the same inputs, they produce the same outputs.

### 3.5 Expression

Evaluates to a value. Expressions may appear as arguments to operations or definitions.

Types include:

- numeric
- vector
- reference
- object
- sketch

### 3.6 Reference

A pointer to a previously defined entity or sub-entity (e.g. face, edge, position).

---

## 4. Syntax Model

### 4.1 Statements

A program consists of statements:

```txt
statement ::= declaration | expression
```

#### Declaration

Introduces a named entity:

```txt
identifier = expression
```

#### Expression Statement

Evaluates an expression for side effects (e.g. producing geometry):

```txt
expression
```

---

### 4.2 Function Calls

Most language constructs are expressed as function-style calls:

```txt
identifier(arg1, arg2, ...)
```

Examples:

- primitive creation
- operations
- transformations

---

### 4.3 Blocks

Certain constructs define scoped blocks:

```txt
sketch name {
  ...
}
```

A block introduces a new scope and produces a value.

---

## 5. Semantic Rules

### 5.1 Determinism

Evaluation must be deterministic. No implicit randomness or hidden state.

### 5.2 Order of Execution

Statements are evaluated in source order. Later statements may reference earlier definitions.

### 5.3 Immutability

Values are immutable once created. Operations return new values.

### 5.4 Scope

- each block introduces a new scope
- identifiers resolve to the nearest enclosing definition
- shadowing is allowed but discouraged

### 5.5 Type Validity

Operations require specific input types. Invalid combinations result in compile errors.

---

## 6. Intermediate Representation (IR)

The IR is the canonical output of the evaluator.

### 6.1 Properties

- fully resolved
- type-safe
- free of source-level constructs
- suitable for geometry generation

### 6.2 Contents

The IR may include:

- objects (solids)
- sketches (flattened or embedded)
- operation results
- material/appearance data
- mesh data (for preview/export)

---

## 7. Errors

Errors are produced during parsing or resolution.

### 7.1 Error Structure

Each error includes:

- message
- source location (file, line, column)

### 7.2 Categories

- syntax errors (parser)
- unresolved identifiers (resolver)
- invalid operations (resolver/evaluator)

Evaluation does not proceed if semantic errors are present.

---

## 8. Imports and Environment

Programs may reference external resources:

- file imports
- fonts
- environment variables

Resolution is handled during the resolver stage.

---

## 9. Geometry Generation

The IR is consumed by a geometry backend (e.g. OpenCascade).

Responsibilities:

- convert IR objects into geometric solids
- apply boolean operations
- generate meshes or export formats

The language itself does not define geometry algorithms.

---

## 10. Design Constraints

### 10.1 Separation of Concerns

- parser: syntax only
- resolver: semantics only
- evaluator: execution only
- IR: data only

### 10.2 No Hidden Side Effects

All transformations are explicit in the source.

### 10.3 Stability of IR

Downstream systems depend on IR structure. Changes must be deliberate and versioned.

---

## 11. Future Extensions

The language is designed to support:

- parametric modeling
- constraints in sketches
- multi-material definitions
- simulation inputs
- plugin-defined operations

These must integrate without violating determinism or pipeline separation.

---

## 12. Status

This specification reflects the current implementation and is subject to change as the language evolves.

---

## 13. Third-Party Licensing

### OpenCascade Technology (OCCT)

BushSCAD uses OpenCascade Technology via `opencascade.js` for geometric modeling.

OpenCascade Technology is licensed under:

- GNU Lesser General Public License v2.1 (LGPL-2.1)
- With the OpenCascade exception

This allows use within proprietary and commercial applications, provided that attribution and license requirements are met.

#### Attribution

This project includes software developed by Open Cascade SAS.

OpenCascade Technology (OCCT) is © Open Cascade SAS.

#### License

A copy of the OpenCascade license (LGPL-2.1 with exception) must be included with any distribution of this software.

The license text can be found at:
https://www.opencascade.com/content/licensing

---

### opencascade.js

BushSCAD uses `opencascade.js`, a JavaScript/WebAssembly port of OpenCascade.

`opencascade.js` is derived from OpenCascade Technology and inherits its licensing terms.

#### Requirements

- Attribution to OpenCascade must be preserved
- License text must be included in distributions
- Modifications to the library must be documented if redistributed

---

### Compliance Notes

BushSCAD does not modify OpenCascade directly.

All usage is through `opencascade.js`, which encapsulates the OpenCascade kernel.

Distribution of BushSCAD must retain:

- this attribution
- a copy of the OCCT license
