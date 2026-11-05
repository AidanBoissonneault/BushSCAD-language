# BushSCAD Language Reference

**Version 0.4.0 - November 2026**

This reference describes BushSCAD syntax and what each language feature does.

## Table of Contents

- [Keyword Reference](#keyword-reference)
- [Language Basics](#language-basics)
- [Sketch Profiles](#sketch-profiles)
- [Solid Primitives](#solid-primitives)
- [Solid Creation](#solid-creation)
- [Solid Editing](#solid-editing)
- [References and Placement](#references-and-placement)
- [Parts and Assemblies](#parts-and-assemblies)
- [Validation and Fits](#validation-and-fits)
- [Import and Export](#import-and-export)
- [VS Code Parallel and Cached Compilation](#vs-code-parallel-and-cached-compilation)
- [Examples](#examples)

## Keyword Reference

Language keywords and built-in forms are grouped by where they are used. Each entry defines the term, links to the relevant syntax guide, and gives an example for each distinct use. When one word has more than one meaning, the uses are documented separately.

### Declarations and control flow

#### `base_unit`

**Purpose.** Sets the default length unit used for bare numeric values in the file.

**Syntax guide.** [Units and global settings](/docs/language-basics#units-global-settings).

**Syntax**

```bushscad
base_unit = mm;
```

**Usage**

```bushscad
base_unit = in;
obj plate = cube([3, 2, 0.25]);
```

#### `workplane`

**Purpose.** Selects the initial sketch plane when a sketch has no explicit placement.

**Syntax guide.** [Units and global settings](/docs/language-basics#units-global-settings).

**Syntax**

```bushscad
workplane = XY | XZ | YZ;
```

**Usage**

```bushscad
workplane = XZ;
sketch profile = rect(30, 12);
obj body = extrude(profile, 5);
```

#### `var`

**Purpose.** Declares a value in the current lexical scope.

**Syntax guide.** [Variables and scope](/docs/language-basics#variables).

**Syntax**

```bushscad
var name = expression;
```

**Usage**

```bushscad
var width = 48;
sketch profile = rect(width, 24);
```

#### `env`

**Purpose.** Declares a build-time value supplied from the environment, with an optional fallback.

**Syntax guide.** [Environment variables](/docs/language-basics#environment-variables).

**Syntax**

```bushscad
env name fallback value;
```

**Usage**

```bushscad
env hole_count = 4;
for index in range(hole_count) {
  sketch hole = circle(2);
}
```

#### `fallback`

**Purpose.** Supplies the value used by an `env` declaration when no build-time value is set.

**Syntax guide.** [Environment variable declarations](/docs/language-basics#declaration-syntax).

**Syntax**

```bushscad
env name fallback value;
```

**Usage**

```bushscad
env thickness fallback 3;
obj panel = cube([40, 30, thickness]);
```

#### `for`

**Purpose.** Starts a loop that repeats its body for values from an iterable. The `in` keyword separates the loop variable from that iterable.

**Syntax guide.** [Loops and control flow](/docs/language-basics#for-loops-control-flow).

**Syntax**

```bushscad
for name in iterable { statements }
```

**Usage**

```bushscad
for index in range(3) {
  sketch hole = circle(2);
}
```

#### `where`

**Purpose.** Filters loop values before the loop body runs.

**Syntax guide.** [The `where` filter](/docs/language-basics#where-filter).

**Syntax**

```bushscad
for name in iterable where condition { statements }
```

**Usage**

```bushscad
for index in range(6) where index % 2 == 0 {
  sketch hole = circle(2);
}
```

#### `in`

**Purpose.** Introduces the iterable used by a `for` loop.

**Syntax guide.** [Loops and control flow](/docs/language-basics#for-loops-control-flow).

**Syntax**

```bushscad
for name in iterable { statements }
```

**Usage**

```bushscad
for size in [2, 3, 4] {
  sketch hole = circle(size);
}
```

#### `if`

**Purpose.** Runs a block only when its condition is true.

**Syntax guide.** [Conditional branches](/docs/language-basics#conditional-if-else).

**Syntax**

```bushscad
if condition { statements } else { statements }
```

**Usage**

```bushscad
if wall >= 2 {
  obj panel = extrude(profile, wall);
} else {
  assert(false, warning: 'Wall is below the design target');
}
```

#### `else`

**Purpose.** Runs the fallback block when the preceding `if` condition is false.

**Syntax guide.** [Conditional branches](/docs/language-basics#conditional-if-else).

**Syntax**

```bushscad
if condition { statements } else { fallbackStatements }
```

**Usage**

```bushscad
if wall >= 2 {
  obj panel = extrude(profile, wall);
} else {
  assert(false, warning: 'Wall is below the design target');
}
```

#### `part`

**Purpose.** Groups geometry as an independently selectable and movable assembly part.

**Syntax guide.** [Parts and assemblies](/docs/parts-and-assemblies#ref-parts).

**Syntax**

```bushscad
part name { statements }
```

**Usage**

```bushscad
part base {
  obj body = cube([40, 30, 5]);
}
```

#### `sketch`

**Purpose.** Declares a named two-dimensional profile for later features.

**Syntax guide.** [Sketch declarations](/docs/sketch-profiles#sketch).

**Syntax**

```bushscad
sketch name = profileExpression;
```

**Usage**

```bushscad
sketch outline = rect(40, 20);
obj body = extrude(outline, 6);
```

#### `obj`

**Purpose.** Gives a geometry result a name so later features can reference it.

**Syntax guide.** [Named geometry objects](/docs/solid-creation#named-geometry-objects-obj).

**Syntax**

```bushscad
obj name = geometryExpression;
```

**Usage**

```bushscad
obj body = cube([40, 30, 8]);
obj cap = cube([40, 30, 3], @body.top);
```

#### `return`

**Purpose.** Ends a function body and emits its named geometry results.

**Syntax guide.** [Function declarations and return values](/docs/language-basics#global-function).

**Syntax**

```bushscad
return { obj name = geometryExpression, }
```

**Usage**

```bushscad
fn plate(width) {
  sketch profile = rect(width, 20);
  return { obj body = extrude(profile, 3), }
}
```

#### `as`

**Purpose.** Gives a name to an imported item, a placed instance, or a primitive within a composed sketch.

##### Import aliases

**Syntax guide.** [Import aliases](/docs/import-and-export#import-forms).

**Syntax**

```bushscad
import { original as imported_name } from './module.bscd';
```

**Example**

```bushscad
import { bracket as mount } from './hardware.bscd';
place(mount);
```

##### Placed-instance aliases

**Syntax guide.** [Placed object aliases](/docs/references-and-placement#place-as-aliasing).

**Syntax**

```bushscad
place(component) as instance_name;
```

**Example**

```bushscad
place(peg, @base.top.center) as mounted_peg;
```

##### Sketch-component aliases

**Syntax guide.** [Sketch component aliases](/docs/sketch-profiles#sketch-component-aliases).

**Syntax**

```bushscad
rect(60, 20) as profile_piece;
```

**Example**

```bushscad
sketch panel = rect(60, 20) as horizontal + rect(20, 60) as vertical;
```

#### `import`

**Purpose.** Loads an external model or language module into the current file.

##### Source modules

**Syntax guide.** [Source import forms](/docs/import-and-export#import-forms).

**Syntax**

```bushscad
import { bracket as mount } from './module.bscd';
import './module.bscd';
```

**Example**

```bushscad
import { bracket } from './hardware.bscd';
place(bracket);
```

##### External geometry

**Syntax guide.** [Imported shapes](/docs/import-and-export#import-forms).

**Syntax**

```bushscad
import shape base = './part.step';
```

**Example**

```bushscad
import shape base = './part.step';
sketch profile = rect(12, 8);
obj copy = extrude(profile, 2, @base.top);
```

#### `export`

**Purpose.** Exposes a declaration for import by other BushSCAD source files. File output uses a separate `export` command in drawing and flat-pattern contexts.

##### Source declarations

**Syntax guide.** [Source exports](/docs/import-and-export#import-export).

**Syntax**

```bushscad
export var name = expression;
export fn name(parameters) { statements }
export part name { statements }
```

**Example**

```bushscad
export part bracket {
  obj body = cube([30, 20, 4]);
}
```

##### Drawing output

**Syntax guide.** [Drawing export syntax](/docs/import-and-export#drawing-and-dxf-export).

**Syntax**

```bushscad
drawing name { export dxf 'path'; }
```

**Example**

```bushscad
drawing plate_view {
  view base.top scale: 1;
  export dxf './exports/plate.dxf';
}
```

### Reuse and metadata

#### `ref`

**Purpose.** Declares reusable geometry that stays hidden until another feature uses or places it.

**Syntax guide.** [Reusable reference parts](/docs/parts-and-assemblies#ref-parts).

**Syntax**

```bushscad
ref name { statements }
ref name = geometryExpression;
```

**Usage**

```bushscad
ref mounting_boss {
  sketch profile = circle(3);
  obj body = extrude(profile, 4);
}
place(mounting_boss, @base.top.center);
```

#### `use`

**Purpose.** Selects a bundled hardware library or a manufacturing tolerance profile.

##### Hardware library

**Syntax guide.** [Importing the standard hardware library](/docs/solid-editing#importing-the-standard-hardware-library).

```bushscad
use std.hardware.metric;
```

**Usage**

```bushscad
use std.hardware.metric;
obj hole = hole(M3.clearance, through base);
```

##### Manufacturing profile

**Syntax guide.** [Importing process profiles](/docs/validation-and-fits#importing-process-profiles).

```bushscad
use std.printing.fdm;
```

**Usage**

```bushscad
use std.printing.fdm;
fit(clearance, bolt, through, bore);
```

#### `this`

**Purpose.** Refers to the face or plane currently used to place a sketch or component.

##### Sketch properties

**Syntax guide.** [The `this.` context in sketches](/docs/references-and-placement#the-this-context).

```bushscad
this.width
this.height
this.center
```

**Usage**

```bushscad
sketch inset = rect(this.width - 10, this.height - 10);
```

##### Component placement

**Syntax guide.** [The `this.` context in components](/docs/references-and-placement#this-in-components).

```bushscad
part name { statements using this.width and this.height }
```

**Usage**

```bushscad
part cover {
  sketch panel = rect(this.width - 4, this.height - 4);
  obj body = extrude(panel, 2);
}
```

#### `fit`

**Purpose.** Declares a manufacturing fit relationship between named parts or features.

**Syntax guide.** [Fit declarations](/docs/validation-and-fits#fit-declarations).

```bushscad
fit(kind, name, relation, target, tolerance: value);
```

**Usage**

```bushscad
fit(clearance, bolt, through, bore);
assert(fit_ok(bolt, bore), warning: 'Check clearance');
```

#### `drawing`

**Purpose.** Defines a named technical drawing with an orthographic view and dimensions.

**Syntax guide.** [Drawing and DXF export](/docs/import-and-export#drawing-and-dxf-export).

```bushscad
drawing name { view reference scale; }
drawing name { view reference scale: value; }
```

**Usage**

```bushscad
drawing plate_view {
  view base.top scale: 1;
  export dxf './exports/plate.dxf';
}
```

#### `color`

**Purpose.** Sets the display color of a part or object.

**Syntax guide.** [Parts and assemblies](/docs/parts-and-assemblies#assembly-placing-components).

```bushscad
part.color = colorValue;
object.color = colorValue;
```

**Usage**

```bushscad
part housing {
  part.color = #2563EB;
  obj body = cube([40, 30, 10]);
}
```

#### `material`

**Purpose.** Assigns a material name to a part or object for presentation and metadata.

**Syntax guide.** [Parts and assemblies](/docs/parts-and-assemblies#assembly-placing-components).

```bushscad
part.material = materialName;
object.material = materialName;
```

**Usage**

```bushscad
part housing {
  part.material = 'PLA';
  obj body = cube([40, 30, 10]);
}
```

### Sketch profiles

#### `rect`

**Purpose.** Creates a rectangular 2D profile from its width and height, with optional rounded corners, named sides, and placement origin.

**Syntax**

```bushscad
rect(width, height, radius?)
rect(width: value, height: value, r: value, origin: corner)
rect(width, height, bottom: identifier, left: identifier) plant bottom
```

**Arguments**

- `width, height`: Full horizontal and vertical dimensions; numeric lengths default to millimetres.
- `radius / r / cornerRadius`: Optional corner radius; omitting it creates sharp corners.
- `bottom, right, top, left`: Optional side names supplied as bare identifiers. Effective names must be unique.
- `origin`: center by default; corner anchors from the top-left of evaluated 2D bounds. A final bare corner is also accepted.

**Syntax guide.** [Sketch profiles](/docs/sketch-profiles#primitives).

**Usage**

```bushscad
var width = 60;
sketch plate = rect(_, 40);
@plate.bottom = width;
```

**Related:** [`roundrect`](#roundrect).

**More:** [sketch profiles](/docs/sketch-profiles#primitives).

#### `circle`

**Purpose.** Creates a circular 2D profile from its full diameter.

**Syntax**

```bushscad
circle(diameter)
circle(d: value, origin: corner)
circle(diameter, @body.top)
```

**Arguments**

- `diameter / d`: Full circle diameter, not radius; use 2 * radius when sizing from a radius.
- `origin`: center by default; corner or a final bare corner anchors at the top-left of the bounds.

**Syntax guide.** [Sketch profiles](/docs/sketch-profiles#primitives).

**Usage**

```bushscad
sketch hole = circle(_);
@hole.diameter = 12;
```

**Related:** [`ellipse`](#ellipse), [`extrude`](#extrude), [`cut`](#cut).

**More:** [sketch profiles](/docs/sketch-profiles#primitives).

#### `ellipse`

**Purpose.** Creates an elliptical 2D profile from its full width and height.

**Syntax**

```bushscad
ellipse(width, height)
ellipse(width, height) at (x, y)
```

**Arguments**

- `width, height`: Positive full dimensions, not semiaxis radii. Arguments are positional.

**Syntax guide.** [Sketch profiles](/docs/sketch-profiles#primitives).

**Usage**

```bushscad
sketch seal = ellipse(_, 20) at (8, 0);
@seal.width = 40;
```

**Related:** [`circle`](#circle), [`path`](#path), [`construction`](#construction).

**More:** [sketch profiles](/docs/sketch-profiles#primitives).

#### `roundrect`

**Purpose.** Creates a rectangle with rounded corners from its width, height, and corner radius.

**Syntax**

```bushscad
roundrect(width, height, radius)
roundrect(width: value, height: value, r: value, origin: corner)
```

**Arguments**

- `width, height`: Full outer dimensions of the rounded rectangle.
- `radius / r`: Corner radius. A radius equal to half the smaller dimension produces a stadium-like slot.
- `origin`: center by default; corner anchors from top-left bounds.

**Syntax guide.** [Sketch profiles](/docs/sketch-profiles#primitives).

**Usage**

```bushscad
sketch slot = roundrect(20, 8, r: 4);
obj pad = extrude(slot, 3);
```

**Related:** [`rect`](#rect), [`offset`](#offset), [`extrude`](#extrude).

**More:** [sketch profiles](/docs/sketch-profiles#primitives).

#### `triangle`

**Purpose.** Creates an isosceles triangular profile from its base width and height.

**Syntax**

```bushscad
triangle(base, height)
triangle(base: value, height: value, origin: corner)
```

**Arguments**

- `base`: Full width of the base edge.
- `height`: Perpendicular distance from the base to the apex.
- `origin`: center by default; corner or a final bare corner changes the anchor to top-left bounds.

**Syntax guide.** [Sketch profiles](/docs/sketch-profiles#primitives).

**Usage**

```bushscad
sketch gusset = triangle(30, 20);
obj rib = extrude(gusset, 4);
```

**Related:** [`polygon`](#polygon), [`wrap`](#wrap), [`extrude`](#extrude).

**More:** [sketch profiles](/docs/sketch-profiles#primitives).

#### `polygon`

**Purpose.** Creates a closed profile by connecting an ordered list of 2D points.

**Syntax**

```bushscad
polygon([(x1, y1), (x2, y2), (x3, y3), ...])
polygon(points, origin: corner)
```

**Arguments**

- `points`: An inline list of (x, y) tuples defining the boundary vertices.
- `origin`: center by default; corner anchors from the top-left of evaluated bounds.

**Syntax guide.** [Sketch profiles](/docs/sketch-profiles#primitives).

**Usage**

```bushscad
sketch outline = polygon([(0, 0), (30, 0), (15, 26)]);
```

**Related:** [`triangle`](#triangle), [`path`](#path), [`wrap`](#wrap).

**More:** [sketch profiles](/docs/sketch-profiles#primitives).

#### `word`

**Purpose.** Creates a 2D outline from text and a selected font.

**Syntax**

```bushscad
word(text, size?, font?, align?, origin?)
word(text, 8, 'sans', center)
word(text, size: 8, font: 'sans', align: center)
```

**Arguments**

- `text`: A string expression, including a string variable or environment value.
- `size`: Text size as a length; defaults to 8.
- `font`: CSS-style font-family string. VS Code resolves workspace fonts before installed system fonts; sans, serif, and mono use bundled outlines.
- `align`: center (default), left, or right relative to the sketch anchor.
- `origin`: Optional center or corner anchor; corner uses the top-left of evaluated bounds.

Argument labels are optional. Positional options follow size, font, alignment,
then origin. Contextual words such as `center`, `left`, `right`, and `corner`
can be supplied without quotes.

**Syntax guide.** [Word sketches](/docs/sketch-profiles#word-sketch).

**Usage**

```bushscad
sketch label = word('FRONT', size: 8, font: 'sans', align: center);
obj badge = extrude(label, 1.2);
```

**Related:** [`extrude`](#extrude), [`cut`](#cut).

**More:** [sketch profiles](/docs/sketch-profiles#word-sketch).

#### `inset`

**Purpose.** Creates a smaller rectangular profile within the current sketching context.

**Syntax**

```bushscad
rect inset(amount)
rect inset(x, y)
rect inset(top: value, sides: value, bottom: value)
```

**Arguments**

- `amount`: Margin removed from every side; width and height each shrink by twice this amount.
- `x, y`: Separate horizontal and vertical margins.
- `top, sides, bottom`: Explicit upper, left/right, and lower margins.

**Syntax guide.** [Inset profiles](/docs/sketch-profiles#inset-shorthand).

**Usage**

```bushscad
sketch footprint = rect(60, 40);
obj body = extrude(footprint, 6);
sketch lid = rect inset(5, @body.top);
obj raised = extrude(lid, 2);
```

**Related:** [`rect`](#rect), [`offset`](#offset).

**More:** [sketch profiles](/docs/sketch-profiles#inset-shorthand).

#### `offset`

**Purpose.** `offset` changes a profile's size, shifts a construction plane, or moves an anchor-local edge position. These are separate forms with different effects.

##### 2D profile offset

**Syntax guide.** [Offset profiles](/docs/sketch-profiles#primitives).

**Syntax**

```bushscad
offset(sketch, distance)
```

**Arguments**

- `sketch`: An exact rect, circle, or roundrect primitive (or reference evaluating to one).
- `distance`: Positive expands; negative shrinks. Full width/height or diameter changes by twice this value.

**Example**

```bushscad
sketch padded = offset(rect(40, 20), 2);
sketch larger_hole = offset(circle(8), 1);
```

##### Construction-plane offset

**Syntax guide.** [Named and inline planes](/docs/references-and-placement#planes).

**Syntax**

```bushscad
plane above = offset(distance, @reference);
@plane(reference, offset: distance)
```

**Example**

```bushscad
obj base = cube([40, 30, 5]);
plane above = offset(10, @base.top);
```

##### Anchor-local offset

**Syntax guide.** [Offset from a face anchor](/docs/references-and-placement#offset-from-a-face-anchor).

**Syntax**

```bushscad
@target.edge(offset: distance)
```

**Example**

```bushscad
obj slot = cut(slot_profile, 3, @base.top.front_edge(offset: 8));
```

**Related:** [`inset`](#inset), [`rect`](#rect), [`circle`](#circle), [`roundrect`](#roundrect), [`plane`](#plane).

**More:** [sketch profiles](/docs/sketch-profiles#primitives).

### Sketch paths and constraints

#### `path`

**Purpose.** Builds a 2D sketch from connected segments, compact primitives, and constraints. A separate path declaration can define a 3D sweep guide.

##### 2D sketch path

**Syntax guide.** [Path sketches](/docs/sketch-profiles#path-sketch).

**Syntax**

```bushscad
sketch name = path(entries...)
```

**Arguments**

- `entries`: 2D line/arc/close segments, compact rect/circle/ellipse members, construction geometry, origin metadata, body expressions, constraints, and reference dimensions.

**Example**

```bushscad
sketch plate = path(
  plant bottom = line((0, 0), (20, 0)),
  right = line(20, 10), top = line(0, 10), left = close()
);
obj body = extrude(plate, 4);
```

**Related:** [`line`](#line), [`arc`](#arc), [`close`](#close), [`loop`](#loop), [`constraint`](#constraint), [`polyline`](#polyline), [`spline`](#spline).

**More:** [sketch profiles](/docs/sketch-profiles#path-sketch).

##### 3D sweep-guide path

**Syntax guide.** [Path declarations for sweeps](/docs/solid-creation#path-declarations).

**Syntax**

```bushscad
path name = polyline([(x, y, z), ...]);
path name = spline([(x, y, z), ...]);
```

**Example**

```bushscad
path rail = polyline([(0, 0, 0), (0, 0, 30)]);
sketch section = circle(3);
obj rod = sweep(section along rail);
```

#### `line`

**Purpose.** Adds a straight segment to a 2D path.

**Syntax**

```bushscad
name = line((x1, y1), (x2, y2))
name = line(x, y)
name = line((x, y))
line([(x, y), ...])
```

**Arguments**

- `points`: Two displayed endpoints must both use tuple syntax. A single endpoint may be a tuple or two scalar coordinates.

**Syntax guide.** [Path sketches](/docs/sketch-profiles#path-sketch).

**Usage**

```bushscad
sketch outline = path(
  base = line((0, 0), (20, 0)),
  line([(20, 10), (0, 10)]), close()
);
```

**Related:** [`path`](#path), [`arc`](#arc), [`close`](#close), [`construction`](#construction).

**More:** [sketch profiles](/docs/sketch-profiles#path-sketch).

#### `arc`

**Purpose.** Adds a circular arc segment between two points on a 2D path.

**Syntax**

```bushscad
name = arc(endpoint, radius?, direction?)
name = arc(start, end, radius?, direction?)
name = arc(start: point, end: point, radius: value, direction: cw|ccw)
```

**Arguments**

- `endpoint(s)`: One point continues from the path cursor; two point tuples establish explicit start and end points.
- `radius`: Optional circle radius. With two endpoints and no radius, the arc is a semicircle spanning them.
- `cw / ccw`: Optional travel direction; defaults to `ccw`. The aliases clockwise and counterclockwise are accepted.

**Syntax guide.** [Arc and curve primitives](/docs/sketch-profiles#arc-curve-primitives-in-sketches).

**Usage**

```bushscad
sketch cap = path(
  base = line((0, 0), (20, 0)),
  rim = arc((0, 0), (20, 0))
);
```

**Related:** [`line`](#line), [`path`](#path).

**More:** [sketch profiles](/docs/sketch-profiles#arc-curve-primitives-in-sketches).

#### `close`

**Purpose.** Closes a path by connecting its current endpoint to the loop start.

**Syntax**

```bushscad
close()
name = close()
```

**Arguments**

This form takes no arguments.

**Syntax guide.** [Path sketches](/docs/sketch-profiles#path-sketch).

**Usage**

```bushscad
sketch triangle_outline = path(
  base = line((0, 0), (20, 0)), side = line(10, 15), return_edge = close()
);
```

**Related:** [`path`](#path), [`line`](#line), [`loop`](#loop).

**More:** [sketch profiles](/docs/sketch-profiles#path-sketch).

#### `loop`

**Purpose.** Selects a closed path region by naming one of its features.

**Syntax**

```bushscad
body = loop(feature)
body = outer_feature - hole_feature
```

**Arguments**

- `feature`: A named line, arc, or closing edge in the same path.

**Syntax guide.** [Path sketches](/docs/sketch-profiles#path-sketch).

**Usage**

```bushscad
sketch plate = path(
  outer_bottom = line((0, 0), (80, 0)),
  outer_right = line(80, 40), outer_top = line(0, 40), outer_left = close(),
  hole_bottom = line((25, 10), (55, 10)),
  hole_right = line(55, 30), hole_top = line(25, 30), hole_left = close(),
  outer = loop(outer_bottom), hole = loop(hole_bottom), shell = outer - hole
);
obj wall = extrude(plate.shell, 5);
```

**Related:** [`path`](#path), [`ignore`](#ignore), [`closed`](#closed), [`extrude`](#extrude), [`cut`](#cut).

**More:** [sketch profiles](/docs/sketch-profiles#path-sketch).

#### `ignore`

**Purpose.** Excludes selected path regions from whole-sketch operations.

**Syntax**

```bushscad
ignore(body_expression)
ignore(loop(feature))
```

**Arguments**

- `body_expression`: Feature names, loop(feature), earlier body aliases, or expressions using +, -, and &.

**Syntax guide.** [Path sketches](/docs/sketch-profiles#path-sketch).

**Usage**

```bushscad
sketch plate = path(
  outer_bottom = line((0, 0), (80, 0)),
  outer_right = line(80, 40), outer_top = line(0, 40), outer_left = close(),
  hole_bottom = line((25, 10), (55, 10)),
  hole_right = line(55, 30), hole_top = line(25, 30), hole_left = close(),
  hole = loop(hole_bottom), ignore(hole)
);
```

**Related:** [`loop`](#loop), [`ignoreClosed`](#ignoreclosed), [`path`](#path).

**More:** [sketch profiles](/docs/sketch-profiles#path-sketch).

#### `closed`

**Purpose.** Selects a closed path region using a point inside it.

**Syntax**

```bushscad
body = closed(x, y)
body = closed((x, y))
```

**Arguments**

- `x, y`: Coordinates of a point inside the body to select.

**Syntax guide.** [Path sketches](/docs/sketch-profiles#path-sketch).

**Usage**

```bushscad
sketch plate = path(
  outer_bottom = line((0, 0), (80, 0)),
  outer_right = line(80, 40), outer_top = line(0, 40), outer_left = close(),
  hole_bottom = line((25, 10), (55, 10)),
  hole_right = line(55, 30), hole_top = line(25, 30), hole_left = close(),
  hole = closed(40, 20)
);
```

**Related:** [`loop`](#loop), [`ignoreClosed`](#ignoreclosed).

**More:** [sketch profiles](/docs/sketch-profiles#path-sketch).

#### `ignoreClosed`

**Purpose.** Excludes a closed path region selected by a point inside it.

**Syntax**

```bushscad
ignoreClosed(x, y)
ignoreClosed((x, y))
```

**Arguments**

- `x, y`: A point inside the region to exclude.

**Syntax guide.** [Path sketches](/docs/sketch-profiles#path-sketch).

**Usage**

```bushscad
sketch plate = path(
  outer_bottom = line((0, 0), (80, 0)),
  outer_right = line(80, 40), outer_top = line(0, 40), outer_left = close(),
  hole_bottom = line((25, 10), (55, 10)),
  hole_right = line(55, 30), hole_top = line(25, 30), hole_left = close(),
  ignoreClosed(40, 20)
);
```

**Related:** [`ignore`](#ignore), [`closed`](#closed), [`loop`](#loop).

**More:** [sketch profiles](/docs/sketch-profiles#path-sketch).

#### `construction`

**Purpose.** Marks sketch curves as guide geometry that does not bound a solid profile.

**Syntax**

```bushscad
construction name = line((x1, y1), (x2, y2))
construction ellipse(width, height)
construction(sketch_profile)
```

**Arguments**

- `name`: Optional label for a named path segment.
- `geometry`: A line, arc, ellipse, or sketch profile to mark as construction geometry. Line and ellipse forms use their usual point or dimension arguments.

**Syntax guide.** [Path sketches](/docs/sketch-profiles#path-sketch).

**Usage**

```bushscad
sketch plate = path(
  rect(80, 40),
  construction centerline = line((-40, 0), (40, 0))
);
```

**Related:** [`path`](#path), [`constraint`](#constraint), [`dimension`](#dimension).

**More:** [sketch profiles](/docs/sketch-profiles#path-sketch).

#### `polyline`

**Purpose.** Creates a 3D guide path by connecting an ordered list of points.

**Syntax**

```bushscad
path name = polyline([(x, y, z), ...]);
```

**Arguments**

- `points`: An inline list of three-coordinate tuples; use at least two points.

**Syntax guide.** [3D path declarations](/docs/solid-creation#path-declarations).

**Usage**

```bushscad
path rail = polyline([(0, 0, 0), (0, 0, 30)]);
sketch section = circle(3);
obj rod = sweep(section along rail);
```

**Related:** [`path`](#path), [`spline`](#spline), [`sweep`](#sweep).

**More:** [solid creation](/docs/solid-creation#sweep-and-path-modeling).

#### `spline`

**Purpose.** Creates either a 3D sweep guide or a limited 2D sketch curve. The two forms use different point dimensions.

##### 3D sweep guide

**Syntax guide.** [3D path declarations](/docs/solid-creation#path-declarations).

**Syntax**

```bushscad
path name = spline([(x, y, z), ...]);
```

**Example**

```bushscad
path handle = spline([(0, 0, 0), (20, 0, 10), (40, 0, 0)]);
sketch section = circle(3);
obj rod = sweep(section along handle);
```

##### 2D sketch curve

**Syntax guide.** [Sketch curves](/docs/sketch-profiles#arc-curve-primitives-in-sketches).

**Syntax**

```bushscad
sketch name = spline([(x1, y1), (x2, y2)]);
```

**Arguments**

- `points`: A 3D point list for paths; the supported sketch form accepts exactly two 2D points and makes a straight line profile.

**Example**

```bushscad
sketch guide_line = spline([(0, 0), (20, 0)]);
```

**Related:** [`polyline`](#polyline), [`path`](#path), [`sweep`](#sweep), [`line`](#line).

**More:** [solid creation](/docs/solid-creation#sweep-and-path-modeling).

#### `constraint`

**Purpose.** Adds a geometric relation or driving dimension to path geometry.

**Syntax**

```bushscad
constraint(target, relation[, reference])
constraint(segment, length|angle|radius|diameter, value[, (label_x, label_y)])
constraint(point, distance, reference, value, axis: x|y, at: (label_x, label_y))
```

**Arguments**

- `target`: A named point, segment, or segment endpoint (.start or .end).
- `relation`: horizontal, vertical, parallel, perpendicular, tangent, equal, symmetric, fixed, coincident, midpoint, length, distance, angle, radius, or diameter.
- `reference`: A second segment/point, origin, origin.x_axis, or origin.y_axis where the relation permits it.
- `value`: Driving numeric expression for a dimensional constraint; supports variables, units, arithmetic, and named sketch measurements.
- `label`: Optional display position as a final tuple; the older at: (x, y) form is also accepted.

**Syntax guide.** [Sketch constraints](/docs/sketch-profiles#sketch-constraint-system).

**Usage**

```bushscad
sketch plate = path(
  bottom = line((0, 0), (40, 0)), right = line(40, 20),
  top = line(0, 20), left = close(),
  constraint(bottom.start, fixed),
  constraint(bottom, horizontal),
  constraint(right, length, 20, (48, 10)) as wall_height
);
```

**Related:** [`dimension`](#dimension), [`distance`](#distance).

**More:** [sketch profiles](/docs/sketch-profiles#sketch-constraint-system).

#### `dimension`

**Purpose.** Displays a reference measurement on a sketch without driving its geometry.

**Syntax**

```bushscad
dimension segment.length at (x, y)
dimension point.distance to reference axis: x|y at (x, y)
dimension segment.angle to reference at (x, y)
dimension segment.radius at (x, y) as name
dimension object.width;
dimension object.height;
dimension object.depth;
dimension first.face to second.face;
```

**Arguments**

- `property`: length, distance, angle, radius, or diameter, according to the target geometry.
- `to reference`: Second endpoint/point, segment, origin, or a global origin axis for relative measurements.
- `axis`: Optional x or y component for point distances; omit it for aligned Euclidean distance.
- `at (x, y)`: Required reference-dimension label position in sketch coordinates.

**Syntax guide.** [Sketch dimensions](/docs/sketch-profiles#sketch-constraint-system).

**Usage**

```bushscad
obj plate = cube([40, 30, 4]);
drawing top_sheet {
  view plate.top;
  dimension plate.width;
  dimension plate.left to plate.right;
}
```

**Related:** [`constraint`](#constraint), [`distance`](#distance).

**More:** [sketch profiles](/docs/sketch-profiles#sketch-constraint-system).

### Three-dimensional primitives

#### `cube`

**Purpose.** Creates a block with equal sides, or a rectangular cuboid when given three dimensions.

**Syntax**

```bushscad
obj name = cube(size, @placement);
obj name = cube(width, depth, height);
obj name = cube(width: x, depth: y, height: z);
```

**Arguments**

- `size`: Positive scalar for equal sides, or [X width, Y depth, Z height].
- `width, depth, height`: Named dimension alternatives when size is omitted; each defaults to 1.

**Syntax guide.** [3D primitives](/docs/solid-primitives#direct-3d-primitives).

**Usage**

```bushscad
obj block = cube(12);
```

**Related:** [`cuboid`](#cuboid), [`rect`](#rect), [`extrude`](#extrude), [`roundedCuboid`](#roundedcuboid).

**More:** [solid primitives](/docs/solid-primitives#direct-3d-primitives).

#### `cuboid`

**Purpose.** Creates a rectangular solid from its X, Y, and Z dimensions.

**Syntax**

```bushscad
obj name = cuboid([width, depth, height], @placement);
obj name = cuboid(width, depth, height);
obj name = cuboid(width: x, depth: y, height: z);
```

**Arguments**

- `size`: Positive scalar for equal sides, or [X width, Y depth, Z height].
- `width, depth, height`: Named dimension alternatives when size is omitted; each defaults to 1.

**Syntax guide.** [3D primitives](/docs/solid-primitives#direct-3d-primitives).

**Usage**

```bushscad
obj plate = cuboid(width: 60, depth: 40, height: 4);
```

**Related:** [`cube`](#cube), [`roundedCuboid`](#roundedcuboid), [`extrude`](#extrude).

**More:** [solid primitives](/docs/solid-primitives#direct-3d-primitives).

#### `sphere`

**Purpose.** Creates a sphere centered on its placement origin.

**Syntax**

```bushscad
obj name = sphere(r: radius, segments: count, @placement);
obj name = sphere(radius, segments);
obj name = sphere(d: diameter);
```

**Arguments**

- `r / radius`: Positive radius; defaults to 1. The first positional value supplies it.
- `d / diameter`: Positive full diameter, converted to radius when labeled; an unlabeled first value means radius.
- `segments`: Meridian profile subdivisions, rounded to an integer with a minimum of 3; default 48.

**Syntax guide.** [3D primitives](/docs/solid-primitives#direct-3d-primitives).

**Usage**

```bushscad
obj ball = sphere(10, 64);
```

**Related:** [`ellipsoid`](#ellipsoid), [`geodesicSphere`](#geodesicsphere), [`revolve`](#revolve).

**More:** [solid primitives](/docs/solid-primitives#direct-3d-primitives).

#### `ellipsoid`

**Purpose.** Creates an ellipsoid from its X, Y, and Z radii; supported shapes are rotationally symmetric spheroids.

**Syntax**

```bushscad
obj name = ellipsoid(radius: [rx, ry, rz], segments: count);
obj name = ellipsoid([rx, ry, rz], segments);
```

**Arguments**

- `radius`: Three positive half-extents, not full diameters; default [1, 1, 1].
- `segments`: Meridian subdivision count; default 48.

**Syntax guide.** [3D primitives](/docs/solid-primitives#direct-3d-primitives).

**Usage**

```bushscad
obj dome = ellipsoid(radius: [10, 10, 18], segments: 64);
```

**Related:** [`sphere`](#sphere), [`revolve`](#revolve).

**More:** [solid primitives](/docs/solid-primitives#direct-3d-primitives).

#### `geodesicSphere`

**Purpose.** Creates a spherical solid with the same behavior as sphere.

**Syntax**

```bushscad
obj name = geodesicSphere(radius, segments);
```

**Arguments**

- `r / radius`: Positive radius; defaults to 1. The first positional value supplies it.
- `d / diameter`: Positive full diameter, converted to radius when labeled; an unlabeled first value means radius.
- `segments`: Meridian profile subdivisions, rounded to an integer with a minimum of 3; default 48.

**Syntax guide.** [3D primitives](/docs/solid-primitives#direct-3d-primitives).

**Usage**

```bushscad
obj ball = geodesicSphere(d: 20, segments: 48);
```

**Related:** [`sphere`](#sphere), [`polyhedron`](#polyhedron).

**More:** [solid primitives](/docs/solid-primitives#direct-3d-primitives).

#### `cylinder`

**Purpose.** Creates a circular cylinder, optionally tapered between different end radii.

**Syntax**

```bushscad
obj name = cylinder(height, radius, @placement);
obj name = cylinder(h: height, d: diameter);
obj name = cylinder(height, r1: bottomRadius, r2: topRadius);
```

**Arguments**

- `height / h`: Positive axial length; first positional argument, default 1.
- `r / radius / d / diameter`: Circular section size; radius is the second positional argument, default 1.
- `r1, r2 / d1, d2`: Optional bottom and top radius/diameter overrides for taper.

**Syntax guide.** [3D primitives](/docs/solid-primitives#direct-3d-primitives).

**Usage**

```bushscad
obj base = cube([30, 30, 4]);
obj pin = cylinder(12, d: 6, @base.top.center);
```

**Related:** [`cone`](#cone), [`frustum`](#frustum), [`cylinderElliptic`](#cylinderelliptic).

**More:** [solid primitives](/docs/solid-primitives#direct-3d-primitives).

#### `cylinderElliptic`

**Purpose.** Creates a cylinder or taper with elliptical end sections.

**Syntax**

```bushscad
obj name = cylinderElliptic(height, radius);
obj name = cylinderElliptic(height, radius, startRadius, endRadius, segments);
```

**Arguments**

- `height`: Positive axial length; default 1.
- `radius`: Default X/Y half-extents for both ends; default [1, 1].
- `startRadius / endRadius`: Override the bottom/top pair; every component must be positive.
- `segments`: Polygon subdivision count; geometry uses at least 12 sections.

**Syntax guide.** [3D primitives](/docs/solid-primitives#direct-3d-primitives).

**Usage**

```bushscad
obj oval = cylinderElliptic(20, [10, 6], segments: 48);
```

**Related:** [`ellipse`](#ellipse), [`extrude`](#extrude), [`loft`](#loft), [`cylinder`](#cylinder).

**More:** [solid primitives](/docs/solid-primitives#direct-3d-primitives).

#### `cone`

**Purpose.** Creates a cone from a base radius, height, and optional placement.

**Syntax**

```bushscad
obj name = cone(height, radius, @placement);
obj name = cone(height: h, d: diameter);
```

**Arguments**

- `height / h`: Positive height along local Z; default 1.
- `r / radius / d / diameter`: Base section size; radius is the second positional argument, default 1.

**Syntax guide.** [3D primitives](/docs/solid-primitives#direct-3d-primitives).

**Usage**

```bushscad
obj tip = cone(height: 20, r: 8);
```

**Related:** [`frustum`](#frustum), [`cylinder`](#cylinder).

**More:** [solid primitives](/docs/solid-primitives#direct-3d-primitives).

#### `frustum`

**Purpose.** Creates a truncated cone from its bottom radius, top radius, and height.

**Syntax**

```bushscad
obj name = frustum(height, bottomRadius, topRadius);
obj name = frustum(height: h, r1: bottom, r2: top);
```

**Arguments**

- `height`: Positive axial length; default 1.
- `r1 / radiusBottom`: Positive bottom radius; default 1. d1/diameterBottom supplies a diameter.
- `r2 / radiusTop`: Non-negative top radius; default 0.5. Zero produces a cone. d2/diameterTop supplies a diameter.

**Syntax guide.** [3D primitives](/docs/solid-primitives#direct-3d-primitives).

**Usage**

```bushscad
obj reducer = frustum(height: 25, r1: 12, r2: 6);
```

**Related:** [`cone`](#cone), [`cylinder`](#cylinder), [`loft`](#loft).

**More:** [solid primitives](/docs/solid-primitives#direct-3d-primitives).

#### `roundedCuboid`

**Purpose.** Creates a block with a rounded rectangular footprint and rounded vertical corners.

**Syntax**

```bushscad
obj name = roundedCuboid([width, depth, height], radius, segments);
```

**Arguments**

- `size`: Positive scalar for equal sides, or [X width, Y depth, Z height].
- `width, depth, height`: Named dimension alternatives when size is omitted; each defaults to 1.
- `r / radius`: Footprint corner radius; defaults to 0 and clamps to half the smaller footprint dimension.
- `segments`: Controls polygon samples around footprint corners; default 48.

**Syntax guide.** [3D primitives](/docs/solid-primitives#direct-3d-primitives).

**Usage**

```bushscad
obj case_body = roundedCuboid(size: [60, 40, 12], r: 4);
```

**Related:** [`roundrect`](#roundrect), [`extrude`](#extrude), [`fillet`](#fillet).

**More:** [solid primitives](/docs/solid-primitives#direct-3d-primitives).

#### `roundedCylinder`

**Purpose.** Creates a cylindrical solid with an optional rounding-radius setting.

**Syntax**

```bushscad
obj name = roundedCylinder(height, radius, radiusBottom, radiusTop, segments, roundingRadius);
```

**Arguments**

- `height / r`: Positive axial height and circular radius, as for cylinder.
- `roundingRadius`: Non-negative rounding amount, default 0; currently retained in IR but unused by the geometry builder.

**Syntax guide.** [3D primitives](/docs/solid-primitives#direct-3d-primitives).

**Usage**

```bushscad
obj pin = roundedCylinder(height: 20, r: 6, roundingRadius: 0);
```

**Related:** [`cylinder`](#cylinder), [`fillet`](#fillet).

**More:** [solid primitives](/docs/solid-primitives#direct-3d-primitives).

#### `torus`

**Purpose.** Creates a ring-shaped solid from its major and minor radii.

**Syntax**

```bushscad
obj name = torus(majorRadius, minorRadius, majorSegments, minorSegments);
```

**Arguments**

- `majorRadius`: Positive distance from the rotation axis to the tube center; default 10.
- `minorRadius`: Positive tube radius; default 2. Outer diameter is 2 * (majorRadius + minorRadius).
- `minorSegments`: Tube profile subdivisions; minimum 8, default 16.

**Syntax guide.** [3D primitives](/docs/solid-primitives#direct-3d-primitives).

**Usage**

```bushscad
obj ring = torus(majorRadius: 20, minorRadius: 3, minorSegments: 32);
```

**Related:** [`revolve`](#revolve), [`circle`](#circle).

**More:** [solid primitives](/docs/solid-primitives#direct-3d-primitives).

#### `polyhedron`

**Purpose.** Builds a solid from 3D vertices and face index lists.

**Syntax**

```bushscad
obj name = polyhedron(points: [[x, y, z], ...], faces: [[i, j, k], ...]);
```

**Arguments**

- `points`: List of [X, Y, Z] vertex coordinates.
- `faces`: Each face is an ordered loop of at least three vertex indices; triangles is an alias.

**Syntax guide.** [3D primitives](/docs/solid-primitives#direct-3d-primitives).

**Usage**

```bushscad
obj tetra = polyhedron(points: [[0,0,0], [10,0,0], [0,10,0], [0,0,10]], faces: [[0,2,1], [0,1,3], [0,3,2], [1,2,3]]);
```

**Related:** [`cube`](#cube), [`loft`](#loft).

**More:** [solid primitives](/docs/solid-primitives#direct-3d-primitives).

### Solid creation

#### `extrude`

**Purpose.** Extends a closed sketch profile along its placement normal to create solid geometry.

**Syntax**

```bushscad
obj name = extrude(profile, depth);
obj name = extrude(profile, depth symmetric, @placement);
obj name = extrude(profile, depth: value, @placement);
```

**Arguments**

- `profile`: Named sketch or inline sketch expression. The profile must enclose a region.
- `depth`: Extrusion length in the active base unit; explicit length suffixes are accepted.
- `symmetric`: Splits the total depth equally across both sides of the starting plane.
- `@placement`: Optional face/point placement and offsets; defaults to the sketch starting plane.

**Syntax guide.** [Extrude syntax](/docs/solid-creation#extrude).

**Usage**

```bushscad
sketch rib = rect(30, 4);
obj brace = extrude(rib, 8 symmetric);
```

**Related:** [`cut`](#cut), [`wrap`](#wrap).

**More:** [solid creation](/docs/solid-creation#extrude).

#### `revolve`

**Purpose.** Rotates a closed profile around an axis to create a solid of revolution.

**Syntax**

```bushscad
obj name = revolve(profile, angle around axis);
obj name = revolve(profile, angle around axis, radius: offset);
```

**Arguments**

- `profile`: Closed named or inline sketch.
- `angle`: Sweep angle in degrees; 360deg makes a complete turn.
- `axis`: x, y, z, or a spatial reference that resolves to one axis.
- `radius`: Offsets the profile from the axis before revolving, useful for rings. Expressions may use variables but not this.

**Syntax guide.** [Revolve syntax](/docs/solid-creation#revolve).

**Usage**

```bushscad
sketch section = circle(6);
obj ring = revolve(section, 360deg around z, radius: 20);
```

**Related:** [`torus`](#torus), [`radial_extrude`](#radialextrude).

**More:** [solid creation](/docs/solid-creation#revolve).

#### `radial_extrude`

**Purpose.** Creates a solid by rotating and moving a profile along a radial axis.

**Syntax**

```bushscad
obj name = radial_extrude(profile, axis: z, angle: degrees, length: distance);
obj name = radial_extrude(profile, from: start, to: end, along: path);
```

**Arguments**

- `profile`: Closed named or inline sketch section.
- `axis / from`: Explicit x/y/z or reference axis; otherwise infer the axis from from: placement.
- `angle, length`: Angular travel in degrees and axial travel in length units; both are required in this extent mode.
- `from, to, along`: Alternative bridge mode joins two placements, optionally along a named 3D path.
- `curve`: Controls axial progress relative to rotation; defaults to natural.
- `start, direction, radius`: Initial angle (default 0), ccw/cw direction (default ccw), and profile radial offset (default 0).
- `twist, taper, sections`: Section twist and taper angles; optional section count, default auto.

**Syntax guide.** [Radial extrudes](/docs/solid-creation#radial-extrudes-and-cuts).

**Usage**

```bushscad
sketch section = rect(4, 3);
obj rib = radial_extrude(section, axis: z, angle: 90, length: 20, radius: 15, curve: ease-in-out);
```

**Related:** [`radial_cut`](#radialcut), [`revolve`](#revolve), [`sweep`](#sweep).

**More:** [solid creation](/docs/solid-creation#radial-extrudes-and-cuts).

#### `loft`

**Purpose.** Connects ordered sketch profiles to create a transition solid.

**Syntax**

```bushscad
obj name = loft(first, second, height: distance);
obj name = loft(first, second, ..., height: distance, guide: openSketch in XZ);
```

**Arguments**

- `profiles`: Ordered named or inline closed sections; at least two are needed to form the transition.
- `height`: Required separation along the loft direction.
- `guide`: Optional open sketch profile guiding the transition; in XY/XZ/YZ can set its guide workplane.

**Syntax guide.** [Loft syntax](/docs/solid-creation#loft).

**Usage**

```bushscad
sketch foot = rect(40, 30);
sketch neck = circle(16);
obj transition = loft(foot, neck, height: 35);
```

**Related:** [`sweep`](#sweep), [`extrude`](#extrude).

**More:** [solid creation](/docs/solid-creation#loft).

#### `sweep`

**Purpose.** Moves a closed profile along a 3D path to create a solid.

**Syntax**

```bushscad
obj name = sweep(profile along path);
obj name = sweep(profile along path, orientation: default|fixed|binormal);
```

**Arguments**

- `profile`: Closed sketch section.
- `path`: 3D path declared with polyline or spline, or an inline path input. The arc(from: ...) form is not implemented.
- `orientation`: Frame mode: default, fixed, or binormal. Use the named orientation: argument.

**Syntax guide.** [Sweep and path syntax](/docs/solid-creation#sweep-and-path-modeling).

**Usage**

```bushscad
sketch section = circle(4);
path rail = polyline([(0,0,0), (0,0,30)]);
obj rod = sweep(section along rail, orientation: default);
```

**Related:** [`path`](#path), [`cut`](#cut).

**More:** [solid creation](/docs/solid-creation#sweep-and-path-modeling).

#### `wrap`

**Purpose.** Creates a point-defined sketch boundary or places a sketch onto a cylindrical surface.

**Syntax**

```bushscad
wrap(points, intent?, rounded: radius, tension: value, tolerance: distance)
```

**Arguments**

- `points`: A list expression containing (x, y) tuples for the closed outline.
- `intent`: ordered (default), convex, concave, or smooth; supplied as a bare word.
- `rounded`: Adds tangent corner blends to ordered, convex, or concave outlines.
- `tension`: Controls automatic smooth-mode blend radius; higher values create broader blends.
- `tolerance`: Removes duplicate or near-duplicate neighboring points before building the outline.

**Syntax guide.** [Cylindrical sketch wrapping](/docs/sketch-profiles#wrap-to-surface-for-cylindrical-sketches).

**Usage**

```bushscad
sketch outline = wrap([(-20, -10), (20, -10), (20, 10), (0, 4), (-20, 10)], ordered, rounded: 2);
```

**Related:** [`path`](#path), [`extrude`](#extrude).

**More:** [sketch profiles](/docs/sketch-profiles#wrap-to-surface-for-cylindrical-sketches).

### Surface features

#### `fill`

**Purpose.** Creates an open surface from a closed sketch or boundary.

**Syntax**

```bushscad
surface name = fill(sketch);
surface name = fill(object.face);
surface name = fill(@object.face.perimeter);
```

**Arguments**

- `boundary`: A closed sketch, single face, outer perimeter, or classified closed edge loops.

**Syntax guide.** [Surface operations](/docs/solid-editing#surface-operations).

**Usage**

```bushscad
sketch profile = rect(30, 20);
surface cap = fill(profile);
obj lid = thicken(cap, 2);
```

**Related:** [`thicken`](#thicken).

**More:** [solid editing](/docs/solid-editing#surface-operations).

#### `offset_surface`

**Purpose.** Creates a copy of an open surface shifted by a signed distance along its normal.

**Syntax**

```bushscad
surface name = offset_surface(source, distance);
surface name = offset_surface(fill(boundary), distance);
```

**Arguments**

- `source`: Named surface or an inline fill/offset_surface operation.
- `distance`: Signed length; positive follows the source normal, negative goes the opposite way.

**Syntax guide.** [Surface operations](/docs/solid-editing#surface-operations).

**Usage**

```bushscad
sketch profile = rect(30, 20);
surface cap = fill(profile);
surface raised = offset_surface(cap, 2);
```

**Related:** [`fill`](#fill), [`thicken`](#thicken), [`offset`](#offset).

**More:** [solid editing](/docs/solid-editing#surface-operations).

#### `thicken`

**Purpose.** Turns an open surface into a solid by giving it thickness.

**Syntax**

```bushscad
obj name = thicken(surface, thickness);
obj name = thicken(fill(boundary), thickness);
```

**Arguments**

- `surface`: Named surface or inline fill/offset_surface operation.
- `thickness`: Signed extrusion length along the surface normal.

**Syntax guide.** [Surface operations](/docs/solid-editing#surface-operations).

**Usage**

```bushscad
sketch profile = rect(30, 20);
obj lid = thicken(fill(profile), 2);
```

**Related:** [`fill`](#fill), [`offset_surface`](#offsetsurface), [`shell`](#shell).

**More:** [solid editing](/docs/solid-editing#surface-operations).

### Solid editing

#### `cut`

**Purpose.** Subtracts a sketch profile or solid tool from an existing body.

**Syntax**

```bushscad
obj name = cut(profile, depth, @placement);
obj name = cut(profile, through target, @placement);
obj name = cut(profile, through, @placement);
obj name = cut(tool, @placement);
```

**Arguments**

- `profile / tool`: A closed sketch for depth/through cuts, or an existing solid/hidden ref/inline extrude, revolve, loft, sweep, or thicken for solid-tool cuts.
- `depth / through`: Blind depth in length units, or complete penetration of the named/inferred target.
- `@placement`: Determines cut position and direction. For solid tools it is required and identifies the target through its owning face.

**Syntax guide.** [Cut syntax](/docs/solid-editing#cut).

**Usage**

```bushscad
obj base = cube([40, 30, 8]);
sketch bore = circle(5);
obj hole = cut(bore, through, @base.top.center);
```

**Related:** [`extrude`](#extrude), [`radial_cut`](#radialcut).

**More:** [solid editing](/docs/solid-editing#cut).

#### `fuse`

**Purpose.** Combines two or more solid objects into one solid with shared topology.

**Syntax**

```bushscad
fuse(first, second, ...);
```

**Arguments**

- `first, second, ...`: Two or more named solid objects to combine.

**Syntax guide.** [Fuse syntax](/docs/solid-editing#explicit-fuse).

**Usage**

```bushscad
obj base = cube([30, 20, 6]);
obj boss = cylinder(8, d: 10);
fuse(base, boss);
```

**Related:** [`cut`](#cut).

**More:** [solid editing](/docs/solid-editing#explicit-fuse).

#### `radial_cut`

**Purpose.** Subtracts a profile swept around a radial axis or along a guide path.

**Syntax**

```bushscad
obj name = radial_cut(profile, from: target.face.center, angle: degrees, length: distance);
obj name = radial_cut(profile, from: start, to: end, along: path);
```

**Arguments**

- `profile`: Closed named or inline sketch section.
- `axis / from`: Explicit x/y/z or reference axis; otherwise infer the axis from from: placement.
- `angle, length`: Angular travel in degrees and axial travel in length units; both are required in this extent mode.
- `from, to, along`: Alternative bridge mode joins two placements, optionally along a named 3D path.
- `curve`: Controls axial progress relative to rotation; defaults to natural.
- `start, direction, radius`: Initial angle (default 0), ccw/cw direction (default ccw), and profile radial offset (default 0).
- `twist, taper, sections`: Section twist and taper angles; optional section count, default auto.

**Syntax guide.** [Radial cuts](/docs/solid-creation#radial-extrudes-and-cuts).

**Usage**

```bushscad
obj base = cube([40, 40, 20]);
sketch slot = rect(3, 2);
obj groove = radial_cut(slot, axis: z, from: base.top.center, angle: 90, length: 5, radius: 10);
```

**Related:** [`radial_extrude`](#radialextrude), [`cut`](#cut).

**More:** [solid creation](/docs/solid-creation#radial-extrudes-and-cuts).

#### `fillet`

**Purpose.** Rounds selected 3D edges by a specified radius.

**Syntax**

```bushscad
fillet(@target, radius);
sketch name = fillet(profile, radius);
```

**Arguments**

- `@target`: An object, face, edge, perimeter, or repeatable selector; bare @body infers @body.edges.
- `radius`: Rounding radius in length units; it must fit the adjacent geometry.

**Syntax guide.** [Edge details](/docs/solid-editing#edge-and-face-details).

**Usage**

```bushscad
obj base = cube([40, 30, 8]);
fillet(@base.top.edges, 1);
```

**Related:** [`chamfer`](#chamfer), [`roundrect`](#roundrect).

**More:** [solid editing](/docs/solid-editing#fillet).

#### `chamfer`

**Purpose.** Bevels selected edges by a specified distance.

**Syntax**

```bushscad
chamfer(@target, offset);
```

**Arguments**

- `@target`: Object, face, edge, perimeter, or selector collection; bare @body infers @body.edges.
- `offset`: Chamfer distance along adjacent faces, in length units.

**Syntax guide.** [Edge details](/docs/solid-editing#edge-and-face-details).

**Usage**

```bushscad
part sample {
obj plate = cube([40, 30, 8]);
chamfer(@plate.bottom.edges, 1);
}
```

**Related:** [`fillet`](#fillet), [`draft`](#draft).

**More:** [solid editing](/docs/solid-editing#chamfer).

#### `shell`

**Purpose.** Hollows a solid while preserving a specified wall thickness.

**Syntax**

```bushscad
shell(object, thickness);
shell(object, thickness, faces);
shell(target: object, thickness: value, open: faces);
```

**Arguments**

- `object`: Existing solid object name.
- `thickness`: Wall thickness in length units. Positive thickness offsets inward from the original outside faces.
- `open`: Optional face name or list to remove, such as top or [top, front].

**Syntax guide.** [Shell syntax](/docs/solid-editing#edge-and-face-details).

**Usage**

```bushscad
part sample {
obj box = cube([60, 40, 20]);
shell(box, 2, top);
}
```

**Related:** [`thicken`](#thicken), [`cut`](#cut).

**More:** [solid editing](/docs/solid-editing#shell).

#### `draft`

**Purpose.** Tilts selected solid faces by a draft angle around a neutral plane.

**Syntax**

```bushscad
draft(@object.face, angle);
draft(target: @object.face, angle: value);
```

**Arguments**

- `@object.face`: Face-only selector, such as @base.front or @base.sides; points and edges are not valid targets.
- `angle`: Draft angle in degrees; use deg to make the unit explicit.

**Syntax guide.** [Draft syntax](/docs/solid-editing#edge-and-face-details).

**Usage**

```bushscad
part sample {
obj base = cube([40, 30, 20]);
draft(@base.sides, 2deg);
}
```

**Related:** [`chamfer`](#chamfer), [`fillet`](#fillet).

**More:** [solid editing](/docs/solid-editing#draft-angle).

#### `thread`

**Purpose.** Adds an internal or external screw thread to an object.

**Syntax**

```bushscad
thread(target, type, d, pitch, length: extent, direction: regular);
```

**Arguments**

- `target`: Existing object name; named arguments accept target: or object:.
- `type`: Required external or internal thread type.
- `d, pitch`: Required diameter and axial spacing between turns. The current evaluator emits these numeric values directly as millimeters; use base_unit = mm.
- `length`: Optional axial extent. A cut target can supply its recorded cut depth when omitted.
- `direction`: regular, clockwise, or counter_clockwise; handedness: and hand: are aliases.
- `angle`: Optional angle in degrees, also accepted as degrees:.

**Syntax guide.** [Thread syntax](/docs/solid-editing#edge-and-face-details).

**Usage**

```bushscad
base_unit = mm;
part fastener {
  sketch profile = circle(3);
  obj shaft = extrude(profile, 12);
  thread(shaft, external, 6, 1, length: 10);
}
```

**Related:** [`cut`](#cut), [`extrude`](#extrude).

**More:** [solid editing](/docs/solid-editing#thread).

#### `hole`

**Purpose.** Cuts a hardware-sized hole from a metric preset.

**Syntax**

```bushscad
obj name = hole(M3.clearance, through target, @placement);
obj name = hole(M3.counterbore, depth: distance, @placement);
```

**Arguments**

- `size.kind`: Metric size M2, M2.5, M3, M4, M5, M6, or M8 with clearance, tap, pilot, counterbore, countersink, or heatset_insert.
- `depth / through`: Blind depth in length units or penetration through the named/inferred target.
- `@placement`: Face placement identifying the target body; may be supplied by an active placement context.

**Syntax guide.** [Hole syntax](/docs/solid-editing#hole-system-and-hardware-library).

**Usage**

```bushscad
obj plate = cube([40, 30, 8]);
obj mount = hole(M3.clearance, through, @plate.top.center);
```

**Related:** [`heatset_insert`](#heatsetinsert), [`thread`](#thread), [`pattern`](#pattern).

**More:** [solid editing](/docs/solid-editing#hole-system-and-hardware-library).

#### `heatset_insert`

**Purpose.** Creates a pocket sized for a metric heat-set insert.

**Syntax**

```bushscad
obj name = heatset_insert(M3, depth: distance, @placement);
obj name = heatset_insert(M3, @placement);
```

**Arguments**

- `size`: Metric preset size such as M3 or M2.5.
- `depth`: Optional pocket depth in length units; omitted depth uses the preset default.
- `@placement`: Target face placement; otherwise an active placement context is required.

**Syntax guide.** [Heat-set insert pockets](/docs/solid-editing#hole-system-and-hardware-library).

**Usage**

```bushscad
obj boss = cylinder(12, d: 12);
obj insert_pocket = heatset_insert(M3, depth: 5, @boss.top.center);
```

**Related:** [`hole`](#hole), [`cut`](#cut).

**More:** [solid editing](/docs/solid-editing#heat-set-insert-pockets).

### Placement and transforms

#### `place`

**Purpose.** Places a component, function result, or reference at a target anchor.

**Syntax**

```bushscad
place(component);
place(component, @target);
place(component, @target, @source_anchor) rotate(angle);
```

**Arguments**

- `component`: Reusable component/ref, function call, or supported source geometry.
- `target`: Destination face, point, or named plane. Omit it to place at world origin.
- `source_anchor`: Optional named anchor on the placed component.

**Syntax guide.** [Component placement](/docs/parts-and-assemblies#basic-placement).

**Usage**

```bushscad
ref peg { obj shaft = cylinder(12, d: 4); }
obj base = cube([30, 20, 4]);
place(peg, @base.top.center);
```

**Related:** [`fn`](#fn), [`rotate`](#rotate).

**More:** [parts and assemblies](/docs/parts-and-assemblies#basic-placement).

#### `rotate`

**Purpose.** `rotate` is a placement modifier, a standalone object operation, and a nested operation used by `transform`.

##### Placement-time rotation

**Syntax guide.** [Placement-time rotate](/docs/references-and-placement#placement-time-rotate).

**Syntax**

```bushscad
place(component, @target) rotate(angle);
place(component) rotate(x: angle, y: angle, z: angle);
```

**Example**

```bushscad
place(bracket, @base.top.center) rotate(90deg);
```

##### Standalone rotation

**Syntax guide.** [Standalone rotate](/docs/references-and-placement#standalone-post-placement-rotate).

**Syntax**

```bushscad
rotate target angle around axis;
```

**Arguments**

- `angle`: Degrees; the single-angle placement form uses the placement plane normal.
- `axis`: x, y, z, or a face-derived axis/anchor for standalone rotation.

**Example**

```bushscad
obj block = cube([20, 10, 4]);
rotate block 30deg around z;
```

##### Rotation inside a transform

**Syntax guide.** [Transform operations](/docs/references-and-placement#transform).

**Syntax**

```bushscad
transform(target, rotate(angle: degrees, around: axis));
```

**Example**

```bushscad
transform(block, rotate(angle: 45deg, around: z));
```

**Related:** [`place`](#place), [`transform`](#transform).

**More:** [references and placement](/docs/references-and-placement#rotate).

#### `pattern`

**Purpose.** Creates repeated copies in a linear grid or circular arrangement.

##### Geometry patterns

**Syntax guide.** [Patterns and transforms](/docs/references-and-placement#patterns-and-transforms).

**Syntax**

```bushscad
pattern(target, linear, countX, spacing, countY);
pattern(target, linear, x: countX, y: countY, spacing: (dx, dy));
pattern(target, radial, count, around: object.face.center);
```

**Arguments**

- `target`: Existing object name; target: and object: named forms are accepted.
- `linear / radial`: Pattern mode; defaults to linear when omitted.
- `count / countX / countY`: Rounded integer instance counts, including the original; countY defaults to 1.
- `spacing`: Linear displacement between instances; use a scalar for X or (dx, dy) for a grid.
- `around`: Required axis reference for radial mode; instances span a full 360-degree turn.

**Example**

```bushscad
obj peg = cylinder(8, d: 4);
pattern(peg, linear, x: 3, y: 2, spacing: (12, 12));
```

##### Hardware-hole patterns

**Syntax guide.** [Pattern with holes](/docs/solid-editing#pattern-with-holes).

**Syntax**

```bushscad
pattern(holeObject, linear, count, spacing);
```

**Example**

```bushscad
use std.hardware.metric;
obj mount = hole(M3.clearance, through base, @base.top(x: 10, y: 10));
pattern(mount, linear, 4, 20);
```

**Related:** [`radial`](#radial), [`mirror`](#mirror).

**More:** [references and placement](/docs/references-and-placement#patterns-and-transforms).

#### `mirror`

**Purpose.** Creates a reflected copy across a plane.

**Syntax**

```bushscad
mirror(target, X);
mirror(target: object, across: object.face);
mirror(target, plane(center));
```

**Arguments**

- `target`: Existing object to copy.
- `across`: X/Y/Z world-normal plane, face reference, or plane(center). World X reflects across the YZ plane through the origin.

**Syntax guide.** [Patterns and transforms](/docs/references-and-placement#patterns-and-transforms).

**Usage**

```bushscad
obj block = cube([10, 8, 4]);
transform(block, translate(15));
mirror(block, X);
```

**Related:** [`transform`](#transform), [`pattern`](#pattern).

**More:** [references and placement](/docs/references-and-placement#patterns-and-transforms).

#### `transform`

**Purpose.** Applies translation, rotation, or uniform scale to an object.

**Syntax**

```bushscad
transform(target, translate(x, y, z));
transform(target, rotate(angle: degrees, around: z));
transform(target, scale(factor));
```

**Arguments**

- `target`: Existing object name; target: is also accepted.
- `operation`: translate, rotate, or scale; operation: is the named argument form.
- `translate`: X/Y/Z offsets in length units; omitted components are zero.
- `rotate`: Angle in degrees and required world/reference axis.
- `scale`: Dimensionless uniform scale factor applied to the geometry.

**Syntax guide.** [Patterns and transforms](/docs/references-and-placement#patterns-and-transforms).

**Usage**

```bushscad
obj block = cube([20, 10, 4]);
transform(block, translate(x: 10, y: 5));
transform(block, rotate(angle: 45deg, around: z));
```

**Related:** [`rotate`](#rotate), [`mirror`](#mirror), [`pattern`](#pattern).

**More:** [references and placement](/docs/references-and-placement#patterns-and-transforms).

#### `plane`

**Purpose.** `plane` declares a reusable construction plane and also builds inline plane references for placements or mirror operations.

##### Named construction plane

**Syntax guide.** [Named plane declaration](/docs/references-and-placement#named-plane-declaration).

**Syntax**

```bushscad
plane name = offset(distance, @reference);
```

**Example**

```bushscad
part tiers {
  obj base = cube([40, 30, 5]);
  plane above = offset(10, @base.top);
  obj lid = extrude(rect(40, 30), 3, @above);
}
```

##### Inline plane reference

**Syntax guide.** [Inline anonymous planes](/docs/references-and-placement#inline-anonymous-planes).

**Syntax**

```bushscad
@plane(reference, offset: distance)
```

**Arguments**

- `distance`: Signed length measured from the reference plane.
- `reference`: A face or an existing named plane.

**Example**

```bushscad
obj base = cube([40, 30, 5]);
obj lid = extrude(rect(40, 30), 3, @plane(base.top, offset: 10));
```

##### Plane in a mirror operation

**Syntax guide.** [Mirror planes](/docs/references-and-placement#mirror).

**Syntax**

```bushscad
mirror(target, plane(center));
```

**Example**

```bushscad
obj block = cube([20, 10, 4]);
mirror(block, plane(center));
```

**Related:** [`offset`](#offset), [`pos`](#pos).

**More:** [references and placement](/docs/references-and-placement#planes).

#### `pos`

**Purpose.** Specifies a local placement offset in a face or anchor coordinate frame.

**Syntax**

```bushscad
@target(x, y)
@target.ref(x, y)
@target(x: dx, y: dy)
@target.center(radius: r, angle: a)
@target.edge(offset: d)
```

**Arguments**

- `x, y`: Signed local length offsets. A rectangular top/bottom face starts at back_left; x points right and y points front.
- `radius, angle`: Polar offset from the chosen origin; angle is in degrees.

**Syntax guide.** [Positional placement](/docs/references-and-placement#positional-placement).

**Usage**

```bushscad
obj base = cube([40, 30, 6]);
obj hole = cut(circle(4), through, @base.top.center(radius: 10, angle: 45deg));
```

**Related:** [`plane`](#plane).

**More:** [references and placement](/docs/references-and-placement#positional-placement).

### Loops and iteration

#### `range`

**Purpose.** `range` has two distinct uses: the `range(...)` function generates loop values, while the `range = ...` joint property limits motion.

##### Sequence in a loop

**Purpose.** Supplies ascending values to a `for` loop. Each call form chooses a different start or increment; every form stops before `end`.

**Syntax guide.** [Range loops](/docs/language-basics#basic-range-loop).

**Syntax**

```bushscad
range(end)
range(start, end)
range(start, end, step)
```

**Call forms**

- `range(end)`: Starts at 0 and increments by 1. For example, `range(4)` yields 0, 1, 2, 3.
- `range(start, end)`: Starts at `start`, increments by 1, and stops before `end`. For example, `range(2, 5)` yields 2, 3, 4.
- `range(start, end, step)`: Starts at `start`, increments by the positive `step`, and stops before `end`. For example, `range(2, 8, 2)` yields 2, 4, 6.

**Arguments**

- `start`: First value; defaults to 0.
- `end`: Exclusive upper bound.
- `step`: Positive finite increment; defaults to 1. Use ascending bounds.

**Examples**

Count only (`range(end)`):

```bushscad
part sample {
  for i in range(4) {
    var diameter = 2 + i;
  }
}
```

Start and end (`range(start, end)`):

```bushscad
part sample {
  for i in range(2, 5) {
    var diameter = i;
  }
}
```

Start, end, and step (`range(start, end, step)`):

```bushscad
part sample {
  for i in range(2, 8, 2) {
    var diameter = i;
  }
}
```

##### Joint motion limit

**Purpose.** Sets inclusive lower and upper motion bounds for a joint preview. This `range = ...` property is distinct from the `range(...)` loop function above.

**Syntax guide.** [Joint syntax](/docs/parts-and-assemblies#joint-syntax).

**Syntax**

```bushscad
joint_type name(moving, fixed) {
  range = minimum..maximum;
}
```

**Bounds**

- `minimum`: Inclusive lower motion value.
- `maximum`: Inclusive upper motion value.
- Use lengths for slider and planar joints; use angles for revolute and ball joints.

**Examples**

Slider motion uses length values:

```bushscad
slider drawer_slide(@drawer.front, @case.front) {
  range = 0mm..80mm;
}
```

Revolute motion uses angle values:

```bushscad
revolute lid_hinge(@lid.right, @case.right) {
  range = -90deg..90deg;
}
```

#### `grid`

**Purpose.** Generates column and row positions for a rectangular arrangement.

**Syntax**

```bushscad
grid(cols, rows, spacing?)
grid(cols: n, rows: m, spacingX: dx, spacingY: dy)
```

**Arguments**

- `cols, rows`: Column and row counts, rounded by the evaluator.
- `spacing`: Shared length spacing; axis-specific spacing overrides it.

**Syntax guide.** [Grid loops](/docs/language-basics#grid-loop).

**Usage**

```bushscad
part sample {
  for (col, row) in grid(4, 3, 10) where col != 2 {
    var x = col;
    var y = row;
  }
}
```

**Related:** [`radial`](#radial).

**More:** [language basics](/docs/language-basics#grid-loop).

#### `radial`

**Purpose.** Generates evenly spaced angles around a full circle or partial sweep.

**Syntax**

```bushscad
radial(count, start?, sweep?)
radial(count: n, start: angle, sweep: angle)
```

**Arguments**

- `count`: Number of angle samples.
- `start`: First angle in degrees; defaults to 0.
- `sweep`: Total span in degrees; defaults to 360.

**Syntax guide.** [Radial loops](/docs/language-basics#radial-loop).

**Usage**

```bushscad
part sample {
  for a in radial(4, start: 0deg, sweep: 180deg) {
    var angle_value = a;
  }
}
```

**Related:** [`pos`](#pos), [`pattern`](#pattern).

**More:** [language basics](/docs/language-basics#radial-loop).

#### `enumerate`

**Purpose.** Iterates through a list with each value and its zero-based index.

**Syntax**

```bushscad
for (index, value) in enumerate(items) { statements }
```

**Arguments**

- `items`: List expression to iterate in source order.

**Syntax guide.** [Enumerate loops](/docs/language-basics#enumerate).

**Usage**

```bushscad
part sample {
  var sizes = [2, 4, 6];
  for (i, d) in enumerate(sizes) {
    sketch hole = circle(d);
  }
}
```

**Related:** [`range`](#range).

**More:** [language basics](/docs/language-basics#enumerate).

### Validation and measurement

#### `assert`

**Purpose.** Checks a design condition and reports an error or warning when it fails.

**Syntax**

```bushscad
assert(condition);
assert(condition, warning: 'message');
assert(condition, severity: error, message: 'message');
```

**Arguments**

- `condition`: Boolean/comparison expression; supported geometry queries are evaluated after the build.
- `severity`: Defaults to error; warning reports a problem while allowing the build to succeed.
- `message`: Optional explanation shown with the source span.

**Syntax guide.** [Design assertions](/docs/validation-and-fits#design-validation-assert).

**Usage**

```bushscad
var wall = 2;
assert(wall >= 1.6, warning: 'Wall is below the design target');
```

**Related:** [`volume`](#volume), [`wall_thickness`](#wallthickness).

**More:** [validation and fits](/docs/validation-and-fits#design-validation-assert).

#### `distance`

**Purpose.** `distance` measures separation between built shapes or constrains the distance between sketch points.

##### Geometry measurement

**Syntax guide.** [Geometry query functions](/docs/validation-and-fits#geometry-query-functions).

**Syntax**

```bushscad
distance(first, second)
```

**Example**

```bushscad
obj body = cube([20, 10, 8]);
obj lid = cube([20, 10, 4], @plane(body.top, offset: 1));
assert(distance(body, lid) >= 0.8);
```

##### Sketch-point dimension

**Syntax guide.** [Dimensional sketch constraints](/docs/sketch-profiles#dimensional-constraints).

**Syntax**

```bushscad
constraint(point, distance, reference, value)
constraint(point, distance, other_point, value, axis: x|y)
dimension point.distance to reference at (x, y)
```

**Arguments**

- `reference`: A second point/endpoint, fixed origin, origin.x_axis, or origin.y_axis.
- `axis`: For two-point distances, x measures abs(dx), y measures abs(dy), and omission measures Euclidean distance.

**Example**

```bushscad
sketch profile = path(
  bottom = line((0, 0), (20, 0)),
  right = line((20, 0), (20, 12)),
  constraint(bottom.start, distance, right.end, 5, axis: x, at: (22, 8)),
  close()
);
```

**Related:** [`constraint`](#constraint), [`dimension`](#dimension), [`assert`](#assert), [`fit_ok`](#fitok).

**More:** [validation and fits](/docs/validation-and-fits#geometry-query-functions).

#### `clearance`

**Purpose.** Measures the minimum separation between two built shapes for validation.

**Syntax**

```bushscad
clearance(first, second)
```

**Arguments**

- `first, second`: Names of the two built shapes whose minimum separation is measured.

**Syntax guide.** [Geometry query functions](/docs/validation-and-fits#geometry-query-functions).

**Usage**

```bushscad
obj body = cube([20, 10, 8]);
obj lid = cube([20, 10, 4], @plane(body.top, offset: 1));
assert(clearance(body, lid) >= 0.8);
```

**Related:** [`assert`](#assert), [`fit_ok`](#fitok).

**More:** [validation and fits](/docs/validation-and-fits#geometry-query-functions).

#### `bounding_box`

**Purpose.** Returns the volume of a built shape's axis-aligned bounding box.

**Syntax**

```bushscad
bounding_box(body)
```

**Arguments**

- `body`: Built shape whose axis-aligned bounding-box volume is returned.

**Syntax guide.** [Geometry query functions](/docs/validation-and-fits#geometry-query-functions).

**Usage**

```bushscad
obj body = cube([20, 10, 8]);
assert(bounding_box(body) >= 1000);
```

**Related:** [`assert`](#assert), [`fit_ok`](#fitok).

**More:** [validation and fits](/docs/validation-and-fits#geometry-query-functions).

#### `volume`

**Purpose.** Returns the volume of a built solid.

**Syntax**

```bushscad
volume(body)
```

**Arguments**

- `body`: Built solid whose volume is returned.

**Syntax guide.** [Geometry query functions](/docs/validation-and-fits#geometry-query-functions).

**Usage**

```bushscad
obj body = cube([20, 10, 8]);
assert(volume(body) >= 1000);
```

**Related:** [`assert`](#assert), [`fit_ok`](#fitok).

**More:** [validation and fits](/docs/validation-and-fits#geometry-query-functions).

#### `face_area`

**Purpose.** Returns the total surface area of a built shape.

**Syntax**

```bushscad
face_area(body)
```

**Arguments**

- `body`: Built shape whose total surface area is measured.

**Syntax guide.** [Geometry query functions](/docs/validation-and-fits#geometry-query-functions).

**Usage**

```bushscad
obj body = cube([20, 10, 8]);
assert(face_area(body) >= 100);
```

**Related:** [`assert`](#assert), [`fit_ok`](#fitok).

**More:** [validation and fits](/docs/validation-and-fits#geometry-query-functions).

#### `wall_thickness`

**Purpose.** Estimates a built solid's minimum wall thickness.

**Syntax**

```bushscad
wall_thickness(body)
```

**Arguments**

- `body`: Built solid whose minimum wall thickness is estimated.

**Syntax guide.** [Geometry query functions](/docs/validation-and-fits#geometry-query-functions).

**Usage**

```bushscad
obj body = cube([20, 10, 8]);
assert(wall_thickness(body) >= 1.6);
```

**Related:** [`assert`](#assert), [`fit_ok`](#fitok).

**More:** [validation and fits](/docs/validation-and-fits#geometry-query-functions).

#### `fit_ok`

**Purpose.** Checks whether built geometry satisfies a declared fit relation.

**Syntax**

```bushscad
fit_ok(fit_name, target_name)
```

**Arguments**

- `fit_name, target_name`: Identifiers matching a previously declared fit.

**Syntax guide.** [Fit assertions](/docs/validation-and-fits#fitok-in-assertions).

**Usage**

```bushscad
fit(clearance, bolt, through, bore);
assert(fit_ok(bolt, bore), warning: 'Check clearance');
```

**Related:** [`distance`](#distance), [`clearance`](#clearance), [`assert`](#assert).

**More:** [validation and fits](/docs/validation-and-fits#fitok-in-assertions).

### User-defined functions

#### `fn`

**Purpose.** Defines a reusable parameterized function that returns geometry.

**Syntax**

```bushscad
fn name(parameter, optional: default) { statements }
```

**Arguments**

- `parameters`: Required positional names followed by supported named/default arguments.

**Syntax guide.** [Function declarations](/docs/language-basics#global-function).

**Usage**

```bushscad
fn plate(w, h: 20) {
  sketch profile = rect(w, h);
  return { obj body = extrude(profile, 3), }
}
place(plate(40));
```

**Related:** [`place`](#place).

**More:** [language basics](/docs/language-basics#global-function).

### Joint types and motion

#### `fixed`

**Purpose.** Connects two parts without relative movement.

**Syntax guide.** [Joint types](/docs/parts-and-assemblies#joint-types).

**Syntax**

```bushscad
fixed name(movingReference, supportingReference) { }
```

**Usage**

```bushscad
fixed frame_joint(@arm.mount, @frame.mount) { }
```

#### `revolute`

**Purpose.** Allows one part to rotate around a shared axis.

**Syntax guide.** [Joint syntax](/docs/parts-and-assemblies#joint-syntax).

**Syntax**

```bushscad
revolute name(movingAxis, supportingAxis) { range = minimum..maximum; }
```

**Usage**

```bushscad
revolute hinge(@lid.hinge_axis, @housing.hinge_axis) {
  range = 0deg..120deg;
  default = 15deg;
}
```

#### `slider`

**Purpose.** Allows one part to translate along a shared axis.

**Syntax guide.** [Joint syntax](/docs/parts-and-assemblies#joint-syntax).

**Syntax**

```bushscad
slider name(movingAxis, supportingAxis) { range = minimum..maximum; }
```

**Usage**

```bushscad
slider drawer(@drawer.rail, @case.rail) {
  range = 0mm..80mm;
}
```

#### `planar`

**Purpose.** Allows translation within a shared plane.

**Syntax guide.** [Joint types](/docs/parts-and-assemblies#joint-types).

**Syntax**

```bushscad
planar name(movingReference, supportingReference) { range = minimum..maximum; }
```

**Usage**

```bushscad
planar carriage(@carriage.base, @frame.guide) {
  range = 0mm..40mm;
}
```

#### `ball`

**Purpose.** Allows three-axis rotation without translation.

**Syntax guide.** [Joint types](/docs/parts-and-assemblies#joint-types).

**Syntax**

```bushscad
ball name(movingPoint, supportingPoint) { range = minimum..maximum; }
```

**Usage**

```bushscad
ball ball_joint(@head.center, @body.neck) {
  range = 0deg..60deg;
}
```

#### `default`

**Purpose.** Sets the initial motion value shown for a joint in the viewport.

**Syntax guide.** [Joint syntax](/docs/parts-and-assemblies#joint-syntax).

**Syntax**

```bushscad
joint_type name(movingReference, supportingReference) { default = value; }
```

**Usage**

```bushscad
slider drawer(@drawer.rail, @case.rail) {
  range = 0mm..80mm;
  default = 20mm;
}
```

## Language Basics

### Core Concepts

Build a model by defining profiles, creating solids, placing features, and
refining geometry. A `.bscd` file stores these steps as editable source.
References name faces, edges, and anchors so later features can follow the
model's geometry. Use `part` to keep solids separate and assign materials.

### Units & Global Settings

Set the global base unit at the top of any file. All bare numbers are interpreted in this unit.

```
base_unit = mm;   // millimetres (default)
base_unit = cm;
base_unit = in;   // inches
base_unit = m;
```

Set the starting workplane the same way. The workplane controls the plane used by sketches that do not specify an explicit `from` or `on` placement. If omitted, the default is `XY`.

```
workplane = XY;   // default: sketch on XY, positive extrude along +Z
workplane = XZ;   // sketch on XZ, positive extrude along -Y
workplane = YZ;   // sketch on YZ, positive extrude along +X
```

The workplane affects the initial build surface only. Once a sketch is placed with `from`, `on`, `place`, `@`, or a named `plane`, that explicit placement controls the sketch axis. Surface names such as `top`, `bottom`, `front`, `back`, `left`, and `right` remain local to each resulting solid, so `base.top` means the face produced by the positive extrude direction from the chosen workplane.

#### Inline Unit Overrides

Any value can carry an explicit unit suffix regardless of `base_unit`:

```
base_unit = mm;
sketch hole = circle(2in);       // 2 inches, converted internally
sketch slot = rect(0.5in, 10);   // mixed: 0.5in wide, 10mm tall
```

#### Supported Unit Suffixes

| Suffix | Unit                  |
| ------ | --------------------- |
| `mm`   | Millimetres (default) |
| `cm`   | Centimetres           |
| `m`    | Metres                |
| `in`   | Inches                |
| `ft`   | Feet                  |

### Variables

Variables are declared with the `var` keyword. They can hold numbers, strings, booleans, lists, or point tuples, and follow the same lexical scoping rules as components.

```
var wall_thickness = 2;
var plate_width    = 60;
var plate_height   = 40;
var label          = 'bracket';
var include_holes  = true;

// Expressions are supported
var corner_radius = wall_thickness * 1.5;
var inner_width   = plate_width - (wall_thickness * 2);
```

#### List Variables

```
var mount_points = [(10, 10), (50, 10), (10, 30), (50, 30)];
var bolt_sizes   = [2, 3, 4, 3, 2];
```

#### Word Variables

String values may be declared with single or double quotes. `word(...)` uses a string to create a text sketch; regular string variables and text variables share the same type.

```
var part_label   = 'FRONT';
var serial_num   = 'SN-0042';
var company_name = 'ACME';
```

#### Template Strings

Backtick-delimited strings use the same template-literal syntax as TypeScript.
Each `${expression}` substitution accepts a complete BushSCAD expression and
is converted to text with TypeScript-style string coercion. Templates may span
lines and may contain nested template strings.

```bushscad
var width = 24;
var enabled = true;
var label = `width=${width}; enabled=${enabled}`;
var doubled = `2 Ã— width = ${width * 2}`;
var nested = `result: ${`value ${width}`}`;
```

Template text supports TypeScript escape forms, including `\n`, `\r`, `\t`,
`\b`, `\f`, `\v`, `\0`, `\xHH`, `\uHHHH`, and `\u{H...}`. Use `` \` `` for
a literal backtick and `\${` for a literal `${` sequence. A backslash followed
by a line break continues the template without adding that line break.

Substitutions are evaluated from left to right. Numbers and booleans become
their usual text forms, and lists use comma-separated JavaScript/TypeScript
array coercion (for example, `` `${[1, 2, 3]}` `` produces `'1,2,3'`).

#### Scoped Variables

Variables declared inside a component are local to that component and shadow any outer variable of the same name.

```
var wall_thickness = 2;  // global

part enclosure {
    var wall_thickness = 3;          // local - shadows global inside enclosure
    sketch body = rect(80, 60);
    obj body = extrude(body, 40);
    shell(body, wall_thickness);      // uses 3
}

part thin_plate {
    sketch base = rect(60, 40);
    obj base = extrude(base, wall_thickness);  // uses global 2
}
```

### Expressions & Comparisons

Expressions produce numbers, strings, booleans, lists, or point tuples. Equality is strict: BushSCAD does not convert one value type into another before applying `==` or `!=`.

#### Equality

Numbers, strings, and booleans compare by value and type. Unit expressions are converted to the active base unit before comparison, so measurements with the same physical length compare equal. Lists and point tuples compare by identity, not by their contents.

| Expression         | Result  | Reason                                        |
| ------------------ | ------- | --------------------------------------------- |
| `1 == 1`           | `true`  | Same numeric value                            |
| `10mm == 1cm`      | `true`  | Both values represent the same length         |
| `'part' == 'part'` | `true`  | Same string value                             |
| `true == true`     | `true`  | Same boolean value                            |
| `0 == false`       | `false` | Number and boolean are different types        |
| `'1' == 1`         | `false` | String and number are different types         |
| `'' == false`      | `false` | No empty-value coercion occurs                |
| `[] == ''`         | `false` | List and string are different types           |
| `[] != ''`         | `true`  | The operands are not strictly equal           |
| `[] == []`         | `false` | Each literal creates a different list         |
| `[1] == [1]`       | `false` | Lists are not compared element by element     |
| `1 % 0 == 1 % 0`   | `false` | A non-finite `NaN` value is unequal to itself |

A list or tuple stored in a variable is equal to that same stored value:

```
var values = [];
var same_values = values;

var same_reference = values == values;       // true
var aliased_reference = values == same_values; // true
var another_empty = values == [];            // false
```

Consequently, `values == []` is **not** an emptiness test. BushSCAD has no list-length or structural-list-equality operator. When emptiness affects model logic, carry an explicit count or boolean alongside the list.

#### Truthiness

`if`, unary `!`, `&&`, `||`, and the condition of `condition ? then : else` convert their condition to a boolean. The following values are falsey; every other language value is truthy.

| Value                               | Boolean result |
| ----------------------------------- | -------------- |
| `false`                             | `false`        |
| `0`                                 | `false`        |
| `''`                                | `false`        |
| A `NaN` result, such as `1 % 0`     | `false`        |
| Any non-zero number                 | `true`         |
| Any non-empty string                | `true`         |
| `[]`                                | `true`         |
| Any non-empty list                  | `true`         |
| Any point tuple, including `(0, 0)` | `true`         |

This means `if [] { ... }` takes the branch, and `![]` is `false`. List truthiness does not indicate whether the list contains items.

`&&` and `||` always return a boolean and evaluate both operands. They do not return one of their operands and do not short-circuit. A ternary expression evaluates only its selected branch.

#### Operators and Precedence

From highest to lowest precedence:

| Precedence | Operators                 | Notes                               |
| ---------- | ------------------------- | ----------------------------------- |
| 1          | `-value`, `!value`        | Unary negation and boolean not      |
| 2          | `*`, `/`, `%`             | Multiplication, division, remainder |
| 3          | `+`, `-`                  | Addition and subtraction            |
| 4          | `<`, `>`, `<=`, `>=`      | Ordering comparisons                |
| 5          | `==`, `!=`                | Strict equality and inequality      |
| 6          | `&&`                      | Boolean and                         |
| 7          | &#124;&#124;              | Boolean or                          |
| 8          | `condition ? then : else` | Conditional expression              |

Binary operators at the same level evaluate from left to right. Parentheses override precedence.

Arithmetic and ordering operators are intended for numeric operands. Equality is the exception and supports every value type under the strict rules above. Division by numeric zero evaluates to `0` during normal expression evaluation; validation assertions defer a division-by-zero expression instead of treating that fallback as an assertion result. Remainder by zero produces a non-finite numeric value. Non-finite results remain available to comparisons, but any input that requires a number-such as geometry dimensions, loop bounds, or spacing-rejects them during evaluation.

### Environment Variables

Environment variables bind external build-time values into the BushSCAD variable namespace. Once declared, an `env` variable is treated identically to a `var` - it can be used in expressions, conditionals, loops, and anywhere a normal variable is valid. The fallback value is used when the environment variable is not set. The type of the variable is inferred from the fallback value.

#### Declaration Syntax

```
// env <name> fallback <value>
env build_mode    fallback 'debug';
env wall_override fallback 2;
env show_labels   fallback true;
env hole_count    fallback 4;
```

#### Using env Variables

After declaration, env variables are plain variables. Use them exactly like `var`:

```
env build_mode  fallback 'debug';
env hole_count  fallback 4;

part plate {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);

    for i in range(hole_count) {
        sketch hole = circle(3);
        obj hole = cut(hole, through base, @base.top(x: 10 + (i * 12), y: 20));
    }
}
```

#### env Variables in if Statements

Use an environment value to include optional geometry:

```bushscad
env show_label fallback false;
sketch plate = rect(60, 40);
obj body = extrude(plate, 8);

if show_label {
    sketch label = word('REV', size: 5);
    obj mark = cut(label, 0.5, @body.top.center);
}
```

#### env Variables in For Loops

Use an environment value as a loop bound or spacing parameter:

```bushscad
env hole_count fallback 4;
part panel {
    sketch base = rect(80, 50);
    obj body = extrude(base, 6);
    for i in range(hole_count) {
        obj hole = cut(circle(3), through body, @body.top(x: 10 + i * 12, y: 25));
    }
}
```

#### Type Inference from Fallback

| Declaration              | Type                                        |
| ------------------------ | ------------------------------------------- |
| `env x fallback 2`       | Number - used in arithmetic and comparisons |
| `env x fallback 2.5`     | Float - same as number                      |
| `env x fallback 'hello'` | String - use `==` for comparison            |
| `env x fallback true`    | Boolean - use directly in `if` conditions   |
| `env x fallback [1,2,3]` | List - iterable in `for` loops              |

Environment fallback lists and list overrides contain only number, string, or
boolean literals, including nested lists. Use a `var` when list items need
computed expressions.

### Functions

Functions encapsulate reusable geometry operations. They accept parameters, follow the same scoping rules as components, and can contain any valid BushSCAD statements.

Built-in call labels such as `radius:` and `target:` are optional. Unlabeled
values fill the documented positional slots in order, and may be interleaved
with labeled values. Labels remain available when a call needs a specific
slot; required values still need to be supplied, while optional values may be
omitted.

Parameter names must be unique. Positional arguments fill the next unassigned
parameter in declaration order; named arguments bind by name and may be
interleaved with positional arguments. Supplying a parameter more than once,
using an unknown name, passing excess positional arguments, or omitting a
required parameter is an error.

#### Global Function

```
fn bolt_hole(d) {
    sketch hole = circle(d);
    obj hole = cut(hole, through base);
}
```

#### Function with Defaults

```
fn countersunk_hole(d, depth: 3, cs_ratio: 1.8) {
    sketch hole = circle(d);
    sketch countersink = circle(d * cs_ratio);
    return {
        obj hole = cut(hole, depth),
        obj cs = cut(countersink, depth * 0.4),
    }
}
```

Statements before `return` set up local sketches, variables, and helper declarations for the invocation. A `return { ... }` block emits the function's result geometry, uses commas between returned entries, permits a trailing comma, and must be the final statement in the function.

#### Calling Functions

```
place(bolt_hole(3), @base.top(x: 10, y: 10));
place(countersunk_hole(4, depth: 5), @base.top.center);
bolt_hole(3);   // standalone - operates on current context
```

When a returned `cut(...)` omits a spatial target, it uses the target supplied by `place(...)`. Outside a placed call, add a final `@target` argument.

### For Loops & Control Flow

Loops and conditional branches run before geometry is built. Only operations from the selected branches and loop iterations appear in the model.

Range and radial loops use one binding name. Grid loops support one or two
names, and enumerate loops support one item name or an index/item pair. A list
loop can use one item name or destructure two-value list/point-tuple items into
two distinct names; every item must have exactly two values when destructuring.

#### Basic Range Loop

Use `range(end)` for a count starting at zero, `range(start, end)` for a
custom starting value, and `range(start, end, step)` for a custom increment.
Each loop stops before `end`.

```
for i in range(4) {
    var count_value = i; // 0, 1, 2, 3
}

for i in range(2, 5) {
    var start_value = i; // 2, 3, 4
}

for i in range(2, 8, 2) {
    var stepped_value = i; // 2, 4, 6
}
```

#### Grid Loop

```
for (i, j) in grid(4, 3) {
    sketch hole = circle(2);
    obj hole = cut(hole, through base, @base.top(x: 10 + (i * 15), y: 10 + (j * 12)));
}

// grid with automatic spacing - i and j become absolute positions
for (i, j) in grid(cols: 4, rows: 3, spacing: 15) {
    sketch hole = circle(2);
    obj hole = cut(hole, through base, @base.top.front_left(x: i, y: j));
}
```

#### Radial Loop

Use `radial()` to distribute features around a centre point. The loop variable is the angle in degrees at each step.

```
// radial(count) - evenly spaced around 360 degrees
for a in radial(6) {
    sketch hole = circle(3);
    obj hole = cut(hole, through base, @base.top.center(radius: 20, angle: a));
}

// radial(count, start, sweep) - partial arc
for a in radial(4, start: 0deg, sweep: 180deg) {
    sketch hole = circle(3);
    obj hole = cut(hole, through base, @base.top.center(radius: 15, angle: a));
}
```

#### Loop over a List

```
var mount_points = [(10, 10), (50, 10), (10, 30), (50, 30)];
for pt in mount_points {
    sketch hole = circle(3);
    obj hole = cut(hole, through base, @base.top(x: pt.x, y: pt.y));
}
```

#### Enumerate

```
var bolt_sizes = [2, 3, 4, 3, 2];
for (i, d) in enumerate(bolt_sizes) {
    sketch hole = circle(d);
    obj hole = cut(hole, through base, @base.top.front_edge.center(x: i * 12));
}
```

#### `where` Filter

A `where` clause skips loop iterations that do not match its condition:

```bushscad
for (i, j) in grid(cols: 4, rows: 3, spacing: 15) where i != 2 {
    sketch hole = circle(2);
    obj hole = cut(hole, through base, @base.top.front_left(x: i, y: j));
}
```

#### Conditional - if / else

An `if` block includes geometry only when its condition is true. Use `else` for the other branch:

```bushscad
var thick_mode = false;
sketch profile = rect(40, 20);
obj body = extrude(profile, thick_mode ? 10 : 6);

if thick_mode {
    fillet(@body.top.edges, 1);
} else {
    chamfer(@body.top.edges, 1);
}
```

### Components & Scope

Components are the primary unit of reuse. They follow standard lexical scoping: inner scopes can see outer scopes, outer scopes cannot see inner scopes, and inner definitions shadow outer ones of the same name.

#### Global Component

```
part bracket {
    sketch body = rect(40, 20);
    obj body = extrude(body, 5);
    @bracket = @body.bottom.front_left;
    fillet(@body.top.edges, 1);
    chamfer(@body.bottom.edges, 0.5);
}
```

#### Local Component (Shadows Global)

```
part plate {
    part bracket {   // only visible inside plate
        sketch body = rect(this.width - 5, 15);
        obj body = extrude(body, 3);
        @bracket = @body.bottom.front_left;
        fillet(@body.top.edges, 0.5);
    }
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    place(bracket, @base.top.front_left(x: 5, y: 5));
    fillet(@base.top.edges, 2);
}
```

#### Scope Resolution Order

```
local component scope
  â†’ parent component scope
  â†’ file scope
  â†’ imported scope (via import statements)
  â†’ error: undefined identifier
```

### Optional Keyword Arguments

Value arguments can use positional values, keyword labels, or a mix. Positional values fill remaining slots in the order listed by each function. Labels are optional and can select a slot when skipping a defaulted argument or specifying values out of order. Structural keywords that select an operation or geometry remain required.

```bushscad
sketch base = rect(60, 40);
sketch sized = rect(width: 60, height: 40);
sketch mixed = rect(60, height: 40);
obj body = extrude(base, depth: 10);
sketch slot = rect(8, 4);
obj pocket = cut(slot, through body, @body.top.center);
```

Keywords such as `through`, `around`, and `fallback` select an operation or declaration form and remain required when that form is used. Value labels such as `depth:`, `open:`, and `axis:` may be omitted when the value is supplied in its positional slot.

## Sketch Profiles

### Sketch

A sketch defines a named 2D profile. Sketches are declared with the `sketch` keyword and an assignment:

```
sketch base = rect(60, 40);
```

The sketch name is a reusable profile; it does not carry solid faces or edges. Topology belongs to each `obj` instance. A single sketch can be referenced by multiple `obj` declarations, each producing an independent solid with its own geometry and surface references.

The `obj` name should only match the sketch name when the user deliberately wants them bound together as a single conceptual unit. In all other cases, give them distinct names to keep the profile and the solid clearly separate.

```
sketch profile = rect(60, 40);

// Two independent solids from one sketch - distinct names make the relationship clear
obj base  = extrude(profile, 10);
obj shelf = extrude(profile, 4, @base.top.center);

// Surface references use the obj names, not the sketch name
fillet(@base.top.edges, 2);
fillet(@shelf.top.edges, 1);

// When the sketch and obj are intentionally bound together, matching names are fine
sketch boss = circle(10);
obj boss = extrude(boss, 8, @base.top.center);  // sketch and obj are the same concept
```

Sketches are always drawn on a plane; inside a component the plane defaults to the project `workplane` origin unless specified via `from` or `on`.

#### Primitives

```
sketch base    = rect(60, 40);                       // rectangle: width, height
sketch cap     = rect(60, 40, r: 4);                 // rounded rectangle: corner radius
sketch boss    = circle(10);                         // circle: diameter
sketch slot    = roundrect(20, 8, r: 4);             // stadium / slot shape
sketch face    = triangle(30, 20);                   // isosceles triangle: base, height
sketch outline = polygon([(0,0),(30,0),(15,26)]);    // arbitrary polygon
sketch profile = path(...);                          // named CAD-style profile
sketch shape   = wrap([...]);                        // closed shape from points
```

A rectangle's 2D outline sides are implicitly `bottom`, `right`, `top`, and
`left`. An optional side-name argument keeps a renamed side as a compact
reference without expanding the rectangle into four lines:

```bushscad
sketch bracket = rect(60, 40, bottom: mount_edge);
obj body = extrude(bracket, 5);
fillet(@body.mount_edge.edges, 1);
```

Side-name values are bare identifiers, not numeric expressions. Any subset of
the four canonical sides may be renamed, and the effective names must remain
unique. `bottom` and `top` here mean the rectangle's minimum-Y and maximum-Y
2D outline sides; they are distinct from an extruded object's bottom and top
cap faces.

#### Sketch Component Aliases

Use postfix `as name` to retain the identity of a primitive inside a composed
sketch. Rectangle aliases expose all four canonical sides without individual
side-renaming arguments:

```bushscad
sketch crossed =
    rect(60, 20) as horizontal +
    rect(20, 60) as vertical;
obj body = extrude(crossed, 8);

fillet(@body.horizontal.top, 1);
```

The component path is part of the topology name, so equal default names on
different primitives remain distinct: `@body.horizontal.top` and
`@body.vertical.top` select different authored memberships. Explicitly named
segments in a `path(...)` or profile component are namespaced the same way.
Aliases survive sketch placement, Boolean composition, solid construction,
and later modifier topology updates. Duplicate component aliases in the same
composed sketch and unknown members below a known alias are compile errors.

All sketches default to `origin: center`, which preserves the existing centered
placement behavior. Use `origin: corner` or a final bare `corner` argument to
anchor a sketch from the top-left of its evaluated 2D bounds instead:

```
sketch plate = rect(60, 40, origin: corner);
sketch hole  = circle(8, corner);
```

Custom `path(...)` and `wrap(...)` sketches use the same sketch origin concept:

```
sketch tab = path(
    bottom = line((0, 0), (20, 0)),
    right = line(20, 8),
    top = line(0, 8),
    left = close()
) origin: corner;
```

#### Path Sketch

`path(...)` creates a connected 2D profile from line, arc, and close segment expressions. It is the preferred custom profile form when segment names matter for later references.

```
sketch vase_profile = path(
    plant foot = line((6, 0), (18, 0)),
    wall = line((16, 32)),
    lip = arc((12, 36), 4, ccw),
    inner = line(8, 4),
    heel = arc((6, 0), 4, ccw)
);

obj vase = revolve(vase_profile, 360deg around y);
fillet(@vase.lip.edges, 0.5);
chamfer(@vase.foot.edges, 0.35);
```

The first path segment must establish a start and end point. After that, shorthand segments infer their start from the path cursor:

```
sketch profile = path(
    base = line((0, 0), (20, 0)),
    side = line(20, 10),
    top = line(0, 10),
    return_edge = close()
);
```

Supported path-local segment forms:

```
name = line((x1, y1), (x2, y2))
name = line(x, y)
name = line((x, y))
line(x, y)
line((x, y))
line([(x1, y1), (x2, y2), ...])
name = arc(endpoint, radius?, direction?)
name = arc(start, end, radius?, direction?)
name = arc(start: point, end: point, radius: value, direction: cw|ccw)
name = close()
close()
```

`(x, y)` is the universal 2D point expression. When a `line(...)` or `arc(...)` call displays two points, both points must use tuple syntax. For one cursor-inferred endpoint, the tuple is optional: `line(20, 10)` and `line((20, 10))` are equivalent inside `path(...)`. A two-point arc with no radius makes a semicircle; radius and direction are optional positional or labeled values. A list of point tuples repeats cursor-inferred lines in order.

Path sketches may contain more than one closed body. By default,
`extrude(sketch_name, depth)` uses every detected closed body that has not been
ignored. Prefer naming bodies from stable path features rather than coordinates.
`loop(feature)` selects the closed loop containing a named path line, arc, or
close feature:

```
sketch plate = path(
    outer_bottom = line((0, 0), (80, 0)),
    outer_right = line((80, 40)),
    outer_top = line((0, 40)),
    outer_left = close(),
    hole_bottom = line((25, 10), (55, 10)),
    hole_right = line((55, 30)),
    hole_top = line((25, 30)),
    hole_left = close(),
    outer = loop(outer_bottom),
    hole = loop(hole_bottom),
    shell = outer_bottom - hole_bottom,
    ignore(hole)
);

obj full  = extrude(plate, 5);        // every non-ignored body
obj shell = extrude(plate.shell, 5);  // only the named shell
obj many  = extrude([plate.shell], 5);
```

A same-sketch body list is a set union. Repeating an alias, or selecting a body
already contained by another alias, contributes each atomic region only once.
For example, `[plate.outer, plate.hole]` is equivalent to `plate.outer` when
`outer` already contains `hole`.

Body expressions can reference a named path feature directly, use the explicit
`loop(feature)` form, or reference an earlier named body. Direct feature
references and `loop(feature)` select the same loop-derived regions, so
`shell = outer_bottom - hole_bottom` is the concise form. Body aliases are
available only after their declaration. Expressions support `+` for union, `-`
for subtraction, and `&` for intersection:

```
combined = left + right
overlap = left & right
trimmed = combined - clearance
```

`&` binds more tightly than `+` and `-`. Operators at the same precedence are
left-associative; use parentheses whenever the intended grouping is easier to
read explicitly. `ignore(expression)` follows the same source-order rule, so it
can only reference aliases declared before it. It excludes the selected regions
from whole-sketch operations while keeping their edges available for editing
and constraints.

Selected path bodies currently work with normal `extrude` and `cut` operations.
They are not accepted by wrapped operations, `revolve`, `loft`, `sweep`, or
radial operations; those forms report a diagnostic instead of silently using
the whole sketch.

For imported, generated, or otherwise unnamed geometry, positional selection
remains available as a legacy fallback. `closed(x, y)` and `closed((x, y))` are
equivalent. `ignoreClosed(x, y)` excludes the body containing that point:

```
boss = closed(40, 20)
ignoreClosed(40, 20)
```

Whole-sketch algebra remains separate and continues to combine complete sketch
values directly:

```
sketch outer = circle(30);
sketch inner = circle(18);
sketch ring = outer - inner;
```

`plant` marks the boundary that supplies a sketch's default placement side.
Within a `path(...)`, it is a qualifier on a named element, so the planted
element must be named:

```
plant foot = line((6, 0), (18, 0))  // valid
plant line((6, 0), (18, 0))         // invalid
```

A compact rectangle selects one of its canonical sides after the complete
rectangle expression:

```bushscad
sketch plate = rect(40, 20) plant bottom;
sketch moved = rect(40, 20) at (28, 16) plant bottom;
sketch named = rect(40, 20, bottom: mount_edge) plant bottom;
```

The selector is `bottom`, `right`, `top`, or `left`. It remains canonical when
that side has a custom name: the last example plants the edge exposed as
`mount_edge`. The suffix belongs to a rectangle, optionally beneath local
`at (...)` placement; it is rejected on a Boolean sketch expression or another
primitive whose planted boundary would be ambiguous.

Named path segments are preserved through operations where possible, so generated faces and edges can be referenced as `@object.segment.edges` or `@object.segment.center`.
A planted line also marks the default planted side of an extruded ref or object.
When that source is placed without an explicit source anchor, placement uses
the center of the generated side face matching the planted line's outward
normal. The segment name is an author label; the placement source is the
generated side face such as `.front.center`, `.right.center`, `.back.center`,
or `.left.center`. An explicit source anchor in `place(...)` always overrides
the planted default.

Path sketches can also carry placement metadata:

```
origin((x, y))
```

This origin is a default placement anchor for flat extrude/cut/place workflows
when no planted line or explicit source anchor exists. It is separate from the
fixed global `origin` reference used by dimensions.

Path sketches can include geometric and dimensional constraints after their
segments. Segment endpoint targets use `.start` and `.end`; cursor-continuous
segments share solver points, so `right.start` resolves to the previous
segment's end.

```
sketch plate = path(
    origin((10, 5)),
    plant bottom = line((0, 0), (80, 0)),
    right = line((80, 40)),
    top = line((0, 40)),
    left = close(),
    constraint(bottom.start, fixed),
    constraint(bottom, horizontal),
    constraint(right, vertical),
    constraint(top, horizontal),
    constraint(left, vertical),
    constraint(bottom, length, 80),
    constraint(right, length, 40)
);
```

Supported path constraint forms:

```
constraint(segment, horizontal)
constraint(segment, vertical)
constraint(point, horizontal, other_point)
constraint(point, vertical, other_point)
constraint(segment, parallel, other_segment)
constraint(segment, perpendicular, other_segment)
constraint(segment, tangent, arc_or_line)
constraint(segment, equal, other_segment)
constraint(segment, symmetric, axis_segment)
constraint(segment.start, fixed)
constraint(segment.end, coincident, other_segment.start)
constraint(segment.end, midpoint, other_segment)
constraint(segment, length, value)
constraint(segment, length, value, (label_x, label_y))
constraint(segment.start, distance, other_segment.end, value, (label_x, label_y))
constraint(segment.start, distance, other_segment.end, value, axis: x, at: (label_x, label_y))
constraint(segment.start, distance, other_segment.end, value, axis: y, at: (label_x, label_y))
constraint(segment.start, distance, origin, value, (label_x, label_y))
constraint(segment.start, distance, origin.x_axis, value, (label_x, label_y))
constraint(segment.start, distance, origin.y_axis, value, (label_x, label_y))
constraint(segment, angle, value)
constraint(target_segment, angle, reference_segment, value)
constraint(target_segment, angle, origin.x_axis, value)
constraint(target_segment, angle, origin.y_axis, value)
constraint(segment, radius, value)
constraint(segment, diameter, value)
```

The older `at: (label_x, label_y)` label form is still accepted for existing
models.

Driving dimensions are constraints that modify sketch geometry. Reference
dimensions are display-only measurements and never enter the constraint solver:

```
dimension segment.length at (label_x, label_y)
dimension segment.start.distance to other_segment.end at (label_x, label_y)
dimension segment.start.distance to other_segment.end axis: x at (label_x, label_y)
dimension segment.start.distance to other_segment.end axis: y at (label_x, label_y)
dimension segment.start.distance to origin at (label_x, label_y)
dimension segment.start.distance to origin.x_axis at (label_x, label_y)
dimension segment.start.distance to origin.y_axis at (label_x, label_y)
dimension target_segment.angle to reference_segment at (label_x, label_y)
dimension target_segment.angle to origin.x_axis at (label_x, label_y)
dimension target_segment.angle to origin.y_axis at (label_x, label_y)
```

Dimensional constraints and reference dimensions may expose a sketch-local
numeric name with a trailing `as` clause:

```bushscad
constraint(bottom, length, width / 2, at: (20, -8)) as d0
dimension top.length at (20, 12) as measured_top
constraint(left, length, measured_top + 5mm, at: (-8, 20)) as d1
```

Names are scoped to their sketch, are independent of declaration order, and
must be unique. A name cannot shadow a visible variable, environment value, or
other value binding. Cyclic dimension dependencies are compile errors. Within
a driving dimension expression, named dimensions are live measurements of the
current solver geometry rather than copies of their initial displayed value.
They can be combined with outer numeric values, length/angle units, unary
negation, and `+`, `-`, `*`, `/`, or `%` arithmetic. Division by zero and
nonnumeric/unsupported local-dimension expressions are rejected.

`midpoint` takes a point or endpoint as its first target and a segment as its
reference. Unary `horizontal` and `vertical` constrain the orientation of one
line. When supplied with a second point, `horizontal` instead keeps the two
points at the same Y coordinate and `vertical` keeps them at the same X
coordinate. These inferred point relationships let snapped geometry continue
to follow later edits instead of recording only the coordinates at the time of
the snap. A fixed segment fixes both endpoints (and an arc's radius), so it
locks both the size and position of that curve. Axis-relative angles use the
fixed global `origin.x_axis` or `origin.y_axis` as their reference.

Midpoint and horizontal/vertical relationships constrain geometric intent
instead of storing a one-time coordinate adjustment. For example, a
construction line whose endpoints are constrained to opposite rectangle-side
midpoints continues to track the rectangle as it is resized or moved.

Each geometric target can have only one driving dimension. Additional
dimensions for the same side or endpoint pair are reference dimensions.
For two-point dimensions, `axis: x` measures the displayed horizontal
component `abs(dx)`, `axis: y` measures `abs(dy)`, and omitting `axis` measures
the aligned Euclidean distance. The solver preserves the points' authored side
of each other while satisfying a driving component value. Specify `axis: x` or
`axis: y` for component dimensions; omit `axis` for aligned distance.
`origin` is fixed at `(0, 0)`. `origin.x_axis` measures signed orthogonal
distance to `y = 0`; `origin.y_axis` measures signed orthogonal distance to
`x = 0`. Displayed dimension values remain positive.

Compact primitives can keep driving dimension lines without expanding into
explicit path edges and implied constraints. `_` is a deferred primitive scalar
and is valid only in a primitive argument slot. A following assignment supplies
that slot and preserves the dimension in source:

```bushscad
var plate_width = 77.808;

sketch plate = rect(_, 44.384) at (42.796, 22.192);
@plate.bottom = plate_width;
@(plate.left, origin.y_axis) = 3;

sketch hole = circle(_);
@hole.diameter = 12;

// A radius driver keeps the primitive diameter expression explicit.
sketch pin = circle(2 * pin_radius);
@pin.radius = pin_radius;
```

For rectangles, a dimension on `bottom` or `top` supplies width, while a
dimension on `left` or `right` supplies height. Renamed sides use their compact
alias, for example `rect(_, 40, bottom: mount_edge)` followed by
`@plate.mount_edge = width`. A distance between two references uses
`@(first, second) = value`. The same syntax can follow a `path(...)` containing
one compact primitive plus retained construction geometry.

Circle dimensions may target either `diameter` or `radius`. A deferred
`circle(_)` diameter is supplied by `@circle.diameter = value`. A radius
dimension uses `@circle.radius = value`; write the primitive diameter as
`circle(2 * value)` so the radius expression drives the generated geometry.

Each `_` must have exactly one matching assignment. It cannot be used as a
variable, assignment value, path coordinate, or other general expression. The
right-hand value remains an ordinary expression and may use variables, units,
and arithmetic. Add `as name` to retain a dimension name. Labels with no
placement clause are automatically placed beyond the sketch bounds: horizontal
measurements prefer the top and vertical measurements prefer the right. An
optional scalar `at amount` places the label that distance from the measurement
midpoint along the automatically chosen outward direction:

```bushscad
@plate.bottom = plate_width at 55 as overall_width;
```

Relative angle dimensions measure the smaller angle from `0deg` through
`180deg`. In a relative angle constraint, the first segment is the driven
target and the second is its reference. Angular construction rays are visual
guides only and are not emitted as sketch segments.

Construction profile/path segments remain first-class reference geometry:

Construction segments remain in the source, participate in constraints and preview, and stay out of the solid profile wire. For example:

```
sketch guide = path(
    construction center = line((0, 0), (80, 0)),
    plant bottom = line((0, 10), (80, 10))
);

sketch guided_plate = path(
    rect(80, 40),
    construction center = line((-40, 0), (40, 0))
);
```

Construction segments participate in constraints and preview, but they are
excluded from the solid profile wire. `rect(...)`, `circle(...)`, and
`ellipse(...)` may appear as compact members of `path(...)`; they lower to
their canonical named profile segments before path constraints are solved.

`ellipse(width, height)` creates an exact axis-aligned elliptical profile.
Both dimensions must be positive. Equal dimensions canonicalize to
`circle(diameter)`, while unequal dimensions remain exact ellipse curves
through preview, Boolean sketch regions, extrusion, and export. Width and
height may be deferred to compact driving assignments:

```bushscad
sketch seal = ellipse(_, 20) at (8, 0);
@seal.width = 40;

sketch mixed = path(
    ellipse(40, 20),
    circle(8) at (12, 0),
    construction ellipse(48, 28)
);
```

Sketch-level edit calls are exact-only. The implemented exact cases are:

```
sketch padded = offset(rect(40, 20), 2);
sketch larger_hole = offset(circle(8), 1);
sketch rounded = fillet(rect(40, 20), 3);
sketch exact_oval = ellipse(40, 20);
sketch exact_circle = ellipse(12, 12);  // lowers to circle(12)
sketch guide_line = spline([(0, 0), (20, 0)]); // lowers to a line profile
```

`project(...)`, `trim(...)`, `extend(...)`, and multi-point `spline(...)` are
recognized syntax but intentionally emit diagnostics until exact geometry
support is implemented.

#### Wrap Sketch

`wrap(...)` creates a closed sketch boundary from a list of points. It is best for quick closed shapes where individual edge names are not important.

```
sketch rectish = wrap([
    (-20, -10),
    (20, -10),
    (20, 10),
    (-20, 10)
]);
```

The default mode is `ordered`, which connects points in the order written. The general form is:

```
wrap(points, intent?, options?)
```

Supported intents:

```
sketch ordered_shape = wrap(points, ordered);
sketch hull_shape = wrap(points, convex);
sketch concave_shape = wrap(points, concave);
sketch organic_shape = wrap(points, smooth);
```

Modes change the generated profile topology:

- `ordered` connects points exactly in written order.
- `convex` builds the outer convex hull and bows generated spans outward.
- `concave` preserves the written point order, including inward dents, and bows generated spans inward.
- `smooth` rounds the outline with tangent curve blends, including inward dent points.

Keyword options are accepted after the intent:

```
sketch blob = wrap(points, smooth, tension: 0.4);
sketch footprint = wrap(points, convex, tolerance: 0.2);
sketch gasket = wrap(points, ordered, rounded: 2);
```

`rounded` adds tangent corner blends to ordered, convex, or concave outlines, including inward dent points. Convex corners use exact radius arcs; acute inward dents use sampled tangent blends so the curve turns into the point instead of bulging out of it. `convex` and `concave` flex only spans generated by `wrap(...)`; authored `path(...)` lines and arcs are unchanged. `tension` controls the automatic radius used by `smooth`, where higher values create broader blends. `tolerance` removes duplicate or near-duplicate neighboring points before the outline is built.

Operations that create solids from 2D profiles require a closed sketch unless the operation explicitly supports open profiles. Open `path(...)` sketches must use `close()` before `extrude`, `revolve`, `loft`, or `cut`; `wrap(...)` is always closed.

#### Word Sketch

`word` creates a 2D profile from text. Font names accept an ordered CSS-style fallback list. Import a font file when a shared project needs repeatable outlines.

```bushscad
sketch label = word('FRONT', size: 8, font: "Inter, 'Segoe UI', sans-serif");
obj engraving = cut(label, 0.8, @base.top.center);
```

Text profiles can also be extruded to emboss a surface. Alignment defaults to the sketch anchor and accepts `center`, `left`, or `right`.

#### Inset Shorthand

When sketching on an existing face, `inset()` shrinks the face boundary uniformly.

```
sketch lid = rect inset(5);                            // inset all sides by 5mm
sketch lid = rect inset(5, 10);                        // inset x:5, y:10
sketch lid = rect inset(top: 3, sides: 8, bottom: 3); // named sides
```

#### Sketching on a Cylindrical Face

When a sketch targets the curved side of a cylinder, specify the angular start position. The sketch plane origin is placed at that angle, with X running tangent to the surface and Y along the cylinder's height axis. Without `wrap`, the profile stays flat and tangent to the cylinder. Add `wrap` to the curved placement when the resulting extrusion or cut should follow the surface.

```
sketch front_label = word('FRONT', size: 6, font: 'sans', align: center, @base.curved(0deg, wrap));

sketch port = rect(10, 6, @base.curved(90deg, wrap));

// Cut or extrude follows from the same surface reference
obj engraved = cut(front_label, 0.8, @base.curved(0deg, wrap));
obj port     = cut(port, through base, @base.curved(90deg, wrap));
```

Wrapped operations require a cylindrical `.curved` target. Use the flat form when a tangent construction plane is the intended result.

### Wrap-to-Surface for Cylindrical Sketches

Use `wrap` on a curved placement to make an extrusion or cut follow a cylindrical surface.

```
// Follows the target cylinder's curvature
obj label = cut(label, 0.8, @base.curved(0deg, wrap));
```

### Arc & Curve Primitives in Sketches

Use `arc(...)` inside `path(...)` to add a circular arc. Named path segments
remain addressable on an extruded or cut object, for example `obj.rim`.

```bushscad
sketch body = path(
    bottom = line((0, 0), (30, 0)),
    rim = arc((30, 0), (30, 20), 10, cw),
    top = line((30, 20), (0, 20)),
    left = line((0, 20), (0, 0))
);
```

### Sketch Constraint System

Constraints and dimensions are declared inside `path(...)`. Segment endpoints
are referenced by segment name or by `.start` and `.end`.

#### Syntax

```bushscad
sketch profile = path(
    bottom = line((0, 0), (60, 0)),
    right = line((60, 0), (60, 40)),
    top = line((60, 40), (0, 40)),
    left = close(),
    constraint(bottom, horizontal),
    constraint(right, perpendicular, bottom),
    constraint(bottom, length, width),
    constraint(right, length, height)
);
```
#### Geometric Constraints

`coincident`, `horizontal`, `vertical`, `parallel`, `perpendicular`, `tangent`, `equal`, `symmetric`, `fixed`

#### Dimensional Constraints

`length`, `distance`, `angle`, `radius`, `diameter`

Underconstrained sketches produce warnings. Overconstrained sketches fail with precise diagnostics pointing to the conflicting constraint pair. The sketch view shows constrained elements (black), underconstrained elements (blue), and conflicting elements (red).

## Solid Primitives

### Direct 3D Primitives

`obj` can also bind direct 3D primitive solids without declaring a sketch first.
These primitives are useful for simple bodies, imported-SCAD-style examples, and
quick construction solids.

Direct primitives accept an optional trailing placement argument. For block-like
and height-based primitives, local X/Y are centered and local +Z grows from the
bottom placement plane. Spheres, ellipsoids, torus bodies, and polyhedra are
placed by their authored local origin.

```
obj block = cube([40, 20, 8]);
obj pin = cylinder(12, d: 6, @block.top.center);
obj shell = torus(majorRadius: 20, minorRadius: 3);
```

Use `base_unit = mm` with direct primitives. Direct-primitive dimensions are
passed to the geometry bridge as normalized numeric values. Use named `r:` or
`d:` arguments for spheres. `geodesicSphere` follows the sphere construction
path, and ellipsoid geometry is rotationally symmetric, so keep its X and Y
radii equal. `roundedCylinder` retains `roundingRadius` as metadata but creates a
straight cylinder; apply a fillet for rounded rims. A torus uses
`minorSegments`; `majorSegments` is not consumed.

Supported primitive names:

| Primitive                   | Common arguments                                                         |
| --------------------------- | ------------------------------------------------------------------------ |
| `cube` / `cuboid`           | `size`, `[x, y, z]`, `width`, `depth`, `height`                          |
| `sphere` / `geodesicSphere` | `r` / `radius`, `d` / `diameter`, `segments`                             |
| `ellipsoid`                 | `radius: [x, y, z]`, `segments`                                          |
| `cylinder`                  | `height` / `h`, `r` / `radius`, `d` / `diameter`, `r1`, `r2`, `d1`, `d2` |
| `cylinderElliptic`          | `height`, `radius: [x, y]`, `startRadius`, `endRadius`                   |
| `cone`                      | `height`, `r` / `radius`, `d` / `diameter`                               |
| `frustum`                   | `height`, `r1` / `radiusBottom`, `r2` / `radiusTop`                      |
| `roundedCuboid`             | `size`, `r` / `radius`, `segments`                                       |
| `roundedCylinder`           | `height`, `r` / `radius`, `roundingRadius`, `segments`                   |
| `torus`                     | `majorRadius`, `minorRadius`, `majorSegments`, `minorSegments`           |
| `polyhedron`                | `points: [[x, y, z], ...]`, `faces: [[i, j, k], ...]`                    |

## Solid Creation

### Extrude

`extrude` pushes a named sketch into a solid. The direction defaults to the outward normal of the placement face. Extrude never subtracts - use `cut` for that.

#### Named Geometry Objects - `obj`

`obj` binds an operation result to a named geometry object. The `obj` name is the reference frame for downstream surface references, placement, and details; sketch names do not carry solid faces or edges.

#### Basic Syntax

```
sketch base = rect(60, 40);
obj base = extrude(base, 10);         // matching names - intentionally bound together
```

Or with distinct names when the sketch is reused:

```
sketch plate = rect(60, 40);
obj bottom = extrude(plate, 10);
obj top    = extrude(plate, 6, @bottom.top.center);  // same profile, two solids
```

#### Extruding from a Surface

```
sketch pipe = circle(6);
obj pipe = extrude(pipe, 20, @base.top.center);
```

#### Directional Extrude

```
sketch rib  = rect(40, 5);
sketch boss = circle(8);
obj rib  = extrude(rib, 5, @base.front.center);
obj boss = extrude(boss, 8, @base.top.front_left(x: 10, y: 10));
```

#### Symmetric Extrude

```
sketch flange = rect(80, 10);
obj flange = extrude(flange, 4 symmetric, @base.top.center);  // 2mm each side
```

### Revolve

`revolve` spins a sketch profile around an axis to produce a solid of revolution.

```
sketch profile = polygon([(0,0),(10,0),(10,20),(6,25),(0,25)]);

obj vase    = revolve(profile, 360deg around y);
obj bracket = revolve(profile, 270deg around base.left.center);
```

Optional `radius:` named argument offsets the profile outward from the revolve axis before spinning. Use it to produce a torus or ring shape:

```
sketch cross = circle(3);
obj ring = revolve(cross, 360deg around z, radius: 20);
// â†’ torus: tube radius 3mm, ring radius 20mm from Z axis
```

`radius:` is resolved as an expression before placement. It may reference variables but not `this.` (since the object does not yet exist at revolve time).

### Loft

`loft` blends between two or more sketch profiles to produce a smooth transition solid.

```
sketch base_profile = rect(60, 40);
sketch top_profile  = circle(20);

obj body   = loft(base_profile, top_profile, height: 30);
obj fairing = loft(base_profile, top_profile, height: 40, guide: rail_curve);
```

### Radial Extrudes and Cuts

`radial_extrude` and `radial_cut` sweep a closed sketch through an angular or guided path. The explicit-axis form remains valid, but most surface-based features can infer the axis from `from:`.

#### Explicit Axis

```
sketch rib = rect(4, 2);
obj rib = radial_extrude(rib, axis: z, angle: 90, length: 20);

sketch slot = rect(3, 6);
obj groove = radial_cut(slot,
    axis:   z,
    angle:  90,
    length: 8,
    from:   base.top.center,
    radius: 14);
```

#### Inferred Axis From Placement

When `axis:` is omitted, BushSCAD uses the placement axis from `from:`. This is the preferred form for features that start on a known surface.

```
obj boss = radial_extrude(profile,
    from:   base.top.center,
    angle:  135,
    length: 18,
    radius: 10,
    curve:  ease-in-out);
```

`radial_cut` uses the object owning `from:` as its boolean target.

```
obj groove = radial_cut(slot,
    from:   housing.top.center,
    angle:  90,
    length: 6,
    radius: 12);
```

#### Surface-to-Surface / Axis-to-Axis Bridge

Use `from:` + `to:` to sweep smoothly between two placements. Without `along:`, BushSCAD creates a natural surface-to-surface path from the source placement normal to the destination placement normal. Add `curve:` to reshape that generated path while keeping the same start and finish locations.

```
obj channel = radial_cut(slot,
    from:  body.top.center,
    to:    body.front.center,
    curve: ease-in-out);
```

Use `along:` when the transition must follow an explicit path:

```
path bend_path = polyline([(0, 0, 12), (10, 0, 6), (24, 0, 12)]);

obj channel = radial_cut(slot,
    from:  @body.outer(x: 5, y: 0),
    to:    @body.inner(x: 20, y: 8),
    along: bend_path);
```

The same overload is used for smooth transitions between axis-like placements:

```
path transition_curve = spline([(0, 0, 0), (12, 6, 8), (24, 0, 16)]);

obj web = radial_extrude(profile,
    from:  bracket.axis_a,
    to:    bracket.axis_b,
    along: transition_curve);
```

#### Curve Controls

`curve:` controls station interpolation along angle/length sweeps. Supported values are `natural`, `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`, `step-start`, `step-end`, and `cubic-bezier(x1, y1, x2, y2)`.

```
obj cam = radial_extrude(profile,
    axis:   z,
    angle:  270,
    length: 30,
    radius: 10,
    curve:  cubic-bezier(0.2, 0.8, 0.4, 1.0));
```

### Sweep and Path Modeling

Path-driven solids for handles, tubes, wires, ribs, cable channels, and organic mechanical forms.

#### Path Declarations

```
// Spline through 3D control points
path handle_path = spline([(0, 0, 0), (20, 0, 10), (40, 0, 0)]);

// Polyline (straight segments)
path rail = polyline([(0,0,0), (50,0,0), (50,0,30)]);

// Arc in 3D
path curve = arc(from: (0,0,0), to: (30,0,30), radius: 20);
```

#### `sweep()`

```
sketch handle_section = circle(6);
obj handle = sweep(handle_section along handle_path);

// Sweep cut - path-shaped groove
obj channel = cut(sweep(channel_profile along cable_path), through housing);
```

#### Orientation Controls

| Option      | Behaviour                                      |
| ----------- | ---------------------------------------------- |
| _(default)_ | Follow path tangent; minimize twist            |
| `fixed`     | Fixed world-up axis throughout                 |
| `binormal`  | Follow path binormal for constant-twist sweeps |

## Solid Editing

### Cut

`cut` subtracts geometry from existing geometry. The regular form subtracts a sketch profile and mirrors `extrude` syntax exactly - using the `obj` keyword to bind the result, so cut geometry can be referenced downstream for details and surface access. Cut is always a boolean subtraction - never an addition.

The `obj` name is the reference frame for all inner faces of the cut. The sketch used to make the cut defines the face topology, and the `obj` name is how those faces are addressed. When a sketch or extrude is placed from a cut face, the default direction is inward - toward the interior of the parent solid.

#### Blind Cut

```
sketch pocket = rect(20, 20);
obj pocket = cut(pocket, 4, @base.top.center);      // 4mm deep pocket
```

#### Through Cut

```
sketch hole = circle(3);
obj hole = cut(hole, through base, @base.top.center);

sketch slot = rect(30, 5);
obj channel = cut(slot, through base, @base.top.center);  // distinct obj name
```

#### Cut from a Specific Face

```
sketch bore   = circle(3);
sketch notch  = rect(10, 5);
obj bore  = cut(bore, through base, @base.bottom.center);   // upward from bottom
obj notch = cut(notch, 3, @base.front.center);         // into front face
```

#### Cut with Offset Position

```
sketch bolt = circle(3);
obj bolt = cut(bolt, through base, @base.top(x: 10, y: 10));
```

#### Solid Tool Cut

`cut` can also subtract a solid tool. The tool can be a predefined object or an inline solid operation such as `extrude`, `revolve`, `loft`, `sweep`, or `thicken`.

```
obj channel = cut(
    loft(profile_a, profile_b, height: 30),
    @base.top.center
);

obj shaped_slot = cut(prebuilt_tool, @base.front.center(x: 12));
obj offset_socket = cut(revolve(profile, 360deg around z), @plane(base.top.center, offset: 1));
```

In a solid tool cut, a placement is required. It identifies the target body through the owning object of the face reference and places an oriented copy of the tool on that placement before subtracting. Predefined tool objects remain normal visible bodies; the cut uses a copy. Inline tools are temporary and are not emitted as standalone output bodies. Use `@plane(face, offset: value)` when the tool should start from an offset plane.

Use a one-line `ref` when a reusable solid tool should be available by name but hidden at declaration:

```
sketch tool_sk = rect(10, 18);
ref punch_tool = extrude(tool_sk, 14);

obj top_slot = cut(punch_tool, @base.top.center);
```

Identifier tools are only parsed as solid tools in the explicit `cut(name, @placement)` form. Existing sketch cuts remain unchanged:

```
obj pocket = cut(profile, 4, @base.top.center);
obj hole = cut(profile, through base, @base.top.center);
```

#### Named Faces on Cut Geometry

Cuts do not introduce naming ambiguity. The faces produced by a cut inherit semantic names based on their orientation and role - the same directional naming rules that apply to extruded geometry. No user-defined tags are needed for the common case.

Default face names per primitive after extrusion or cut:

| Primitive            | Face Names                                              |
| -------------------- | ------------------------------------------------------- |
| `rect`               | `top`, `bottom`, `front`, `back`, `left`, `right`       |
| `triangle`           | `top`, `bottom`, `base`, `left`, `right`                |
| `circle`             | `top`, `bottom`, `curved`                               |
| `roundrect` / `slot` | `top`, `bottom`, `left_cap`, `right_cap`, `curved`      |
| `polygon`            | `top`, `bottom`, `face_0`, `face_1`... in winding order |

The `obj` name is the only valid reference - sketch names carry no face topology. Placing on a cut face extrudes inward by default; the face's outward normal points toward the interior of the parent solid, mirroring the Fusion 360 workflow of sketching on a pocket wall.

```
sketch recess = rect(20, 20);
obj pocket = cut(recess, 8, @base.top.center);

// All of these resolve without any redundant aliases:
fillet(@pocket.top.edges, 1);           // the opening rim of the pocket
fillet(@pocket.front, 0.5);      // front wall of the pocket
obj boss = extrude(boss_profile, 3, @pocket.bottom.center);  // feature on pocket floor
```

A through cut produces only wall faces - there is no `bottom`. The surrounding face on the parent solid where the cut opens retains its original name (`base.top` is unchanged by a cut through it).

#### Referencing Cut Geometry

Because cuts are named `obj` instances, you can fillet their edges, reference their inner faces, and use them as placement anchors.

```
sketch recess = rect(20, 20);
obj pocket = cut(recess, 8, @base.top.center);

fillet(@pocket.top.edges, 1);
fillet(@pocket.front.edges, 0.5);

sketch nub = circle(4);
obj boss = extrude(nub, 3, @pocket.bottom.center);
```

#### Explicit Fuse

`fuse(a, b, ...)` explicitly unions two or more solid objects into shared topology.

```
sketch base_sk = rect(50, 30);
sketch boss_sk = circle(10);

obj base = extrude(base_sk, 6);
obj boss = extrude(boss_sk, 8, @base.top.center);

fuse(base, boss);
```

`fuse` accepts positional object names only. In explicit parts, additive solids are already fused for final part topology, but `fuse(...)` is still useful when the model needs a deliberate boolean union point or when default-scope bodies should become one solid.

### Surface Operations

`fill(boundary)` creates an open surface from a closed sketch or a closed face
boundary. `offset_surface(surface, distance)` moves an open surface along its
normal. `thicken(surface, thickness)` extrudes a surface into a solid.

```bushscad
surface cap = fill(rect(30, 20));
surface raised = offset_surface(cap, 1);
obj lid = thicken(raised, 2);
```

The offset distance is signed. Thickening is one-sided along the surface normal;
use `shell` to hollow a solid.

### Edge and Face Details

Geometric details - fillets, chamfers, shells, draft angles - refine existing geometry. `fillet(...)` may be declared at top level or inside a component/part body, anywhere after the geometry operation it targets. Other detail forms are body-local unless documented otherwise.

#### Execution Order

| Detail    | Behaviour                                                                                                                                                                                                                                |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shell`   | Executes immediately in declaration order. Operations after a shell see the hollowed geometry.                                                                                                                                           |
| `draft`   | Applies after geometry, before chamfers and fillets. |
| `chamfer` | Runs after drafts and before fillets. |
| `fillet`  | Runs after drafts and chamfers. |

Drafts run first for each body. Chamfers generally follow drafts, then fillets. A cut-feature fillet may stay before a later body chamfer when that order preserves valid edges. Keep radii and offsets within the local geometry; an open-shell rim fillet should be smaller than the shell wall thickness.

#### Details Inside a Component or Part

```
part plate {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);

    sketch boss = circle(10);
    obj boss = extrude(boss, 8, @base.top.center);

    // Shell executes here - geometry below sees hollow body
    shell(base, 1.5, top);

    // Cut into inner wall - valid because shell already ran
    sketch label = word('INSIDE', size: 5, font: 'sans', align: center);
    obj label = cut(label, 0.5, @base.inner.front.center);

    // Deferred finishing details - cross-kind order is planned by the backend
    fillet(@base.top.edges, 2);
    fillet(@base.top.front_edge, 3);
    chamfer(@base.bottom.edges, 1);
}
```

#### Fillet

```
fillet(@base.top.edges, 2);              // all top edges, 2mm radius
fillet(@base.top.front_edge, 3);        // single named edge
fillet(@base.sides, 1);                  // all side face edges
fillet(@base.top.perimeter, 2);          // outer boundary edges only
fillet(@base.perimeter, 2);              // authored exterior object boundary
fillet(@base.edges, 1);                  // every edge on the object
fillet(@base, 1);                        // fillet shorthand for @base.edges
```

#### Chamfer

```
chamfer(@base.bottom.edges, 1);              // 45deg chamfer, 1mm offset
chamfer(@base.top.front_left, 2);   // corner chamfer
```

#### Shell

```
shell(base, 1.5);                       // hollow with 1.5mm uniform wall
shell(base, 1.5, top);             // open face on top
shell(base, 1.5, [top, front]);    // multiple open faces
```

#### Draft Angle

```
draft(@base.sides, 2deg);            // 2 degree draft on all sides
draft(@base.front, 3deg);      // single face
```

Draft tilts selected faces around the neutral base plane; it is not an edge bevel. Use `chamfer` or `fillet` when the intended change is only along selected edges.

#### Thread

Cuts modeled thread geometry into an object.

```
thread(bolt_shaft, external, 6, 1, length: 12, direction: clockwise, angle: 18deg);
thread(target: hole_body, type: internal, d: 4.2, pitch: 0.7, length: 8,
       direction: counter_clockwise, angle: 22deg);
```

| Parameter             | Required for | Description                                      |
| --------------------- | ------------ | ------------------------------------------------ |
| `target:`             | both         | Object to receive modeled thread geometry        |
| `type:`               | both         | `external` (boss/shaft) or `internal` (hole)     |
| `d:`                  | both         | Nominal thread diameter in base units            |
| `pitch:`              | both         | Thread pitch (distance per revolution)           |
| `length:`             | optional     | Axial length of the modeled threaded region      |
| `direction:`          | optional     | `regular`, `clockwise`, or `counter_clockwise`   |
| `angle:` / `degrees:` | optional     | Lead angle for the visible handed thread grooves |

If `length:` is omitted, thread extent is inferred from the target geometry.
External threads use the target shaft's axial length. Internal threads use the
target cut/hole placement and depth when available, otherwise the target body's
thickness along the thread axis.
If `angle:` is omitted, the handed groove angle is derived from pitch and
diameter. Use degree values such as `angle: 18deg` when the visual lead angle
needs to be more pronounced or match a custom thread style.

The positional order is `thread(target, type, d, pitch, length?, direction?, angle?)`.
Every positional slot also has a keyword form, so labels can be added or omitted
to match readability needs.

#### Details in Nested Components

Each component manages its own details. A parent component's details do not affect child components placed within it.

```
part bracket {
    sketch body = rect(40, 20);
    obj body = extrude(body, 5);
    sketch gusset = triangle(8, 8);
    obj gusset = extrude(gusset, 3, @body.back.center);
    fillet(@body.top.edges, 1);
    chamfer(@body.bottom.edges, 0.5);
    fillet(@gusset.edges, 0.5);
}

part frame {
    sketch base = rect(120, 80);
    obj base = extrude(base, 10);
    place(bracket, @base.top.front_left(x: 5, y: 5));
    // frame's details - do not affect bracket
    fillet(@base.top.edges, 2);
    fillet(@base.bottom.edges, 1);
}
```

### Hole System and Hardware Library

Standard holes and common hardware presets so users do not manually calculate fastener dimensions.

#### Importing the Standard Hardware Library

```
use std.hardware.metric;
```

#### `hole()` Syntax

`hole()` is a language-level geometry feature that lowers to sketches and cuts.

```
// Clearance hole - unthreaded, passes bolt through
obj mount = hole(M3.clearance, through base, @base.top(x: 10, y: 10));

// Counterbore - clearance + recessed seat for bolt head
obj seat = hole(M3.counterbore, depth: 4, @base.top.center);

// Countersink - clearance + angled taper for flat-head screw
obj cs = hole(M3.countersink, depth: 5, @base.top.center);

// Tapped hole - threaded, receives bolt directly
obj tap = hole(M3.tap, depth: 8, @base.top.center);

// Pilot hole - smaller guide hole before tapping
obj pilot = hole(M3.pilot, depth: 6, @base.top.center);
```

#### Heat-Set Insert Pockets

```
obj insert = heatset_insert(M3, depth: 5, @boss.top.center);
```

#### Supported Symbolic Hardware Values

| Symbol              | Description                             |
| ------------------- | --------------------------------------- |
| `M2.clearance`      | Clearance hole diameter for M2 bolt     |
| `M2.tap`            | Tapped hole diameter for M2 thread      |
| `M2.counterbore`    | Counterbore spec for M2 bolt head       |
| `M2.countersink`    | Countersink spec for M2 flat-head screw |
| `M2.pilot`          | Pilot drill diameter before M2 tap      |
| `M2.heatset_insert` | Pocket spec for M2 heat-set insert      |

Same pattern for M2.5, M3, M4, M5. Holes work with `@`, tags, patterns, and aliases.

#### Pattern with Holes

```
use std.hardware.metric;

obj mount = hole(M3.clearance, through base, @base.top(x: 10, y: 10));
pattern(mount, linear, 4, 20);
```

#### Project-Level Overrides

Hardware dimension tables can be overridden in `bushscad.json`:

```json
{
  "hardware": {
    "M3.clearance": 3.4
  }
}
```

## References and Placement

### Surface References

BushSCAD names faces, edges, and points so later features can refer to them by purpose. Operations such as `extrude` and `cut` create named faces, and those labels are preserved through later geometry changes when possible.

#### Face References

```
base.top                   // top face
base.bottom                // bottom face
base.front                 // shorthand for base.front
base.back
base.left
base.right
base.front           // explicit form - front, back, left, right
base.sides                 // all side faces (useful in detail system)
```

#### Default Primitive Face Names

Each primitive sketch produces canonical face names after extrusion or cut. These are assigned at sketch time and require no annotation.

| Primitive            | Face Names                                              |
| -------------------- | ------------------------------------------------------- |
| `rect` / `roundrect` | `top`, `bottom`, `front`, `back`, `left`, `right`       |
| `triangle`           | `top`, `bottom`, `base`, `left`, `right`                |
| `circle`             | `top`, `bottom`, `curved`                               |
| `roundrect` / `slot` | `top`, `bottom`, `left_cap`, `right_cap`, `curved`      |
| `polygon`            | `top`, `bottom`, `face_0`, `face_1`... in winding order |

#### Edge References

```
base.top.edges                    // all edges of the top face
base.top.perimeter                // outer boundary edges only
base.edges                        // every edge on the complete object
base.perimeter                    // authored exterior boundary of the object
base                              // infers base.edges for fillet/chamfer targets
base.top.front_edge              // single named edge: front, back, left, right
base.top.front_edge.center       // midpoint of a named edge
base.bottom.edges
```

For a face with holes, these selectors are intentionally different:

| Selector             | Selected topology                        | `fill(...)` behavior                                     |
| -------------------- | ---------------------------------------- | -------------------------------------------------------- |
| `body.top`           | The complete face, including inner wires | Preserves the face and every hole.                       |
| `body.top.perimeter` | The outer boundary loop only             | Builds a face without the hole rims.                     |
| `body.top.edges`     | Every boundary edge, outer and inner     | Preserves all valid loops and their hole classification. |

Surface consumers do not silently widen an edge selector back to its parent
face. An edge set that is open, disconnected, self-intersecting, or otherwise
cannot form the required surface produces a geometry diagnostic at the source
selector. Named edges select one authored profile edge; `.perimeter` selects
only the outer loop; `.edges` includes outer and inner loops.

At object scope, `@body.perimeter` is the distinct exterior boundary authored
by that object before later Boolean and detail operations. It works from the
object's topology rather than assuming a rectangular profile, so circular,
rounded, polygonal, custom `path(...)`, revolved, and other shapes retain their
real boundary edges. Hole rims, cut walls, fused-feature seams, and unrelated
later edges are excluded. `@body.edges` instead selects every distinct edge on
the current object, including hole rims and other interior topology. In
`fillet(...)` and `chamfer(...)`, a bare `@body` target is shorthand for
`@body.edges`.

#### Edge Intersection Selectors

Use `(edge1, edge2)` as the final segment of an `@object` reference to select
solid edges generated where two named sketch-edge sets cross:

```bushscad
sketch crossed =
    rect(60, 20) as horizontal +
    rect(20, 60) as vertical;
obj body = extrude(crossed, 8);

fillet(@body.(horizontal.top, vertical.right), 2);
```

Each operand may be a direct named edge or a qualified sketch component member.
The operands must be two different named edges belonging to the same object.
The result is an ordered edge collection, not a numeric point tuple. BushSCAD
intersects the exact authored topology memberships after Boolean and solid
construction, removes duplicate physical edges, and orders crossings by their
geometry. It does not infer intersections from rendered triangles.

If the named edge sets cross more than once, append a zero-based index to select
one result:

```bushscad
fillet(@body.(edge1, edge2)[0], 1); // first crossing only
fillet(@body.(edge1, edge2)[1], 1); // second crossing only
```

An omitted index selects every crossing. A missing crossing or an out-of-range
index is a geometry error at the selector. The form works anywhere an edge
selector is accepted, including fillet, chamfer, edge-derived placement/axes,
measurement, highlighting, navigation, and hover. In an `@` reference the
parentheses are selector syntax; ordinary expression `(x, y)` tuples retain
their existing point meaning.

Two previously declared edge-set aliases can also use the unscoped form:

```bushscad
@edge1 = @body.horizontal_top;
@edge2 = @body.vertical_right;
fillet(@(edge1, edge2)[0], 2);
```

Both aliases must resolve to the same modeled object.

#### Selector Consumer Compatibility

Selectors are checked at the operation that consumes them. `one` means the
expanded selector must produce exactly one target; `many` preserves source
order and removes duplicate topology identities.

| Consumer                        | Accepted selector topology                                                               | Cardinality                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------- |
| `fill`                          | closed sketch boundary, face, face `.perimeter`, face `.edges`, or one named closed edge | one                                          |
| placement (`from`, `at`, `pos`) | face, face point, named edge/intersection, or named corner                               | many where the surrounding operation repeats |
| sketch `on`                     | face only                                                                                | one                                          |
| `fillet`                        | object, face boundary, perimeter, edge set, named edge, or edge intersection             | many                                         |
| `chamfer`                       | fillet forms plus a named corner's incident edges                                        | many                                         |
| `draft`                         | face only                                                                                | many                                         |
| revolve/radial axis             | face-derived axis, face point axis, named edge, or edge-intersection axis                | one                                          |
| measurement query               | any selector supported by that query                                                     | query-specific                               |
| selection/highlight             | every selector form without topology coercion                                            | many                                         |

Invalid topology is reported at the final selector segment. Singular consumers
also reject zero or multiple wildcard, group, array, or selector-variable
results; they never silently choose the first result.

```bushscad
surface bad_corner = fill(body.top.front_left); // error: corner is not a loop
surface bad_many = fill(@body.[top, bottom]);   // error: fill requires one target
draft(@body.top.edges, 2deg);                     // error: draft requires faces
```

```bushscad
obj plate = extrude(rect(80, 50), 6);
obj hole = cut(circle(16), through, @plate.top.center);

surface with_hole = fill(plate.top);
surface outer_only = fill(plate.top.perimeter);
surface all_loops = fill(plate.top.edges);
```

#### Array Selectors

Any `@`-anchored face, edge, point, or placement reference slot can use array
selectors. BushSCAD expands the selector left-to-right as a Cartesian product
and emits the same command once for each concrete reference.

```
fillet([@body.bottom.edges, @body.top.edges], 2);
fillet(@[body1, body2].[top, bottom].edges, 2);
fillet([@body1, @body2].[top, bottom], 2);
```

The leading `@` is required. Bare selector syntax such as
`body.[top, bottom].edges` is invalid.

Wildcard selectors use `*` as an `@`-anchored reference segment. The wildcard
expands to every known valid continuation at that point, then filters by the
rest of the reference chain.

```
fillet(@body.*.edges, 0.5);          // edges on every known face of body
fillet(@body.*.top.edges, 0.5);      // top edges of every valid child under body
fillet(@[body1, body2].*.edges, 1);  // arrays and wildcards compose
fillet(@pocket[1].*.edges, 0.25);    // indexes can select one generated object
```

The leading `@` is also required for wildcards. Bare syntax such as
`body.*.edges` is invalid.

Selector arrays can also be stored in variables and reused in any operation
that accepts an `@` placement or target. Bare directional words inside such a
variable are selector names.

```
var sides = [top, bottom];
obj body = extrude(rect(30, 20), 4);
obj pocket = cut(circle(4), 1, @body.sides(10, 10));
fillet(@body.sides.edges, 0.25);

var caps = [@body.top, @body.bottom];
chamfer(@caps.edges, 0.5);
```

When an expanded selector is used in an `obj` declaration, the first generated
operation keeps the declared name and later operations receive generated names.
For example, `obj pocket = cut(hole, 1, @[body1, body2].top);` emits `pocket`
for the first cut and a generated name such as `pocket_0` for the second.
The declaration also stores the generated objects as an ordered array. Later
unindexed references such as `@pocket.edges` expand across every generated
object in order, while indexed references such as `@pocket[1].edges` select one
generated object.

Expanded members retain their authored member ranges. Duplicate concrete
targets are removed by stable topology identity after expansion, without
changing the left-to-right order of the remaining targets.

A singular positional selector (`center`, a named edge point, or any named
corner) remains one semantic value even when a geometry operation splits its owning face into
multiple rendered triangle ranges. Those physical ranges are not language
array members and never add `[0]`, `[1]`, ... to the hover. Separate objects
created by an array expansion remain separate values and use their authored
instance paths, for example `pocket[0].top.corner.front_right` and
`pocket[1].top.corner.front_right`.

```
obj pocket = cut(hole, 1, @body.[top, bottom]);
fillet(@pocket.edges, 0.25);     // affects both generated pockets
chamfer(@pocket[1].edges, 0.1);  // affects only the second generated pocket
shell(pocket, 0.5);               // object-level ops also affect all pockets
shell(pocket[1], 0.5);            // object-level ops can select one item
```

#### Point References

```
base.top.center                   // centroid of face
base.top.front_left       // named corners:
base.top.front_right      //   front_left, front_right,
base.top.back_left        //   back_left,  back_right
base.top.back_right
```

#### Default Anchor Behaviour

When a bare face reference is used as a placement target without an explicit corner or offset, the default anchor depends on face shape:

| Face shape       | Default anchor                         |
| ---------------- | -------------------------------------- |
| Rectangular face | Back-left corner - `back_left`         |
| Circular face    | Centre point                           |
| Cylindrical side | Centre of the curved face at 0 degrees |

For rectangular top and bottom faces, a bare whole-face placement such as `@base.top(x: 10, y: 10)` uses the `back_left` corner as its origin. Positive `x` moves toward the right side. Positive `y` moves toward the front/bottom edge, so increasing both values walks across the face toward `front_right`.

Explicit corner anchors keep their named-corner origin. For example, `@base.top.front_left(x: 8, y: 8)` moves from the front-left corner toward the inside of the face, while `@base.top.back_right(x: -8, y: -8)` moves inward from the back-right corner.

#### Inner & Outer Surface Qualifiers

After a `shell` operation, faces split into inner and outer surfaces. Use the `inner` / `outer` qualifier to reach the correct one. Without qualifier, `outer` is assumed for backward compatibility.

```
shell(body, 2, top);

// Outer surfaces (default)
fillet(@body.outer.top.edges, 1);
fillet(@body.outer.front.edges, 1);

// Inner surfaces
fillet(@body.inner.bottom.edges, 0.5);
obj label = cut(label, 1, @body.inner.front.center);

// No qualifier - outer assumed
fillet(@body.top.edges, 1);
```

#### Chained References

```
base.top.front_edge.center
base.top.front_left

// Reference geometry on placed sub-components
assembly.bracket.body.top.center

// Cross-part references (referenced part must be declared before current part)
partA.top.front_edge.center
```

When the root identifier is a `part` name, directional references such as
`partA.top`, `partA.bottom`, or `partA.front` resolve against the finished
part envelope. They describe the visible outer extent of that completed part,
including any components or bodies already placed into it. They do not project
inward to recover an earlier internal face. If a later part needs a specific
construction surface inside another part, expose that surface with a tagged
reference once tags are available.

#### Tagged References

```
obj base = extrude(profile, 10) {
    @top_face = @body.top;
    @front_edge = @body.top.front_edge;
    @inner_floor = @body.inner.bottom;
}

obj hole = cut(hole, through base, @top_face.center);
fillet(@front_edge, 2);
```

Tags declared inside an `obj` block are resolved relative to that object. In the
example above, `top_face` is a project-global alias for `base.top`, and
`front_edge` is a project-global alias for `base.top.front_edge`. Tags may also
be declared outside an object block when the target is already fully qualified:

```
@mount_face = @base.top;
```

Tagged references are global across the project after declaration. They can be
used anywhere a face, edge, or point reference is accepted, and they can be
passed through function parameters:

```
fn drill(target, d) {
    sketch hole = circle(d);
    return {
        obj hole = cut(hole, 2, @target.center),
    }
}

place(drill(top_face, 3), @top_face.center);
```

### Planes

Planes define sketch surfaces independent of extruded geometry. A named plane can be passed anywhere a face reference appears. A plane sets placement; it does not add a solid.

#### Named Plane Declaration

```
// plane <name> = offset(<value>, @<face>)
plane top_ref = offset(0, @base.top);      // coincident with top face
plane above   = offset(10, @base.top);     // 10mm above top face
plane below   = offset(-3, @base.top);     // 3mm below top face
plane inset_f = offset(5, @base.front);    // 5mm behind front face
```

#### Chaining Named Planes

```
plane base_level = offset(0, @base.top);
plane mid_level  = offset(15, @base_level);
plane top_level  = offset(15, @mid_level);

sketch tier1 = rect(60, 40);
obj tier1 = extrude(tier1, 5, @base_level);

sketch tier2 = rect(50, 30);
obj tier2 = extrude(tier2, 5, @mid_level);

sketch tier3 = rect(40, 20);
obj tier3 = extrude(tier3, 5, @top_level);
```

#### Using Named Planes in Sketches

```
plane work = offset(10, @base.top);

sketch lid = rect(60, 40);
obj lid = extrude(lid, 3, @work);

sketch cut_profile = circle(5);
obj bore = cut(cut_profile, through lid, @work);
```

#### Inline Anonymous Planes

```
sketch label = word('TOP', size: 6, font: 'sans', align: center,
    @plane(base.top, offset: 0));

obj label = cut(label, 0.8, @plane(base.top, offset: 0));

// Inline plane on a side face
sketch port = rect(10, 6, @plane(base.front, offset: 0));
```

### Positional Placement - `@`

`@` places a feature at an offset from a named anchor. It replaces raw coordinate math and keeps placement tied to semantic geometry.

#### Offset from a Face Anchor

```
obj boss = extrude(boss, 8, @base.top(x: 10, y: 10));
obj hole = cut(hole, through base, @base.top.front_left(x: 5, y: 5));
obj slot = cut(slot, 3, @base.top.front_edge(offset: 8));
```

On rectangular top/bottom faces, `@base.top(x: 10, y: 10)` starts from `back_left`, with positive `x` toward `right` and positive `y` toward `front`. Use explicit corners when the offset is naturally measured from a different corner.

#### Offset from Centre

```
obj pipe = extrude(pipe, 20, @base.top.center(x: 15, y: -5));
```

#### Radial Offset

```
// Place at radius 20mm from centre, at a given angle
obj hole = cut(hole, through base, @base.top.center(radius: 20, angle: 45deg));
```

#### Named Anchor Shortcuts

```
// These are equivalent
@base.top.center
@base.top.center(x: 0, y: 0)
```

### The `this.` Context

`this.` refers to the face or plane a sketch is currently being drawn on. It resolves at placement time, not definition time - so if the parent geometry changes, `this.` values update automatically.

#### Available `this.` Properties

| Property      | Description                          |
| ------------- | ------------------------------------ |
| `this.width`  | Full width of the current face       |
| `this.height` | Full height of the current face      |
| `this.center` | Centre point of the current face     |
| `this.area`   | Face area - useful in conditionals   |
| `this.normal` | Outward normal direction of the face |

#### Usage in Sketches

```
sketch lid   = rect(this.width, this.height);
sketch lid   = rect(this.width - 10, this.height - 10);
sketch panel = rect(this.width * 0.8, this.height * 0.6);

// Word sketch adapting to face width
sketch label = word('TOP', size: this.width * 0.1, font: 'sans', align: center);
```

#### Inset Shorthand

```
sketch lid = rect inset(10);           // same as rect(this.width-20, this.height-20)
sketch lid = rect inset(x: 5, y: 10); // asymmetric inset
```

#### `this.` in Components

```
part cover {
    sketch face = rect(this.width - 4, this.height - 4);
    obj face = extrude(face, 2);
}

part plate {
    sketch base = rect(60, 40);
    obj base = extrude(base, 10);
    place(cover, @base.top.center);  // this. inside cover = base.top
}
```

### Spatial Anchor Aliases

A spatial anchor alias names a placement reference. It can define a component's default placement source, add a named source anchor, or override a built-in alias without mutating geometry.

#### Default Anchor Alias

`@name = @target` defines the default source anchor for the component named `name`. If no default alias exists, placement keeps the current no-custom-anchor behavior.

```
part bracket {
    sketch body = rect(40, 20);
    obj body = extrude(body, 5);
}

part assembly {
    sketch base = rect(100, 80);
    obj base = extrude(base, 10);
    place(bracket, @base.top.center);
}
```

#### Declaring a Default Anchor

Declare `@component = @target` inside the component to define the source anchor used by `place(component, @target)`.

```
part bracket {
    sketch body = rect(40, 20);
    obj body = extrude(body, 5);
    @bracket = @body.bottom.front_left;
}
```

#### Multiple Named Anchors

```
part bracket {
    sketch body = rect(40, 20);
    obj body = extrude(body, 5);
    @mount = @body.bottom.front_left;
    @wire_exit = @body.top.back_edge.center;
    @center = @body.bottom.center;
}
```

#### Using a Named Anchor When Placing

```
part assembly {
    sketch base = rect(100, 80);
    obj base = extrude(base, 10);

    // uses default anchor (body.bottom.center)
    place(bracket, @base.top.front_left(x: 5, y: 5));

    // explicit named anchor
    place(bracket, @base.top.back_right(x: -5, y: -5), @mount);
}
```

#### Anchor Points with `this.`

```
part clip {
    sketch body = rect(this.width, 8);
    obj body = extrude(body, 3);
    @clip = @body.bottom.front_edge.center;   // snaps to front edge of target face
}
```

### `rotate()`

`rotate()` rotates geometry around an axis. Two forms: placement-time (snap and rotate when placing) and standalone post-placement rotation.

#### Placement-time rotate

Add `rotate(...)` to a placement to turn the component before its anchor snaps to the target. Use one angle for the placement-plane normal, an axis keyword, or three axis angles.

```bushscad
place(tab, @hub.center) rotate(15deg);
place(tab, @hub.center) rotate(z: 45deg);
place(tab, @hub.center) rotate(0deg, 45deg, 15deg);
```

`rotateX`, `rotateY`, and `rotateZ` are shorthand for world-axis rotation.

#### Standalone (post-placement) rotate

Rotates a named object or the latest placed instance of a component after placement.

```
// Rotate around a world axis
rotate base 5deg around x;
rotate base 10deg around y;
rotate hub  15deg around z;

// Rotate around a tagged face axis (point on a surface)
rotate hub 22.5deg around base_top.center;

// Rotate targeting the latest placed instance of a component
rotate rotor_tab 12deg around hub_top.center;
```

When the target is a component name (not an `obj` name), the rotation applies to the most recently placed instance of that component.

Note: post-placement rotation may detach geometry from named surfaces. Tag faces before rotation for stable downstream references.

### Tagged Face References

```
obj base = extrude(profile, 10) {
    @top_face = @body.top;
    @front_edge = @body.top.front_edge;
    @inner_floor = @body.inner.bottom;
}

obj hole = cut(hole, through base, @top_face.center);
fillet(@front_edge, 2);
```

Object-block `@` anchors are project-global aliases. An anchor name can be passed into a
function parameter and then extended inside the function, such as
`target.center` or `target.edge(front)`.

### Object Aliases and `as` Keyword

Two features for geometry reuse without duplication.

#### Functions as Objects

`obj` can bind the result of a function call directly:

```
fn my_cap() {
    sketch face = rect(40, 30);
    return { obj face = extrude(face, 3) }
}

obj cap = my_cap();          // geometry bound to name like any inline obj
fillet(@cap.top.edges, 1);    // normal face references work on the result
```

#### `place â€¦ as` Aliasing

`place(source, @target) as alias` places a component and binds that specific instance to a name. Downstream operations on the alias target only that instance. References to the source name continue to resolve to the original definition.

```
place(bolt, @base.top(x: 10, y: 10)) as bolt_a;
place(bolt, @base.top(x: 30, y: 10)) as bolt_b;

rotate bolt_a 45 around Z;    // only bolt_a rotates
fillet(@bolt_b.top, 1);         // only bolt_b's top face
```

Each `as` name must be unique in scope. Top-level aliases bind ungrouped placed
instances just like aliases inside a component or `fn` body.

### Patterns and Transforms

Core duplication, symmetry, and post-build transformation tools.

#### Linear Pattern

```
// Repeat along one axis
pattern(bolt, linear, 4, 12);

// Repeat along two axes
pattern(target: rib, mode: linear, x: 3, y: 2, spacing: (20, 15));
```

The target (`bolt`, `rib`) must be an `obj`, alias, placed instance, ref instance, or anchor. Each generated instance gets a stable generated name (`bolt_0`, `bolt_1`, â€¦) for downstream references. Use `as` aliasing when targeting individual instances.

The linear positional order is `pattern(target, linear, x_count, spacing, y_count?)`.
Use `spacing: (x, y)` or `spacingX:` / `spacingY:` when the two axes differ.

#### Radial Pattern

```
// Evenly distribute around a center point
pattern(fin, radial, 8, base.top.center);

// Fully named form
pattern(target: tab, mode: radial, count: 4, around: hub.top.center);
```

The radial positional order is `pattern(target, radial, count, around)`.

#### Mirror

```
mirror(bracket, plane(center));
mirror(bracket, base.front);
mirror(target: lid, across: X);   // world-axis shorthand
```

`plane(center)` resolves to a plane through the target object's bounding-box center. Named planes, face references, and inline `plane()` calls are all valid `across` targets. The mirrored instance is a distinct solid with correct normals and orientation.

#### Transform

```
transform(boss, translate(10, y: 5));
transform(boss, translate(x: 10, y: 5, z: 2));
transform(target: boss, operation: rotate(angle: 45deg, around: z));
transform(boss, scale(1.05));          // non-manufacturing / visual only unless opts in
```

`scale` is visual-only unless the project opts into geometry scaling. Translation and rotation change the modeled geometry.

## Parts and Assemblies
### Assembly & Placing Components

Components are instantiated into an assembly using `place`. Each placed instance gets its own resolved `this.` binding and anchor point context.

#### Basic Placement

```
part assembly {
    sketch base = rect(100, 80);
    obj base = extrude(base, 15);
    place(bracket, @base.top.front_left);
    place(bracket, @base.top.front_right);
    place(bracket, @base.top.back_left);
    place(bracket, @base.top.back_right);
}
```

#### Placement with Offset and Anchor

```
place(bracket, @base.top.front_left(x: 5, y: 5));
place(bracket, @base.top.back_right(x: -5, y: -5), @mount);
```

#### Placement at World Origin

```
place(bracket);
place(bracket, @origin.top);
place(bracket, @origin.front(x: 12, y: -4));
place(bracket, @origin.left(20, 45deg));
```

When the target argument is omitted, `place` evaluates the component, function,
or ref at the world origin. Placement-time modifiers such as `rotate(...)` and
display features such as explode still apply.

Use `@origin.direction` to choose a work-origin orientation explicitly. The
direction may be `top`, `bottom`, `front`, `back`, `left`, or `right`. The
file-level `workplane = XY|XZ|YZ;` setting selects the frame for these
directions. Add optional Cartesian `x`/`y` offsets or polar `radius`/`angle`
offsets in that frame.

Polar spatial offsets also accept an unlabeled length and degree-marked angle,
such as `@origin.top(20, 45deg)` or `@base.top.center(20, 45deg)`. The `deg`
unit distinguishes this polar pair from the existing two-number Cartesian
form; ordinary `@target(x, y)` remains Cartesian.

`place(...)` is valid at top level and inside component, `part`, `ref`, and
function bodies. A top-level `place(name)` emits ungrouped output geometry.

#### Placing in a Loop

```
part assembly {
    sketch base = rect(100, 80);
    obj base = extrude(base, 15);
    for (i, j) in grid(cols: 2, rows: 2, spacing: 80) {
        place(bracket, @base.top.front_left(x: 5 + i, y: 5 + j));
    }
}
```

### Ref Parts

`ref name { ... }` defines a named geometry block that is **not rendered at declaration**. The block evaluates lazily - only when `name` is referenced in another context such as a `place`, boolean op, or cut target. At that point the block executes in the caller's placement context.

```
ref mounting_boss {
    sketch boss_profile = circle(d: 6);
    obj boss = extrude(boss_profile, 4);
    fillet(@boss.top, 0.5);
};

// Does not render at declaration.
// Renders here, in the context of base.top:
place(mounting_boss, @base.top(x: 10, y: 10));
place(mounting_boss, @base.top(x: 30, y: 10));  // independent instance
```

The same `ref` can be instantiated multiple times with independent geometry and unique instance names. Body errors surface at the instantiation site (with the declaration span as secondary context). Unused `ref` blocks emit no warning.

`ref name = extrude(...)` and other one-line ref object declarations are also
hidden at declaration. They define reusable source geometry and render only
when placed or otherwise consumed. If the source sketch contains a planted line,
`place(name)` and `place(name, @target)` use the generated side face matching
that planted line as the default source anchor. If no planted line is present
on a generated solid source, placement defaults to `name.bottom.center`.

`ref name = <object-op>;` defines a one-line hidden shape reference. It accepts the same object operation forms as `obj name = <object-op>;`, including `extrude`, `revolve`, `loft`, `sweep`, `thicken`, and cut forms. The shape is built and can be reused by name, but it is not displayed at the declaration site.

```
sketch punch_profile = rect(8, 16);
ref punch_tool = extrude(punch_profile, 14);

obj pocket = cut(punch_tool, @base.top.center);
```

Use `obj` when the shape should render immediately. Use one-line `ref` when the shape is a reusable construction/tool body.

### Assemblies and Joints

True assemblies with relationships, limits, and simple motion preview.

#### Joint Syntax

```
revolute hinge(@lid.hinge_axis, @housing.hinge_axis) {
    range = 0deg..120deg;
    default = 15deg;
}

slider drawer_slide(@drawer.rail, @case.rail) {
    range = 0mm..80mm;
    default = 0mm;
}
```

#### Joint Types

| Type       | Description                           |
| ---------- | ------------------------------------- |
| `fixed`    | No relative motion - rigid connection |
| `revolute` | Rotates around a shared axis          |
| `slider`   | Translates along a shared axis        |
| `planar`   | Slides in a plane                     |
| `ball`     | Full 3D rotation, no translation      |

The joint type begins the declaration: `fixed`, `revolute`, `slider`, `planar`, or `ball`. Its first argument is the moving reference and its second is the supporting reference. Both arguments use standard `@` spatial-reference syntax and resolve to compatible axes, points, faces, anchors, or tagged references. A moving side must belong to an independently declared part; geometry placed inside another part is built into that containing part and cannot move separately. The optional `range` is enforced in the viewport motion preview, and `default` sets its initial value. Revolute and ball values use angles; slider and planar values use lengths. Export metadata carries joint declarations even if the STEP export remains static.

## Validation and Fits

### Design Validation (`assert`)

Use assertions to check design requirements against geometry measurements after the model is built.

#### Syntax

```
// Error-level assertion - build fails if false
assert(wall_thickness(body) >= 1.6);
assert(clearance(lid, housing) >= 0.3);

// Warning-level assertion - build succeeds with warning
assert(wall_thickness(body) >= 2, warning: 'Wall is below the design target');
```

The positional order is `assert(condition, severity?, message?)`. Use
`warning: 'message'` for the common warning-level form, or `severity:` and
`message:` separately when the message is assembled later.

#### Geometry Query Functions

| Function              | Returns                                          |
| --------------------- | ------------------------------------------------ |
| `distance(a, b)`      | Minimum distance between two geometry references |
| `clearance(a, b)`     | Unsigned minimum distance, as with `distance`    |
| `bounding_box(obj)`   | Axis-aligned bounding-box volume in mmÂ³          |
| `face_area(ref)`      | Built-shape surface area in mmÂ²                  |
| `volume(obj)`         | Volume of a solid in mmÂ³                         |
| `wall_thickness(obj)` | Approximate minimum positive face separation     |

`face_area` resolves the root built shape and can therefore measure the whole
shape surface instead of only a qualified face. `wall_thickness` is an
approximation. Draft-angle and fillet-radius names are reserved but do not
provide geometry measurements; validate their authored parameters directly.

Failed assertions appear in the error panel with precise source spans. The last good mesh remains visible when validation fails; validation overlays show separately from compile errors.

Warning-level assertions (`warning: 'message'`) appear in the error panel prefixed with `[warning]`. The build succeeds and the mesh remains visible. Error-level assertions (the default) cause the build to report failure; the last good mesh stays visible until the assertion passes.

### Manufacturing Fits and Tolerances

Embed manufacturing intent so designs adapt to process, material, and machine assumptions.

#### Importing Process Profiles

Import a process profile with `use`. This sets the active tolerance table for all subsequent `fit` declarations in the same file scope.

```
use std.hardware.metric;
use std.printing.fdm;       // FDM/FFF 3D printing tolerances
use std.printing.resin;     // Resin/MSLA printing tolerances
use std.machining.cnc;      // CNC milling/turning tolerances
use std.cutting.laser;      // Laser cutting tolerances
```

If no profile is imported, `std.printing.fdm` is used as the default.

#### `env` Overrides for Tolerance

Override a specific fit's resolved offset at the project or workspace level:

```
env M3_bolt_clearance fallback 0.25;
```

The key format is `<fitName>_clearance`. This overrides the value resolved from the active process profile for that named fit.

#### Fit Declarations

```
fit(clearance, M3_bolt, through, mounting_hole);
fit(press, M3_insert, into, boss, tight);
```

Syntax: `fit(kind, fitName, through|into, targetName, tolerance?)`.
The default tolerance level is `normal`. Every positional slot also has a
keyword form: `kind:`, `name:`, `relation:`, `target:`, and `tolerance:`.

- `through` - the part passes through the target (clearance/slip context)
- `into` - the part goes into the target (press/interference context)

| Fit kind       | Description                          |
| -------------- | ------------------------------------ |
| `clearance`    | Part passes through freely           |
| `slip`         | Light clearance, slides without play |
| `press`        | Interference fit, requires force     |
| `interference` | Stronger press fit                   |
| `loose`        | Wide-tolerance clearance band        |
| `tight`        | Narrow-tolerance clearance band      |

| Tolerance level | Description                                |
| --------------- | ------------------------------------------ |
| `normal`        | Standard process capability                |
| `tight`         | Tighter-than-standard - higher cost/effort |
| `loose`         | Looser-than-standard - faster/cheaper      |

#### Resolved Tolerance Offsets (mm)

Offset applied to nominal dimension. Positive = hole grows (clearance). Negative = hole shrinks (interference).

**`std.printing.fdm`**

| Fit kind       | `normal` | `tight` | `loose` |
| -------------- | -------- | ------- | ------- |
| `clearance`    | +0.25    | +0.15   | +0.40   |
| `slip`         | +0.15    | +0.08   | +0.25   |
| `press`        | -0.10    | -0.05   | -0.15   |
| `interference` | -0.20    | -0.10   | -0.30   |
| `loose`        | +0.40    | +0.25   | +0.55   |
| `tight`        | +0.08    | +0.05   | +0.15   |

**`std.printing.resin`**

| Fit kind       | `normal` | `tight` | `loose` |
| -------------- | -------- | ------- | ------- |
| `clearance`    | +0.10    | +0.05   | +0.20   |
| `slip`         | +0.05    | +0.02   | +0.10   |
| `press`        | -0.05    | -0.02   | -0.10   |
| `interference` | -0.10    | -0.05   | -0.20   |
| `loose`        | +0.20    | +0.10   | +0.30   |
| `tight`        | +0.03    | +0.01   | +0.08   |

**`std.machining.cnc`**

| Fit kind       | `normal` | `tight` | `loose` |
| -------------- | -------- | ------- | ------- |
| `clearance`    | +0.05    | +0.02   | +0.10   |
| `slip`         | +0.02    | +0.01   | +0.05   |
| `press`        | -0.02    | -0.01   | -0.05   |
| `interference` | -0.05    | -0.02   | -0.10   |
| `loose`        | +0.10    | +0.05   | +0.20   |
| `tight`        | +0.01    | +0.005  | +0.03   |

**`std.cutting.laser`**

| Fit kind       | `normal` | `tight` | `loose` |
| -------------- | -------- | ------- | ------- |
| `clearance`    | +0.15    | +0.08   | +0.25   |
| `slip`         | +0.10    | +0.05   | +0.15   |
| `press`        | 0        | 0       | 0       |
| `interference` | 0        | 0       | 0       |
| `loose`        | +0.25    | +0.15   | +0.40   |
| `tight`        | +0.05    | +0.02   | +0.10   |

Press/interference fits are not applicable to laser cutting (0 = no offset applied).

#### `fit_ok()` in Assertions

Use `fit_ok(fitName, targetName)` inside an `assert` to verify geometry satisfies the declared fit intent:

```
assert(fit_ok(M3_bolt, mounting_hole), warning: 'clearance not met');
assert(fit_ok(M3_insert, boss));
```

`fit_ok()` checks the measured separation between built shapes against the offset from the active process profile. Clearance fits use `distance()`; press fits use `clearance()`. The check runs after geometry is built.

#### Combining Fits with Holes

```
use std.printing.fdm;

fit(clearance, M3_bolt, through, mounting_hole);
fit(press, M3_insert, into, boss, tight);

obj hole = hole(M3.clearance + printer_clearance, through base, @base.top.center);
assert(fit_ok(M3_bolt, mounting_hole), warning: 'clearance not satisfied');
```

#### Tolerance Provenance

Each fit declaration uses the resolved offset and process profile selected for the project. See the fit tables above for the current process and fit values.

## Import and Export

### Import & Export

Use `import` and `export` to reuse values, functions, components, and geometry across files. Circular imports are errors.

#### Exporting from a File

```
// hardware.bscd
export var wall_default = 2;

export fn bolt_hole(d, depth: 5) {
    sketch hole = circle(d);
    obj hole = cut(hole, depth, @base.top);
}

export part bracket {
    sketch body = rect(40, 20);
    obj body = extrude(body, 5);
    @bracket = @body.bottom.front_left;
    fillet(@body.top.edges, 1);
    chamfer(@body.bottom.edges, 0.5);
}

part gusset { ... }   // file-private - not accessible to importers
```

#### Import Forms

```
import './hardware.bscd';                                  // all exports
import { bracket, bolt_hole } from './hardware.bscd';      // named
import { bracket as hw_bracket } from './hardware.bscd';   // aliased
import * as hw from './hardware.bscd';                     // namespaced
import shape base = './vendor/base.step';                    // STEP/STP shape
import shape insert = './vendor/insert.stl';                 // STL mesh shape
```

Imported shapes are reusable source geometry. They can be placed directly with
`place(name)` or wrapped in `ref name extends imported_name { ... }` when the
source needs healing, defeaturing, or custom anchors before placement.

Exports wrap declarations such as `var`, `fn`, `part`, `ref`, `sketch`,
`surface`, and `obj`. To publish an imported design under another name, declare
an exported wrapper; JavaScript-style `export { name } from ...` syntax is not a
BushSCAD export form.

Exported geometry declarations keep their normal display and output behavior:
`export part` creates a named output part and `export obj` contributes visible
geometry. To publish reusable geometry without showing or exporting it at the
declaration site, export a `ref` instead.

#### Import Resolution Order

```
1. Parse all import statements at top of file
2. Load and parse each imported file (recursive)
3. Detect and error on circular dependencies
4. Merge exported symbols into importing file's scope
5. Proceed with normal scope resolution and evaluation
```

### Drawing and DXF Export

Fabrication-oriented 2D output for laser cutting, machining references, quick drawings, and documentation.

#### Syntax

```
drawing plate_sheet {
    view base.top scale: 1;
    dimension base.width;
    dimension hole.center to base.left;
    dimension hole.center to base.back;
    export dxf './exports/plate.dxf';
}
```

#### View Directions

`top`, `bottom`, `front`, `back`, `left`, or `right`. A drawing contains exactly
one axis-aligned view.

#### Dimension Types

```
dimension base.width;                        // overall dimension
dimension hole.center to base.left;         // point-to-edge distance
dimension base.top.front_edge.length;      // edge length
dimension base.top.front_left to base.top.back_right;  // diagonal
```

#### Export Formats

| Format | Use case               |
| ------ | ---------------------- |
| `dxf`  | Laser cutting, CNC     |
| `svg`  | Preview, documentation |

Drawing outputs can also be driven from `bushscad.json` defaults via the `export` key.

## VS Code Parallel and Cached Compilation

The VS Code extension can compile independent model parts and safe component
recipes in parallel. BushSCAD first parses and resolves the source, evaluates
loops and conditionals into concrete operations, then builds a dependency graph
to find work that can run independently. A bounded worker pool builds those
tasks concurrently and assembles their results in source order. Operations with
dependencies that cannot be transferred safely remain in the ordered build.

### Cache Breakpoints

Cache breakpoints are a VS Code editor feature; they do not add syntax to a
`.bscd` file and are not a CLI option. Right-click a source line and choose
**BushSCAD: Toggle Cache Breakpoint** to add or remove a manual point. The
gutter marker and the line's code lens show assigned points. Choose **BushSCAD:
Set Cache Breakpoint Condition** to attach an optional condition.

Conditions support scalar values visible at the operation, including loop
bindings, with numeric arithmetic, comparisons, Boolean `&&` and `||`, `!`, and
parentheses. For example, `i == 2 && width > 5` selects the third unrolled
iteration when `i` starts at zero. The compiler evaluates the condition against
each concrete loop operation. Missing values, unsupported syntax, and invalid
conditions do not select a manual component cache point.

When **Automatically assign cache breakpoints** is enabled in the model settings
drawer or VS Code settings, the compiler marks safe component recipes and
completed independent parts automatically. The extension displays those points
in the source gutter. A manual point takes precedence on its line, so its
condition selects which unrolled loop instances receive that component cache
point. With automatic assignment disabled, manual points can still select safe
component recipes. An unchanged completed part can also be reused as a whole
build result when its exact compilation inputs match.

Automatic markers distinguish these cache states by location. A component
recipe marker sits on the source operation that produces that component. A
completed-part marker sits at the end of the part block, after all of its
operations, including geometry placed later through an imported function. This
keeps the marker aligned with the complete cached result rather than an earlier
component inside it.

The extension stores BRep checkpoints and completed mesh results as temporary
files in its local session cache. It reads them from disk on demand and removes
the session cache when VS Code shuts down. A cache hit changes compilation time
only: source semantics, operation order, and output geometry remain the same.
The classic engine and ordinary CLI use do not receive the VS Code cache.

## Examples

### Model Examples

#### Mounting Plate

Start with a profile, extrude it, and cut two through-holes.

```bushscad
sketch profile = rect(60, 40);
obj plate = extrude(profile, 6);

obj left_hole = cut(circle(3), through plate, @plate.top.front_left(x: 10, y: 20));
obj right_hole = cut(circle(3), through plate, @plate.top.front_right(x: -10, y: 20));
```

#### Parametric Panel

Use environment values to change the hole size or row count without editing
the model.

```bushscad
env hole_diameter fallback 3;
env hole_rows fallback 2;

sketch profile = rect(80, 50);
obj panel = extrude(profile, 6);
for (i, j) in grid(cols: 3, rows: hole_rows, spacing: 16) {
    obj hole = cut(circle(hole_diameter), through panel,
        @panel.top.front_left(x: 10 + i, y: 8 + j));
}
```

#### Two-Part Assembly

A later part can use a face reference from an earlier part.

```bushscad
part base {
    sketch profile = rect(80, 60);
    obj body = extrude(profile, 6);
}

part lid {
    sketch profile = rect(80, 60);
    obj body = extrude(profile, 3, @base.top.center);
}
```
