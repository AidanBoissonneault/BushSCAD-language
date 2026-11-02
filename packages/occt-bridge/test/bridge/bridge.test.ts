/**
 * @author Aidan Boissonneault
 * @file bridge.test.ts
 * @purpose Tests bridge behavior in the bridge in OpenCascade bridge package.
 * @last-edited October 6, 2026
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportNameForPartGroup,
  partitionByPart,
  parseFaceRef,
} from '../../src/core/program-utils.js';
import { FaceLabelMap } from '../../src/topology/face-labels.js';
import type { FaceFrame } from '../../src/topology/face-labels.js';
import {
  OCCT_FALLBACK_FONT_PATH,
  OCCT_FALLBACK_MONO_FONT_PATH,
  OCCT_FALLBACK_SERIF_FONT_PATH,
  OcctBridge,
} from '../../src/index.js';
import {
  buildSurfaceFillOperation,
  buildSurfaceOffsetOperation,
  buildSurfaceThickenOperation,
} from '../../src/surfaces/surfaces.js';
import {
  applyStableBoolCut,
  applyStableBoolFuse,
} from '../../src/operations/boolean-operations.js';
import type { GroupBuildState } from '../../src/bridge/bridge-types.js';
import type {
  IROp,
  IRSketch,
  IRExtrude,
  IRCut,
  IRSolidCut,
  IRRevolve,
  IRLoft,
  IRFillet,
  IRChamfer,
  IRShell,
  IRDraft,
  IRRotate,
  IRPartBoundary,
  IRProgram,
  Workplane,
} from '@bushscad/ir';

// ── Helpers ───────────────────────────────────────────────────────────────────

const SPAN = { file: 'test.bscd', line: 1, col: 1 };

/**
 * Constructs sketch from the supplied values.
 */
function makeSketch(name: string, w = 10, h = 10): IRSketch {
  return {
    kind: 'sketch',
    name,
    primitive: { kind: 'rect', width: w, height: h },
    placement: null,
    span: SPAN,
  };
}

/**
 * Constructs extrude from the supplied values.
 */
function makeExtrude(
  objName: string,
  sketchName: string,
  depth = 5,
): IRExtrude {
  return {
    kind: 'extrude',
    objName,
    sketchName,
    depth,
    from: null,
    symmetric: false,
    wrap: false,
    span: SPAN,
  };
}

/**
 * Constructs cut from the supplied values.
 */
function makeCut(
  objName: string,
  sketchName: string,
  faceRef: string,
  depth: number | null = null,
): IRCut {
  return {
    kind: 'cut',
    objName,
    sketchName,
    through: depth === null,
    depth,
    from: { faceRef },
    wrap: false,
    span: SPAN,
  };
}

/**
 * Constructs profile sketch from the supplied values.
 */
function makeProfileSketch(name: string, closed = true): IRSketch {
  const segments = closed
    ? [
        {
          kind: 'line' as const,
          name: 'a',
          from: [0, 0] as [number, number],
          to: [10, 0] as [number, number],
        },
        {
          kind: 'arc' as const,
          name: 'lip',
          from: [10, 0] as [number, number],
          to: [10, 5] as [number, number],
          radius: 5,
          clockwise: true,
        },
        {
          kind: 'line' as const,
          name: 'c',
          from: [10, 5] as [number, number],
          to: [0, 5] as [number, number],
        },
        {
          kind: 'line' as const,
          name: 'd',
          from: [0, 5] as [number, number],
          to: [0, 0] as [number, number],
        },
      ]
    : [
        {
          kind: 'line' as const,
          name: 'path',
          from: [0, 0] as [number, number],
          to: [0, 10] as [number, number],
        },
      ];
  return {
    kind: 'sketch',
    name,
    primitive: { kind: 'profile', segments },
    placement: null,
    span: SPAN,
  };
}

/**
 * Constructs fillet from the supplied values.
 */
function makeFillet(target: string, radius = 1): IRFillet {
  return { kind: 'fillet', target, radius, span: SPAN };
}

/**
 * Constructs chamfer from the supplied values.
 */
function makeChamfer(target: string, offset = 0.5): IRChamfer {
  return { kind: 'chamfer', target, offset, span: SPAN };
}

/**
 * Constructs shell from the supplied values.
 */
function makeShell(
  objName: string,
  thickness = 2,
  openFaces = ['top'],
): IRShell {
  return { kind: 'shell', objName, thickness, openFaces, span: SPAN };
}

/**
 * Constructs draft from the supplied values.
 */
function makeDraft(target: string, angleDeg = 1.5): IRDraft {
  return { kind: 'draft', target, angleDeg, span: SPAN };
}

/**
 * Constructs rotate from the supplied values.
 */
function makeRotate(target: string, angleDeg = 90): IRRotate {
  return { kind: 'rotate', target, angleDeg, around: 'z', span: SPAN };
}

/**
 * Constructs part from the supplied values.
 */
function makePart(name: string, color: string | null = null): IRPartBoundary {
  return { kind: 'part', name, color, span: SPAN };
}

// ── parseFaceRef ──────────────────────────────────────────────────────────────

describe('parseFaceRef', () => {
  it('parses simple top face', () => {
    const r = parseFaceRef('base.top');
    expect(r.objName).toBe('base');
    expect(r.face).toBe('top');
    expect(r.qualifier).toBeUndefined();
    expect(r.subRef).toBeUndefined();
  });

  it('parses bottom face', () => {
    const r = parseFaceRef('base.bottom');
    expect(r.face).toBe('bottom');
  });

  it('parses all six face directions', () => {
    for (const dir of [
      'top',
      'bottom',
      'front',
      'back',
      'left',
      'right',
    ] as const) {
      expect(parseFaceRef(`obj.${dir}`).face).toBe(dir);
    }
  });

  it('parses edges subRef', () => {
    const r = parseFaceRef('base.top.edges');
    expect(r.objName).toBe('base');
    expect(r.face).toBe('top');
    expect(r.subRef).toBe('edges');
  });

  it('parses center subRef', () => {
    const r = parseFaceRef('base.top.center');
    expect(r.subRef).toBe('center');
  });

  it('parses perimeter subRef', () => {
    const r = parseFaceRef('body.top.perimeter');
    expect(r.subRef).toBe('perimeter');
  });

  it('parses object-wide edges', () => {
    const r = parseFaceRef('gusset_3.edges');
    expect(r.objName).toBe('gusset_3');
    expect(r.face).toBeUndefined();
    expect(r.subRef).toBe('edges');
  });

  it('parses M19 named profile faces and curved surface refs', () => {
    const named = parseFaceRef('vase.face.lip.edges');
    expect(named.objName).toBe('vase');
    expect(named.namedFace).toBe('lip');
    expect(named.subRef).toBe('edges');

    const curved = parseFaceRef('vase.curved');
    expect(curved.objName).toBe('vase');
    expect(curved.curved).toBe(true);
    expect(curved.face).toBeUndefined();
  });

  it('parses named face edge refs', () => {
    const r = parseFaceRef('lid.top.edge.front');
    expect(r.objName).toBe('lid');
    expect(r.face).toBe('top');
    expect(r.subRef).toBe('edge');
    expect(r.edgeArg).toBe('front');
  });

  it('parses corner subRef with arg', () => {
    const r = parseFaceRef('base.top.corner.front_left');
    expect(r.subRef).toBe('corner');
    expect(r.cornerArg).toBe('front_left');
  });

  it('parses outer qualifier', () => {
    const r = parseFaceRef('body.outer.top');
    expect(r.qualifier).toBe('outer');
    expect(r.face).toBe('top');
  });

  it('parses inner qualifier', () => {
    const r = parseFaceRef('body.inner.bottom');
    expect(r.qualifier).toBe('inner');
    expect(r.face).toBe('bottom');
  });

  it('parses side(front) → serialized as side.front → face=front', () => {
    const r = parseFaceRef('body.outer.side.front.center');
    expect(r.qualifier).toBe('outer');
    expect(r.face).toBe('front');
    expect(r.subRef).toBe('center');
  });

  it('parses side.back', () => {
    const r = parseFaceRef('box.side.back');
    expect(r.face).toBe('back');
  });

  it('parses object name only', () => {
    const r = parseFaceRef('myObj');
    expect(r.objName).toBe('myObj');
    expect(r.face).toBeUndefined();
  });

  it('extracts target object name from complex refs', () => {
    expect(parseFaceRef('base.top.corner.front_left').objName).toBe('base');
    expect(parseFaceRef('body.outer.side.front').objName).toBe('body');
    expect(parseFaceRef('enclosure.inner.bottom.edges').objName).toBe(
      'enclosure',
    );
  });
});

// ── partitionByPart ───────────────────────────────────────────────────────────

describe('partitionByPart', () => {
  it('no part boundaries → single default group', () => {
    const ops: IROp[] = [makeSketch('s'), makeExtrude('obj', 's')];
    const groups = partitionByPart(ops);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('__default__');
    expect(groups[0].ops).toHaveLength(2);
  });

  it('single part boundary → one named group', () => {
    const ops: IROp[] = [
      makePart('plate', '#2563EB'),
      makeSketch('s'),
      makeExtrude('obj', 's'),
    ];
    const groups = partitionByPart(ops);
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('plate');
    expect(groups[0].color).toBe('#2563EB');
    expect(groups[0].ops).toHaveLength(2);
  });

  it('two part boundaries → two groups in order', () => {
    const ops: IROp[] = [
      makePart('base'),
      makeSketch('b'),
      makeExtrude('bObj', 'b'),
      makePart('lid', '#7C3AED'),
      makeSketch('l'),
      makeExtrude('lObj', 'l'),
    ];
    const groups = partitionByPart(ops);
    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBe('base');
    expect(groups[1].name).toBe('lid');
    expect(groups[1].color).toBe('#7C3AED');
  });

  it('part boundary with null color', () => {
    const ops: IROp[] = [
      makePart('p', null),
      makeSketch('s'),
      makeExtrude('o', 's'),
    ];
    expect(partitionByPart(ops)[0].color).toBeNull();
  });

  it('empty ops → empty groups', () => {
    expect(partitionByPart([])).toHaveLength(0);
  });

  it('part boundary with no following ops is dropped', () => {
    const ops: IROp[] = [makePart('empty')];
    expect(partitionByPart(ops)).toHaveLength(0);
  });

  it('intermediate empty part is dropped (e.g. all ops suppressed)', () => {
    const ops: IROp[] = [
      makePart('a'),
      makeSketch('s'),
      makeExtrude('aObj', 's'),
      makePart('empty'),
      makePart('b'),
      makeSketch('t'),
      makeExtrude('bObj', 't'),
    ];
    const groups = partitionByPart(ops);
    expect(groups.map((g) => g.name)).toEqual(['a', 'b']);
  });

  it('part boundary ops are excluded from group ops', () => {
    const ops: IROp[] = [makePart('p'), makeSketch('s'), makeExtrude('o', 's')];
    const group = partitionByPart(ops)[0];
    expect(group.ops.every((op) => (op as IROp).kind !== 'part')).toBe(true);
  });
});

describe('exportNameForPartGroup', () => {
  it('uses output for a single ungrouped export', () => {
    expect(exportNameForPartGroup('__default__', false)).toBe('output');
  });

  it('uses output_main for ungrouped geometry exported alongside parts', () => {
    expect(exportNameForPartGroup('__default__', true)).toBe('output_main');
  });

  it('uses part names for explicit part exports', () => {
    expect(exportNameForPartGroup('housing', true)).toBe('housing');
  });
});

// ── Mock OC module ────────────────────────────────────────────────────────────
// Minimal mock of the OpenCASCADE.js API for testing bridge logic.
// Shapes are plain objects with a delete() no-op.

let shapeId = 0;
/**
 * Creates a test double for shape.
 */
function mockShape(tag?: string): object {
  const id = shapeId++;
  return {
    _id: id,
    _tag: tag,
    delete: vi.fn(),
    IsNull: () => false,
    Located: vi.fn().mockReturnThis(),
    Orientation: vi.fn().mockReturnValue('TopAbs_FORWARD'),
    Orientation_1: vi.fn().mockReturnValue('TopAbs_FORWARD'),
    IsSame: vi.fn((other: { _id?: number }) => other?._id === id),
    IsEqual: vi.fn((other: { _id?: number }) => other?._id === id),
  };
}

/**
 * Creates a test double for pnt.
 */
function mockPnt(x = 0, y = 0, z = 0) {
  return {
    X: () => x,
    Y: () => y,
    Z: () => z,
    delete: vi.fn(),
    Transform: vi.fn(),
  };
}

/**
 * Creates a test double for dir.
 */
function mockDir(nx = 0, ny = 0, nz = 1) {
  return { X: () => nx, Y: () => ny, Z: () => nz, delete: vi.fn() };
}

/**
 * Creates a test double for dir values.
 */
function mockDirValues(
  dir: ReturnType<typeof mockDir>,
): [number, number, number] {
  return [dir.X(), dir.Y(), dir.Z()];
}

/**
 * Builds the axis data required by the current operation.
 */
function axisCallMatchesDirections(
  call: unknown[],
  z: [number, number, number],
  x: [number, number, number],
): boolean {
  const [, zDir, xDir] = call as [
    unknown,
    ReturnType<typeof mockDir>,
    ReturnType<typeof mockDir>,
  ];
  return (
    `${mockDirValues(zDir)}` === `${z}` && `${mockDirValues(xDir)}` === `${x}`
  );
}

/**
 * Creates a test double for axis system.
 */
function mockAx2() {
  return mockAx2With();
}

/**
 * Creates a test double for axis system with.
 */
function mockAx2With(
  location = mockPnt(),
  direction = mockDir(0, 0, 1),
  xDirection = mockDir(1, 0, 0),
) {
  const yDirection = mockDir(
    direction.Y() * xDirection.Z() - direction.Z() * xDirection.Y(),
    direction.Z() * xDirection.X() - direction.X() * xDirection.Z(),
    direction.X() * xDirection.Y() - direction.Y() * xDirection.X(),
  );
  return {
    Direction: vi.fn().mockReturnValue(direction),
    XDirection: vi.fn().mockReturnValue(xDirection),
    YDirection: vi.fn().mockReturnValue(yDirection),
    Location: vi.fn().mockReturnValue(location),
    delete: vi.fn(),
  };
}

/**
 * Creates a test double for utf8.
 */
function mockUtf8(value: string, length: number) {
  return { _value: value, _length: length, delete: vi.fn() };
}

/**
 * Creates a test double for enum.
 */
function mockEnum<T extends Record<string, unknown>>(values: T): T {
  return Object.assign(function enumCtor() {}, values) as unknown as T;
}

/**
 * Creates a test double for constructor.
 */
function mockConstructor<Args extends unknown[], Result>(
  factory: (...args: Args) => Result,
): ReturnType<typeof vi.fn> {
  return vi.fn(function (this: unknown, ...args: Args) {
    return factory(...args);
  }) as ReturnType<typeof vi.fn>;
}

/**
 * Constructs mock oc from the supplied values.
 */
function makeMockOC() {
  const mockFace = mockShape('face');
  const mockWire = mockShape('wire');
  const mockEdge = mockShape('edge');
  let prismCount = 0;

  /**
   * Builds maker from the supplied inputs.
   */
  const buildMaker = (isDone = true, shape = mockShape()) => ({
    IsDone: () => isDone,
    Shape: () => shape,
    Face: () => mockFace,
    Wire: () => mockWire,
    Edge: () => mockEdge,
    Add_1: vi.fn(),
    Add_2: vi.fn(),
    Build: vi.fn(),
    Build_1: vi.fn(),
    delete: vi.fn(),
  });

  // Explorer dispatches by shape type: face explorer yields mockFace, edge explorer yields mockEdge.
  // This lets classifyFaces classify one "top" face and getFaceEdges find one edge per call.
  const TOPABS_FACE = 4;
  /**
   * Constructs explorer from the supplied values.
   */
  function makeExplorer(
    shape: { _faces?: unknown[]; _edges?: unknown[] } | undefined,
    shapeType: number,
  ) {
    const items =
      shapeType === TOPABS_FACE
        ? (shape?._faces ?? [mockFace])
        : (shape?._edges ?? [mockEdge]);
    let index = 0;
    return {
      More: () => index < items.length,
      Next: vi.fn(() => {
        index++;
      }),
      Current: () => items[index],
      delete: vi.fn(),
    };
  }

  const oc = {
    TopAbs_ShapeEnum: { TopAbs_FACE: 4, TopAbs_EDGE: 6, TopAbs_SHAPE: 0 },
    TopAbs_Orientation: { TopAbs_REVERSED: 1 },
    BOPAlgo_GlueEnum: { BOPAlgo_GlueShift: 'BOPAlgo_GlueShift' },
    ChFi3d_FilletShape: { ChFi3d_Rational: 'ChFi3d_Rational' },
    BRepOffset_Mode: { BRepOffset_Skin: 'BRepOffset_Skin' },
    GeomAbs_JoinType: { GeomAbs_Arc: 'GeomAbs_Arc' },
    Graphic3d_HorizontalTextAlignment: mockEnum({
      Graphic3d_HTA_LEFT: { _enum: 'Graphic3d_HTA_LEFT' },
      Graphic3d_HTA_CENTER: { _enum: 'Graphic3d_HTA_CENTER' },
      Graphic3d_HTA_RIGHT: { _enum: 'Graphic3d_HTA_RIGHT' },
    }),
    Graphic3d_VerticalTextAlignment: mockEnum({
      Graphic3d_VTA_CENTER: { _enum: 'Graphic3d_VTA_CENTER' },
    }),

    gp_Pnt_1: mockConstructor(() => mockPnt()),
    gp_Pnt_3: mockConstructor((x: number, y: number, z: number) =>
      mockPnt(x, y, z),
    ),
    gp_Dir_1: mockConstructor(() => mockDir()),
    gp_Dir_4: mockConstructor((x: number, y: number, z: number) =>
      mockDir(x, y, z),
    ),
    gp_Vec_1: mockConstructor(() => ({ ...mockDir(), delete: vi.fn() })),
    gp_Vec_4: mockConstructor(() => ({ delete: vi.fn() })),
    gp_Ax2_2: mockConstructor(
      (
        loc?: ReturnType<typeof mockPnt>,
        dir?: ReturnType<typeof mockDir>,
        xDir?: ReturnType<typeof mockDir>,
      ) => mockAx2With(loc, dir, xDir),
    ),
    gp_Ax2_3: mockConstructor(mockAx2),
    gp_Ax1_2: mockConstructor(() => ({ delete: vi.fn() })),
    gp_Ax3_2: mockConstructor(() => ({ delete: vi.fn() })),
    gp_Ax3_3: mockConstructor(() => ({ delete: vi.fn() })),
    gp_Circ_2: mockConstructor(() => ({ delete: vi.fn() })),
    gp_Pln_3: mockConstructor(() => ({ delete: vi.fn() })),
    gp_Trsf_1: mockConstructor(() => ({
      SetTranslation_1: vi.fn(),
      SetTransformation_1: vi.fn(),
      SetTransformation_2: vi.fn(),
      SetDisplacement: vi.fn(),
      SetRotation_1: vi.fn(),
      Invert: vi.fn(),
      delete: vi.fn(),
    })),
    Message_ProgressRange_1: mockConstructor(() => ({ delete: vi.fn() })),
    NCollection_Utf8String_4: mockConstructor(mockUtf8),

    BRepBuilderAPI_MakeEdge_3: mockConstructor(() => buildMaker()),
    BRepBuilderAPI_MakeEdge_8: mockConstructor(() => buildMaker()),
    BRepBuilderAPI_MakeEdge_9: mockConstructor(() => buildMaker()),
    BRepBuilderAPI_MakeEdge_24: mockConstructor(() => buildMaker()),
    BRepBuilderAPI_MakeWire_1: mockConstructor(() => buildMaker()),
    BRepBuilderAPI_MakeWire_2: mockConstructor(() => buildMaker()),
    BRepBuilderAPI_MakeFace_15: mockConstructor(() => buildMaker()),
    BRepBuilderAPI_Transform_2: mockConstructor(() => ({
      IsDone: () => true,
      Shape: () => mockShape('trsf-face'),
      delete: vi.fn(),
    })),
    BRepBuilderAPI_Copy_2: mockConstructor((shape: unknown) => ({
      Shape: () => ({ ...(shape as object), _tag: 'ref-copy' }),
      delete: vi.fn(),
    })),
    IFSelect_ReturnStatus: { IFSelect_RetDone: 1 },
    STEPControl_Reader_1: mockConstructor(() => ({
      ReadFile: vi.fn().mockReturnValue(1),
      TransferRoots: vi.fn(),
      OneShape: vi.fn().mockReturnValue(mockShape('imported-step')),
      delete: vi.fn(),
    })),
    TopoDS_Compound: mockConstructor(() => mockShape('compound')),
    BRep_Builder: mockConstructor(() => ({
      MakeCompound: vi.fn(),
      Add: vi.fn(),
      delete: vi.fn(),
    })),
    StdPrs_BRepFont_1: mockConstructor(() => ({
      Init_1: vi.fn().mockReturnValue(true),
      Init_2: vi.fn().mockReturnValue(true),
      delete: vi.fn(),
    })),
    StdPrs_BRepTextBuilder: mockConstructor(() => ({
      Perform_2: vi.fn().mockReturnValue(mockShape('text')),
      delete: vi.fn(),
    })),

    BRepPrimAPI_MakePrism_1: mockConstructor(() =>
      buildMaker(true, mockShape(`prism-${prismCount++}`)),
    ),
    BRepPrimAPI_MakeRevol_1: mockConstructor(() =>
      buildMaker(true, mockShape('revolve-result')),
    ),
    BRepOffsetAPI_ThruSections: mockConstructor(() => ({
      AddWire: vi.fn(),
      CheckCompatibility: vi.fn(),
      Build: vi.fn(),
      IsDone: () => true,
      Shape: () => mockShape('loft-result'),
      delete: vi.fn(),
    })),
    BRepFill_PipeShell: mockConstructor(() => ({
      Add_1: vi.fn(),
      Add_2: vi.fn(),
      Build: vi.fn(),
      MakeSolid: vi.fn(),
      IsDone: () => true,
      Shape: () => mockShape('guided-loft-result'),
      delete: vi.fn(),
    })),
    BRepAdaptor_Surface: mockConstructor(() => ({
      GetType: () => 1,
      delete: vi.fn(),
    })),
    GeomAbs_SurfaceType: { GeomAbs_Cylinder: 1 },
    BRepAlgoAPI_Cut_3: mockConstructor(() =>
      buildMaker(true, mockShape('cut-result')),
    ),
    BRepAlgoAPI_Fuse_3: mockConstructor(() =>
      buildMaker(true, mockShape('fuse-result')),
    ),
    BRepCheck_Analyzer: mockConstructor(() => ({
      IsValid: () => true,
      delete: vi.fn(),
    })),
    ShapeFix_Shape_2: mockConstructor(() => ({
      SetPrecision: vi.fn(),
      SetMinTolerance: vi.fn(),
      SetMaxTolerance: vi.fn(),
      Perform: vi.fn(),
      Shape: () => mockShape('healed-shape'),
      delete: vi.fn(),
    })),
    BRepFilletAPI_MakeFillet: mockConstructor(() =>
      buildMaker(true, mockShape('fillet-result')),
    ),
    BRepFilletAPI_MakeChamfer: mockConstructor(() =>
      buildMaker(true, mockShape('chamfer-result')),
    ),
    BRepOffsetAPI_MakeThickSolid_1: mockConstructor(() => ({
      MakeThickSolidByJoin: vi.fn(),
      Build: vi.fn(),
      Build_1: vi.fn(),
      IsDone: () => true,
      Shape: () => mockShape('shell-result'),
      delete: vi.fn(),
    })),
    BRepOffsetAPI_DraftAngle_1: mockConstructor(() => ({
      Add: vi.fn(),
      Build: vi.fn(),
      Build_1: vi.fn(),
      IsDone: () => true,
      Shape: () => mockShape('draft-result'),
      delete: vi.fn(),
    })),
    BRepOffsetAPI_DraftAngle_2: mockConstructor(() => ({
      Add: vi.fn(),
      Build: vi.fn(),
      Build_1: vi.fn(),
      IsDone: () => true,
      Shape: () => mockShape('draft-result'),
      delete: vi.fn(),
    })),

    BRepMesh_IncrementalMesh_2: mockConstructor(() => ({
      Perform_1: vi.fn(),
      delete: vi.fn(),
    })),

    TopExp: {
      FirstVertex: vi.fn((edge: { _first?: unknown }) => edge._first),
      LastVertex: vi.fn((edge: { _last?: unknown }) => edge._last),
    },
    TopExp_Explorer_2: mockConstructor((shape: unknown, shapeType: number) =>
      makeExplorer(
        shape as { _faces?: unknown[]; _edges?: unknown[] },
        shapeType,
      ),
    ),
    TopLoc_Location_1: mockConstructor(() => ({
      IsIdentity: () => true,
      Transformation: vi.fn(),
      delete: vi.fn(),
    })),
    TopLoc_Location_2: mockConstructor(() => ({ delete: vi.fn() })),

    TopoDS: {
      Face_1: vi.fn((shape: unknown) => shape),
      Edge_1: vi.fn((shape: unknown) => shape),
      Wire_1: vi.fn((shape: unknown) => shape),
    },
    BRep_Tool: {
      Triangulation: vi.fn().mockReturnValue({ IsNull: () => true }),
      Pnt: vi.fn((vertex: { _point?: unknown }) => vertex._point),
    },
    BRepBndLib: {
      Add: vi.fn(
        (
          shape: {
            _bbox?: {
              xMin: number;
              yMin: number;
              zMin: number;
              xMax: number;
              yMax: number;
              zMax: number;
            };
          },
          bbox: { _source?: unknown },
        ) => {
          bbox._source = shape;
        },
      ),
    },
    BRepGProp: {
      SurfaceProperties_1: vi.fn(
        (face: { _center?: unknown }, gprops: { _centre?: unknown }) => {
          gprops._centre = face._center ?? mockPnt();
        },
      ),
    },
    GProp_GProps_1: mockConstructor(() => ({
      _centre: mockPnt(),
      /**
       * Handles centre of mass in the bridge flow.
       */
      CentreOfMass() {
        return this._centre;
      },
      delete: vi.fn(),
    })),
    BRepGProp_Face_2: mockConstructor(() => ({
      Bounds: vi
        .fn()
        .mockImplementation(
          (
            uMin: { current: number },
            uMax: { current: number },
            vMin: { current: number },
            vMax: { current: number },
          ) => {
            uMin.current = 0;
            uMax.current = 1;
            vMin.current = 0;
            vMax.current = 1;
          },
        ),
      Normal: vi.fn().mockImplementation(function (
        this: unknown,
        _u: number,
        _v: number,
        _p: unknown,
        v: { X: () => number; Y: () => number; Z: () => number },
      ) {
        Object.assign(v, mockDir(0, 0, 1));
      }),
      delete: vi.fn(),
    })),
    Bnd_Box_1: mockConstructor(() => ({
      _source: undefined,
      Get: vi.fn().mockImplementation(function (
        this: {
          _source?: {
            _bbox?: {
              xMin: number;
              yMin: number;
              zMin: number;
              xMax: number;
              yMax: number;
              zMax: number;
            };
          };
        },
        xMin: { current: number },
        yMin: { current: number },
        zMin: { current: number },
        xMax: { current: number },
        yMax: { current: number },
        zMax: { current: number },
      ) {
        const bbox = this._source?._bbox ?? {
          xMin: 0,
          yMin: 0,
          zMin: 0,
          xMax: 10,
          yMax: 10,
          zMax: 10,
        };
        xMin.current = bbox.xMin;
        yMin.current = bbox.yMin;
        zMin.current = bbox.zMin;
        xMax.current = bbox.xMax;
        yMax.current = bbox.yMax;
        zMax.current = bbox.zMax;
      }),
      delete: vi.fn(),
    })),
    TopTools_ListOfShape_1: mockConstructor(() => ({
      Append_1: vi.fn(),
      delete: vi.fn(),
    })),
    FS: {
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
      unlink: vi.fn(),
    },
  };

  return oc;
}

// ── FaceLabelMap tests ────────────────────────────────────────────────────────

describe('FaceLabelMap', () => {
  let oc: ReturnType<typeof makeMockOC>;
  let labelMap: FaceLabelMap;

  beforeEach(() => {
    oc = makeMockOC();
    labelMap = new FaceLabelMap();
  });

  it('hasShape returns false before registration', () => {
    expect(labelMap.hasShape('base')).toBe(false);
  });

  it('hasShape returns true after registration', () => {
    labelMap.register(oc, 'base', mockShape());
    expect(labelMap.hasShape('base')).toBe(true);
  });

  it('getShape returns registered shape', () => {
    const shape = mockShape();
    labelMap.register(oc, 'base', shape);
    expect(labelMap.getShape('base')).toBe(shape);
  });

  it('getShape returns undefined for unknown name', () => {
    expect(labelMap.getShape('unknown')).toBeUndefined();
  });

  it('register overwrites previous shape', () => {
    const s1 = mockShape();
    const s2 = mockShape();
    labelMap.register(oc, 'obj', s1);
    labelMap.register(oc, 'obj', s2);
    expect(labelMap.getShape('obj')).toBe(s2);
  });

  it('resolveEdges returns empty array for unknown object', () => {
    expect(labelMap.resolveEdges(oc, 'unknown.top.edges')).toEqual([]);
  });

  it('resolves registered M19 named profile face edges', () => {
    const edge = mockShape('lip-edge');
    labelMap.register(oc, 'vase', mockShape());
    labelMap.registerNamedFaceEdges('vase', 'lip', [edge]);
    expect(labelMap.resolveEdges(oc, 'vase.face.lip.edges')).toEqual([edge]);
  });

  it('resolveAxis returns default axis for unknown object', () => {
    const ax2 = labelMap.resolveAxis(oc, { faceRef: 'unknown.top' });
    expect(ax2).toBeDefined();
    expect(oc.gp_Ax2_2).toHaveBeenCalled();
  });

  it('resolveAxis defaults unqualified inner aliases to inner faces', () => {
    useNormalAwareFaceClassifier(oc);
    const outsideBottom = {
      ...mockShape('outside-bottom'),
      _center: mockPnt(0, 0, 0),
      _normal: [0, 0, -1] as [number, number, number],
    };
    const pocketFloor = {
      ...mockShape('pocket-floor'),
      _center: mockPnt(0, 0, 5),
      _normal: [0, 0, 1] as [number, number, number],
    };
    const shape = {
      ...mockShape('cut-body'),
      _bbox: { xMin: -5, yMin: -5, zMin: 0, xMax: 5, yMax: 5, zMax: 20 },
      _faces: [outsideBottom, pocketFloor],
    };
    labelMap.register(oc, 'pocket', shape, 'inner');

    labelMap.resolveAxis(oc, { faceRef: 'pocket.bottom.center' });

    const [origin, zDir] = oc.gp_Ax2_2.mock.calls.at(-1) as [
      ReturnType<typeof mockPnt>,
      ReturnType<typeof mockDir>,
      ReturnType<typeof mockDir>,
    ];
    expect(origin.Z()).toBe(5);
    expect(
      mockDirValues(zDir).map((value) => (Object.is(value, -0) ? 0 : value)),
    ).toEqual([0, 0, 1]);
  });

  it('uses anchor metadata to offset side-mounted placements differently from bottom mounts', () => {
    useNormalAwareFaceClassifier(oc);
    const top = {
      ...mockShape('top'),
      _center: mockPnt(5, 5, 10),
      _normal: [0, 0, 1] as [number, number, number],
    };
    labelMap.register(oc, 'base', {
      ...mockShape('base'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [top],
    });

    const bottom = labelMap.resolveAxis(oc, {
      faceRef: 'base.top.center',
      anchor: {
        ref: 'arm.bottom.center',
        localPoint: [0, 0, 0],
        localNormal: [0, 0, -1],
      },
    }) as ReturnType<typeof mockAx2>;
    const side = labelMap.resolveAxis(oc, {
      faceRef: 'base.top.center',
      anchor: {
        ref: 'arm.left',
        localPoint: [-5, 0, 2.5],
        localNormal: [-1, 0, 0],
      },
    }) as ReturnType<typeof mockAx2>;

    const bottomLoc = bottom.Location();
    const sideLoc = side.Location();
    expect([bottomLoc.X(), bottomLoc.Y(), bottomLoc.Z()]).not.toEqual([
      sideLoc.X(),
      sideLoc.Y(),
      sideLoc.Z(),
    ]);
  });

  it('orients side anchor normals opposite the target face normal', () => {
    useNormalAwareFaceClassifier(oc);
    const top = {
      ...mockShape('top'),
      _center: mockPnt(5, 5, 10),
      _normal: [0, 0, 1] as [number, number, number],
    };
    labelMap.register(oc, 'base', {
      ...mockShape('base'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [top],
    });

    const axis = labelMap.resolveAxis(oc, {
      faceRef: 'base.top.center',
      anchor: {
        ref: 'arm.left',
        localPoint: [-5, 0, 2.5],
        localNormal: [-1, 0, 0],
      },
    }) as ReturnType<typeof mockAx2>;
    const x = axis.XDirection();
    const worldAnchorNormal = [-x.X(), -x.Y(), -x.Z()];
    expect(worldAnchorNormal[0]).toBeCloseTo(0);
    expect(worldAnchorNormal[1]).toBeCloseTo(0);
    expect(worldAnchorNormal[2]).toBeCloseTo(-1);
  });

  it('applies placement axis rotations around local x, y, and z axes', () => {
    useNormalAwareFaceClassifier(oc);
    const top = {
      ...mockShape('top'),
      _center: mockPnt(5, 5, 10),
      _normal: [0, 0, 1] as [number, number, number],
    };
    labelMap.register(oc, 'base', {
      ...mockShape('base'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [top],
    });

    const rotateX = labelMap.resolveAxis(oc, {
      faceRef: 'base.top.center',
      axisRotationDeg: { x: 90 },
    }) as ReturnType<typeof mockAx2>;
    const xZ = rotateX.Direction();
    expect(xZ.X()).toBeCloseTo(0);
    expect(xZ.Y()).toBeCloseTo(-1);
    expect(xZ.Z()).toBeCloseTo(0);

    const rotateY = labelMap.resolveAxis(oc, {
      faceRef: 'base.top.center',
      axisRotationDeg: { y: 90 },
    }) as ReturnType<typeof mockAx2>;
    const yZ = rotateY.Direction();
    expect(yZ.X()).toBeCloseTo(1);
    expect(yZ.Y()).toBeCloseTo(0);
    expect(yZ.Z()).toBeCloseTo(0);

    const rotateZ = labelMap.resolveAxis(oc, {
      faceRef: 'base.top.center',
      axisRotationDeg: { z: 90 },
    }) as ReturnType<typeof mockAx2>;
    const zX = rotateZ.XDirection();
    expect(zX.X()).toBeCloseTo(0);
    expect(zX.Y()).toBeCloseTo(1);
    expect(zX.Z()).toBeCloseTo(0);
  });

  it('getFaceHandles returns empty for unknown object', () => {
    expect(labelMap.getFaceHandles('missing', 'top')).toEqual([]);
  });

  it('resolveEdges returns edges for a classified top face', () => {
    labelMap.register(oc, 'base', mockShape());
    const edges = labelMap.resolveEdges(oc, 'base.top.edges');
    expect(edges).toHaveLength(1);
  });

  it('keeps fused part edge selectors bounded to their source object region', () => {
    useNormalAwareFaceClassifier(oc);
    const baseEdge = {
      ...mockShape('base-edge'),
      _sourceName: 'base',
    };
    const bossEdge = {
      ...mockShape('boss-edge'),
      _sourceName: 'boss',
    };
    const fused = {
      ...mockShape('fused'),
      _bbox: { xMin: -30, yMin: -20, zMin: 0, xMax: 30, yMax: 20, zMax: 16 },
      _faces: [
        {
          ...mockShape('base-top'),
          _sourceName: 'base',
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(-15, 0, 10),
          _edges: [baseEdge],
        },
        {
          ...mockShape('boss-top'),
          _sourceName: 'boss',
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 16),
          _edges: [bossEdge],
        },
      ],
      _edges: [baseEdge, bossEdge],
    };
    const baseSource = {
      ...mockShape('base-source'),
      _bbox: { xMin: -30, yMin: -20, zMin: 0, xMax: 30, yMax: 20, zMax: 10 },
    };
    const bossSource = {
      ...mockShape('boss-source'),
      _bbox: { xMin: -6, yMin: -6, zMin: 10, xMax: 6, yMax: 6, zMax: 16 },
    };
    const labelMap = new FaceLabelMap();

    labelMap.register(oc, 'base', fused, 'outer', undefined, baseSource);
    labelMap.register(oc, 'boss', fused, 'outer', undefined, bossSource);

    expect(labelMap.resolveEdges(oc, 'base.top.edges')).toEqual([baseEdge]);
    expect(labelMap.resolveEdges(oc, 'boss.top.edges')).toEqual([bossEdge]);
  });

  it('resolves fused part placement anchors from the referenced source object region', () => {
    useNormalAwareFaceClassifier(oc);
    const fused = {
      ...mockShape('fused'),
      _bbox: { xMin: -30, yMin: -20, zMin: 0, xMax: 30, yMax: 20, zMax: 16 },
      _faces: [
        {
          ...mockShape('base-top'),
          _sourceName: 'base',
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 10),
          _edges: [mockShape('base-edge')],
        },
        {
          ...mockShape('boss-top'),
          _sourceName: 'boss',
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 16),
          _edges: [mockShape('boss-edge')],
        },
      ],
    };
    const baseSource = {
      ...mockShape('base-source'),
      _bbox: { xMin: -30, yMin: -20, zMin: 0, xMax: 30, yMax: 20, zMax: 10 },
    };
    const labelMap = new FaceLabelMap();

    labelMap.register(oc, 'base', fused, 'outer', undefined, baseSource);
    const ax2 = labelMap.resolveAxis(oc, { faceRef: 'base.top.center' }) as {
      Location(): { Z(): number };
    };

    expect(ax2.Location().Z()).toBe(10);
  });

  it('resolveEdges returns object-wide edges for obj.edges refs', () => {
    const edgeA = {
      ...mockShape('edge-a'),
      _first: { _point: mockPnt(0, 0, 0) },
      _last: { _point: mockPnt(10, 0, 0) },
    };
    const edgeB = {
      ...mockShape('edge-b'),
      _first: { _point: mockPnt(0, 0, 0) },
      _last: { _point: mockPnt(0, 10, 0) },
    };
    const shape = { ...mockShape('gusset'), _edges: [edgeA, edgeB] };

    labelMap.register(oc, 'gusset_3', shape);
    expect(labelMap.resolveEdges(oc, 'gusset_3.edges')).toEqual([edgeA, edgeB]);
  });

  it('resolveEdges supports side face directions', () => {
    oc.BRepGProp_Face_2 = mockConstructor(() => ({
      Bounds: vi
        .fn()
        .mockImplementation(
          (
            uMin: { current: number },
            uMax: { current: number },
            vMin: { current: number },
            vMax: { current: number },
          ) => {
            uMin.current = 0;
            uMax.current = 1;
            vMin.current = 0;
            vMax.current = 1;
          },
        ),
      Normal: vi
        .fn()
        .mockImplementation(
          (
            _u: number,
            _v: number,
            _p: unknown,
            v: { X: () => number; Y: () => number; Z: () => number },
          ) => {
            Object.assign(v, mockDir(0, -1, 0));
          },
        ),
      delete: vi.fn(),
    }));

    labelMap.register(oc, 'base', mockShape());
    const edges = labelMap.resolveEdges(oc, 'base.front.edges');
    expect(edges).toHaveLength(1);
  });

  it('resolves inner side refs to the same physical side as outer refs', () => {
    useNormalAwareFaceClassifier(oc);
    const outerFront = {
      ...mockShape('outer-front'),
      _center: mockPnt(5, 0, 5),
      _normal: [0, -1, 0] as [number, number, number],
    };
    const innerFront = {
      ...mockShape('inner-front'),
      _center: mockPnt(5, 2, 5),
      _normal: [0, 1, 0] as [number, number, number],
    };
    const outerBack = {
      ...mockShape('outer-back'),
      _center: mockPnt(5, 10, 5),
      _normal: [0, 1, 0] as [number, number, number],
    };
    const innerBack = {
      ...mockShape('inner-back'),
      _center: mockPnt(5, 8, 5),
      _normal: [0, -1, 0] as [number, number, number],
    };
    const outerLeft = {
      ...mockShape('outer-left'),
      _center: mockPnt(0, 5, 5),
      _normal: [-1, 0, 0] as [number, number, number],
    };
    const innerLeft = {
      ...mockShape('inner-left'),
      _center: mockPnt(2, 5, 5),
      _normal: [1, 0, 0] as [number, number, number],
    };
    const outerRight = {
      ...mockShape('outer-right'),
      _center: mockPnt(10, 5, 5),
      _normal: [1, 0, 0] as [number, number, number],
    };
    const innerRight = {
      ...mockShape('inner-right'),
      _center: mockPnt(8, 5, 5),
      _normal: [-1, 0, 0] as [number, number, number],
    };
    const outerTop = {
      ...mockShape('outer-top'),
      _center: mockPnt(5, 5, 10),
      _normal: [0, 0, 1] as [number, number, number],
    };
    const innerTop = {
      ...mockShape('inner-top'),
      _center: mockPnt(5, 5, 8),
      _normal: [0, 0, -1] as [number, number, number],
    };
    const outerBottom = {
      ...mockShape('outer-bottom'),
      _center: mockPnt(5, 5, 0),
      _normal: [0, 0, -1] as [number, number, number],
    };
    const innerBottom = {
      ...mockShape('inner-bottom'),
      _center: mockPnt(5, 5, 2),
      _normal: [0, 0, 1] as [number, number, number],
    };
    const shape = {
      ...mockShape('shell'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [
        outerFront,
        innerFront,
        outerBack,
        innerBack,
        outerLeft,
        innerLeft,
        outerRight,
        innerRight,
        outerTop,
        innerTop,
        outerBottom,
        innerBottom,
      ],
    };

    labelMap.register(oc, 'body', shape);
    const front = labelMap.resolveAxis(oc, {
      faceRef: 'body.inner.side.front.center',
    }) as ReturnType<typeof mockAx2>;
    const back = labelMap.resolveAxis(oc, {
      faceRef: 'body.inner.side.back.center',
    }) as ReturnType<typeof mockAx2>;
    const left = labelMap.resolveAxis(oc, {
      faceRef: 'body.inner.side.left.center',
    }) as ReturnType<typeof mockAx2>;
    const right = labelMap.resolveAxis(oc, {
      faceRef: 'body.inner.side.right.center',
    }) as ReturnType<typeof mockAx2>;
    const top = labelMap.resolveAxis(oc, {
      faceRef: 'body.inner.side.top.center',
    }) as ReturnType<typeof mockAx2>;
    const bottom = labelMap.resolveAxis(oc, {
      faceRef: 'body.inner.side.bottom.center',
    }) as ReturnType<typeof mockAx2>;

    expect(front.Location().Y()).toBe(2);
    expect(back.Location().Y()).toBe(8);
    expect(left.Location().X()).toBe(2);
    expect(right.Location().X()).toBe(8);
    expect(top.Location().Z()).toBe(8);
    expect(bottom.Location().Z()).toBe(2);
  });

  it('keeps face labels in the stored local frame after placement', () => {
    useNormalAwareFaceClassifier(oc);
    const frame: FaceFrame = {
      x: [1, 0, 0],
      y: [0, 0, 1],
      z: [0, -1, 0],
    };
    /**
     * Creates a local point value for the current operation.
     */
    const localPoint = ([x, y, z]: [number, number, number]) =>
      mockPnt(x, -z, y);
    /**
     * Creates a local vector value for the current operation.
     */
    const localVector = ([x, y, z]: [number, number, number]): [
      number,
      number,
      number,
    ] => [x, -z, y];
    /**
     * Resolves the face data required by the current selector.
     */
    const face = (
      tag: string,
      center: [number, number, number],
      normal: [number, number, number],
      edges: unknown[] = [],
    ) => ({
      ...mockShape(tag),
      _center: localPoint(center),
      _normal: localVector(normal),
      _edges: edges,
    });
    const frontTopEdge = {
      ...mockShape('local-top-front-edge'),
      _first: { _point: localPoint([0, 0, 10]) },
      _last: { _point: localPoint([10, 0, 10]) },
    };
    const backTopEdge = {
      ...mockShape('local-top-back-edge'),
      _first: { _point: localPoint([0, 10, 10]) },
      _last: { _point: localPoint([10, 10, 10]) },
    };
    const shape = {
      ...mockShape('placed-body'),
      _bbox: { xMin: 0, yMin: -10, zMin: 0, xMax: 10, yMax: 0, zMax: 10 },
      _faces: [
        face('top-face', [5, 5, 10], [0, 0, 1], [frontTopEdge, backTopEdge]),
        face('bottom-face', [5, 5, 0], [0, 0, -1]),
        face('front-face', [5, 0, 5], [0, -1, 0]),
        face('back-face', [5, 10, 5], [0, 1, 0]),
        face('left-face', [0, 5, 5], [-1, 0, 0]),
        face('right-face', [10, 5, 5], [1, 0, 0]),
      ],
      _edges: [frontTopEdge, backTopEdge],
    };

    labelMap.register(oc, 'body', shape, 'outer', frame);

    expect(labelMap.resolveEdges(oc, 'body.top.edges')).toEqual([
      frontTopEdge,
      backTopEdge,
    ]);
    expect(labelMap.resolveEdges(oc, 'body.top.edge.front')).toEqual([
      frontTopEdge,
    ]);

    const expected: Array<
      [string, [number, number, number], [number, number, number]]
    > = [
      ['top', [5, -10, 5], [0, -1, 0]],
      ['bottom', [5, 0, 5], [0, 1, 0]],
      ['front', [5, -5, 0], [0, 0, -1]],
      ['back', [5, -5, 10], [0, 0, 1]],
      ['left', [0, -5, 5], [-1, 0, 0]],
      ['right', [10, -5, 5], [1, 0, 0]],
    ];

    for (const [dir, location, normal] of expected) {
      const ax = labelMap.resolveAxis(oc, {
        faceRef: `body.${dir}.center`,
      }) as ReturnType<typeof mockAx2>;
      const loc = ax.Location();
      const axisDir = ax.Direction();
      expect([loc.X(), loc.Y(), loc.Z()]).toEqual(location);
      expect([axisDir.X(), axisDir.Y(), axisDir.Z()]).toEqual(normal);
    }

    const corner = labelMap.resolveAxis(oc, {
      faceRef: 'body.top.corner.front_left',
      offsetZ: 2,
    }) as ReturnType<typeof mockAx2>;
    const cornerLoc = corner.Location();
    expect([cornerLoc.X(), cornerLoc.Y(), cornerLoc.Z()]).toEqual([0, -12, 0]);
  });

  it('resolveEdges defaults to outer perimeter edges only', () => {
    // Face at z=10=zMax; outer edge at yMax=10, inner edge at y=8 (not at shape boundary).
    // The fix uses isShapePerimeterEdge (shape bounds) not isPerimeterEdge (face bounds),
    // so only the edge that lies on the shape outer boundary is returned.
    const outerEdge = {
      ...mockShape('outer-edge'),
      _first: { _point: mockPnt(0, 10, 10) },
      _last: { _point: mockPnt(10, 10, 10) },
    };
    const innerEdge = {
      ...mockShape('inner-edge'),
      _first: { _point: mockPnt(2, 8, 10) },
      _last: { _point: mockPnt(8, 8, 10) },
    };
    const topFace = {
      ...mockShape('top-face'),
      _center: mockPnt(5, 5, 10),
      _normal: [0, 0, 1] as [number, number, number],
      _bbox: { xMin: 0, yMin: 0, zMin: 10, xMax: 10, yMax: 10, zMax: 10 },
      _edges: [outerEdge, innerEdge],
    };
    const shape = {
      ...mockShape('shell'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [topFace],
      _edges: [outerEdge, innerEdge],
    };

    oc.BRepGProp_Face_2 = mockConstructor(
      (face: { _normal?: [number, number, number] }) => ({
        Bounds: vi
          .fn()
          .mockImplementation(
            (
              uMin: { current: number },
              uMax: { current: number },
              vMin: { current: number },
              vMax: { current: number },
            ) => {
              uMin.current = 0;
              uMax.current = 1;
              vMin.current = 0;
              vMax.current = 1;
            },
          ),
        Normal: vi
          .fn()
          .mockImplementation(
            (
              _u: number,
              _v: number,
              _p: unknown,
              v: { X: () => number; Y: () => number; Z: () => number },
            ) => {
              const [nx, ny, nz] = face._normal ?? [0, 0, 1];
              Object.assign(v, mockDir(nx, ny, nz));
            },
          ),
        delete: vi.fn(),
      }),
    );

    labelMap.register(oc, 'body', shape);
    const edges = labelMap.resolveEdges(oc, 'body.top.perimeter');
    expect(edges).toEqual([outerEdge]);
  });

  it('resolveEdges tolerates OCCT bbox gaps and dedupes repeated perimeter edge wrappers', () => {
    const outerEdge = {
      ...mockShape('outer-edge'),
      _first: { _point: mockPnt(-50, -40, 32) },
      _last: { _point: mockPnt(50, -40, 32) },
    };
    const outerEdgeDuplicate = { ...outerEdge };
    const innerEdge = {
      ...mockShape('inner-edge'),
      _first: { _point: mockPnt(-48, -38, 32) },
      _last: { _point: mockPnt(48, -38, 32) },
    };
    const topFace = {
      ...mockShape('top-face'),
      _center: mockPnt(0, 0, 32),
      _normal: [0, 0, 1] as [number, number, number],
      _bbox: { xMin: -50, yMin: -40, zMin: 32, xMax: 50, yMax: 40, zMax: 32 },
      _edges: [outerEdge, outerEdgeDuplicate, innerEdge],
    };
    const shape = {
      ...mockShape('shell'),
      _bbox: {
        xMin: -50.001,
        yMin: -40.001,
        zMin: -0.001,
        xMax: 50.001,
        yMax: 40.001,
        zMax: 32.001,
      },
      _faces: [topFace],
      _edges: [outerEdge, outerEdgeDuplicate, innerEdge],
    };

    oc.BRepGProp_Face_2 = mockConstructor(
      (face: { _normal?: [number, number, number] }) => ({
        Bounds: vi
          .fn()
          .mockImplementation(
            (
              uMin: { current: number },
              uMax: { current: number },
              vMin: { current: number },
              vMax: { current: number },
            ) => {
              uMin.current = 0;
              uMax.current = 1;
              vMin.current = 0;
              vMax.current = 1;
            },
          ),
        Normal: vi
          .fn()
          .mockImplementation(
            (
              _u: number,
              _v: number,
              _p: unknown,
              v: { X: () => number; Y: () => number; Z: () => number },
            ) => {
              const [nx, ny, nz] = face._normal ?? [0, 0, 1];
              Object.assign(v, mockDir(nx, ny, nz));
            },
          ),
        delete: vi.fn(),
      }),
    );

    labelMap.register(oc, 'body', shape);
    expect(labelMap.resolveEdges(oc, 'body.top.perimeter')).toEqual([
      outerEdge,
    ]);
  });

  it('resolveEdges tolerates floating error just beyond OCCT bbox gaps', () => {
    const outerEdge = {
      ...mockShape('outer-edge'),
      _first: { _point: mockPnt(-35, -25, 36) },
      _last: { _point: mockPnt(35, -25, 36) },
    };
    const topFace = {
      ...mockShape('top-face'),
      _center: mockPnt(0, 0, 36),
      _normal: [0, 0, 1] as [number, number, number],
      _bbox: { xMin: -35, yMin: -25, zMin: 36, xMax: 35, yMax: 25, zMax: 36 },
      _edges: [outerEdge],
    };
    const shape = {
      ...mockShape('shell'),
      _bbox: {
        xMin: -35.001,
        yMin: -25.001,
        zMin: -0.0010000000000000022,
        xMax: 35.001000000000005,
        yMax: 25.001,
        zMax: 36.001000000000005,
      },
      _faces: [topFace],
      _edges: [outerEdge],
    };

    oc.BRepGProp_Face_2 = mockConstructor(
      (face: { _normal?: [number, number, number] }) => ({
        Bounds: vi
          .fn()
          .mockImplementation(
            (
              uMin: { current: number },
              uMax: { current: number },
              vMin: { current: number },
              vMax: { current: number },
            ) => {
              uMin.current = 0;
              uMax.current = 1;
              vMin.current = 0;
              vMax.current = 1;
            },
          ),
        Normal: vi
          .fn()
          .mockImplementation(
            (
              _u: number,
              _v: number,
              _p: unknown,
              v: { X: () => number; Y: () => number; Z: () => number },
            ) => {
              const [nx, ny, nz] = face._normal ?? [0, 0, 1];
              Object.assign(v, mockDir(nx, ny, nz));
            },
          ),
        delete: vi.fn(),
      }),
    );

    labelMap.register(oc, 'body', shape);
    expect(labelMap.resolveEdges(oc, 'body.top.perimeter')).toEqual([
      outerEdge,
    ]);
  });

  it('resolveEdges selects a named edge on a face', () => {
    const frontEdge = {
      ...mockShape('front-edge'),
      _first: { _point: mockPnt(0, 0, 10) },
      _last: { _point: mockPnt(10, 0, 10) },
    };
    const backEdge = {
      ...mockShape('back-edge'),
      _first: { _point: mockPnt(0, 10, 10) },
      _last: { _point: mockPnt(10, 10, 10) },
    };
    const topFace = {
      ...mockShape('top-face'),
      _center: mockPnt(5, 5, 10),
      _normal: [0, 0, 1] as [number, number, number],
      _bbox: { xMin: 0, yMin: 0, zMin: 10, xMax: 10, yMax: 10, zMax: 10 },
      _edges: [frontEdge, backEdge],
    };
    const shape = {
      ...mockShape('lid'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [topFace],
      _edges: [frontEdge, backEdge],
    };

    oc.BRepGProp_Face_2 = mockConstructor(
      (face: { _normal?: [number, number, number] }) => ({
        Bounds: vi
          .fn()
          .mockImplementation(
            (
              uMin: { current: number },
              uMax: { current: number },
              vMin: { current: number },
              vMax: { current: number },
            ) => {
              uMin.current = 0;
              uMax.current = 1;
              vMin.current = 0;
              vMax.current = 1;
            },
          ),
        Normal: vi
          .fn()
          .mockImplementation(
            (
              _u: number,
              _v: number,
              _p: unknown,
              v: { X: () => number; Y: () => number; Z: () => number },
            ) => {
              const [nx, ny, nz] = face._normal ?? [0, 0, 1];
              Object.assign(v, mockDir(nx, ny, nz));
            },
          ),
        delete: vi.fn(),
      }),
    );

    labelMap.register(oc, 'lid', shape);
    expect(labelMap.resolveEdges(oc, 'lid.top.edge.front')).toEqual([
      frontEdge,
    ]);
  });

  it('resolveEdges includes all normal body face wires for .edges', () => {
    const outerEdge = {
      ...mockShape('outer-edge'),
      _first: { _point: mockPnt(0, 10, 10) },
      _last: { _point: mockPnt(10, 10, 10) },
    };
    const innerEdge = {
      ...mockShape('inner-edge'),
      _first: { _point: mockPnt(3, 5, 10) },
      _last: { _point: mockPnt(7, 5, 10) },
    };
    const topFace = {
      ...mockShape('top-face'),
      _center: mockPnt(5, 5, 10),
      _normal: [0, 0, 1] as [number, number, number],
      _bbox: { xMin: 0, yMin: 0, zMin: 10, xMax: 10, yMax: 10, zMax: 10 },
      _edges: [outerEdge, innerEdge],
    };
    const shape = {
      ...mockShape('body'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [topFace],
      _edges: [outerEdge, innerEdge],
    };

    oc.BRepGProp_Face_2 = mockConstructor(
      (face: { _normal?: [number, number, number] }) => ({
        Bounds: vi
          .fn()
          .mockImplementation(
            (
              uMin: { current: number },
              uMax: { current: number },
              vMin: { current: number },
              vMax: { current: number },
            ) => {
              uMin.current = 0;
              uMax.current = 1;
              vMin.current = 0;
              vMax.current = 1;
            },
          ),
        Normal: vi
          .fn()
          .mockImplementation(
            (
              _u: number,
              _v: number,
              _p: unknown,
              v: { X: () => number; Y: () => number; Z: () => number },
            ) => {
              const [nx, ny, nz] = face._normal ?? [0, 0, 1];
              Object.assign(v, mockDir(nx, ny, nz));
            },
          ),
        delete: vi.fn(),
      }),
    );

    labelMap.register(oc, 'body', shape);
    expect(labelMap.resolveEdges(oc, 'body.top.edges')).toEqual([
      outerEdge,
      innerEdge,
    ]);
    expect(labelMap.resolveEdges(oc, 'body.top.perimeter')).toEqual([
      outerEdge,
    ]);
  });

  it('resolveEdges keeps loop-cut top and bottom rims visible on base face selectors', () => {
    const topOuter = {
      ...mockShape('top-outer'),
      _first: { _point: mockPnt(0, 100, 8) },
      _last: { _point: mockPnt(120, 100, 8) },
    };
    const topHoleA = {
      ...mockShape('top-hole-a'),
      _first: { _point: mockPnt(16, 14, 8) },
      _last: { _point: mockPnt(18, 14, 8) },
    };
    const topHoleB = {
      ...mockShape('top-hole-b'),
      _first: { _point: mockPnt(42, 14, 8) },
      _last: { _point: mockPnt(44, 14, 8) },
    };
    const bottomOuter = {
      ...mockShape('bottom-outer'),
      _first: { _point: mockPnt(0, 0, 0) },
      _last: { _point: mockPnt(120, 0, 0) },
    };
    const bottomHole = {
      ...mockShape('bottom-hole'),
      _first: { _point: mockPnt(16, 14, 0) },
      _last: { _point: mockPnt(18, 14, 0) },
    };
    const topFace = {
      ...mockShape('top-face'),
      _center: mockPnt(60, 50, 8),
      _normal: [0, 0, 1] as [number, number, number],
      _edges: [topOuter, topHoleA, topHoleB],
    };
    const bottomFace = {
      ...mockShape('bottom-face'),
      _center: mockPnt(60, 50, 0),
      _normal: [0, 0, -1] as [number, number, number],
      _edges: [bottomOuter, bottomHole],
    };
    const shape = {
      ...mockShape('loop-panel'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 120, yMax: 100, zMax: 8 },
      _faces: [topFace, bottomFace],
      _edges: [topOuter, topHoleA, topHoleB, bottomOuter, bottomHole],
    };

    useNormalAwareFaceClassifier(oc);
    labelMap.register(oc, 'base', shape);

    expect(labelMap.resolveEdges(oc, 'base.top.edges')).toEqual([
      topOuter,
      topHoleA,
      topHoleB,
    ]);
    expect(labelMap.resolveEdges(oc, 'base.bottom.edges')).toEqual([
      bottomOuter,
      bottomHole,
    ]);
    expect(labelMap.resolveEdges(oc, 'base.top.perimeter')).toEqual([topOuter]);
  });

  it('resolveEdges keeps perimeter separate from fragmented face-local edges', () => {
    const outerEdge = {
      ...mockShape('outer-edge'),
      _first: { _point: mockPnt(0, 0, 0) },
      _last: { _point: mockPnt(10, 0, 0) },
    };
    const fragmentEdge = {
      ...mockShape('fragment-edge'),
      _first: { _point: mockPnt(3, 3, 0) },
      _last: { _point: mockPnt(7, 3, 0) },
    };
    const outerBottomFace = {
      ...mockShape('outer-bottom-face'),
      _center: mockPnt(5, 5, 0),
      _normal: [0, 0, -1] as [number, number, number],
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 0 },
      _edges: [outerEdge, fragmentEdge],
    };
    const smallBottomFace = {
      ...mockShape('small-bottom-face'),
      _center: mockPnt(5, 5, 0),
      _normal: [0, 0, -1] as [number, number, number],
      _bbox: { xMin: 3, yMin: 3, zMin: 0, xMax: 7, yMax: 7, zMax: 0 },
      _edges: [fragmentEdge],
    };
    const shape = {
      ...mockShape('fragmented-body'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [outerBottomFace, smallBottomFace],
      _edges: [outerEdge, fragmentEdge],
    };

    oc.BRepGProp_Face_2 = mockConstructor(
      (face: { _normal?: [number, number, number] }) => ({
        Bounds: vi
          .fn()
          .mockImplementation(
            (
              uMin: { current: number },
              uMax: { current: number },
              vMin: { current: number },
              vMax: { current: number },
            ) => {
              uMin.current = 0;
              uMax.current = 1;
              vMin.current = 0;
              vMax.current = 1;
            },
          ),
        Normal: vi
          .fn()
          .mockImplementation(
            (
              _u: number,
              _v: number,
              _p: unknown,
              v: { X: () => number; Y: () => number; Z: () => number },
            ) => {
              const [nx, ny, nz] = face._normal ?? [0, 0, 1];
              Object.assign(v, mockDir(nx, ny, nz));
            },
          ),
        delete: vi.fn(),
      }),
    );

    labelMap.register(oc, 'body', shape);
    expect(labelMap.resolveEdges(oc, 'body.bottom.edges')).toEqual([
      outerEdge,
      fragmentEdge,
    ]);
    expect(labelMap.resolveEdges(oc, 'body.bottom.perimeter')).toEqual([
      outerEdge,
    ]);
  });

  it('resolveEdges uses interior edges for cut aliases', () => {
    const outerEdge = {
      ...mockShape('outer-edge'),
      _first: { _point: mockPnt(0, 10, 10) },
      _last: { _point: mockPnt(10, 10, 10) },
    };
    const innerEdge = {
      ...mockShape('inner-edge'),
      _first: { _point: mockPnt(3, 5, 10) },
      _last: { _point: mockPnt(7, 5, 10) },
    };
    const topFace = {
      ...mockShape('top-face'),
      _center: mockPnt(5, 5, 10),
      _normal: [0, 0, 1] as [number, number, number],
      _bbox: { xMin: 0, yMin: 0, zMin: 10, xMax: 10, yMax: 10, zMax: 10 },
      _edges: [outerEdge, innerEdge],
    };
    const shape = {
      ...mockShape('cut-body'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [topFace],
      _edges: [outerEdge, innerEdge],
    };

    oc.BRepGProp_Face_2 = mockConstructor(
      (face: { _normal?: [number, number, number] }) => ({
        Bounds: vi
          .fn()
          .mockImplementation(
            (
              uMin: { current: number },
              uMax: { current: number },
              vMin: { current: number },
              vMax: { current: number },
            ) => {
              uMin.current = 0;
              uMax.current = 1;
              vMin.current = 0;
              vMax.current = 1;
            },
          ),
        Normal: vi
          .fn()
          .mockImplementation(
            (
              _u: number,
              _v: number,
              _p: unknown,
              v: { X: () => number; Y: () => number; Z: () => number },
            ) => {
              const [nx, ny, nz] = face._normal ?? [0, 0, 1];
              Object.assign(v, mockDir(nx, ny, nz));
            },
          ),
        delete: vi.fn(),
      }),
    );

    labelMap.register(oc, 'pocket', shape, 'inner');
    expect(labelMap.resolveEdges(oc, 'pocket.top.edges')).toEqual([innerEdge]);
  });

  it('resolveEdges finds top perimeter from open-shell rim when no top face exists', () => {
    const outerTopEdge = {
      ...mockShape('outer-top-edge'),
      _first: { _point: mockPnt(0, 10, 10) },
      _last: { _point: mockPnt(10, 10, 10) },
    };
    const innerTopEdge = {
      ...mockShape('inner-top-edge'),
      _first: { _point: mockPnt(2, 8, 10) },
      _last: { _point: mockPnt(8, 8, 10) },
    };
    const outerFrontFace = {
      ...mockShape('outer-front-face'),
      _center: mockPnt(5, 10, 5),
      _normal: [0, 1, 0] as [number, number, number],
      _edges: [outerTopEdge],
    };
    const innerFrontFace = {
      ...mockShape('inner-front-face'),
      _center: mockPnt(5, 8, 5),
      _normal: [0, -1, 0] as [number, number, number],
      _edges: [innerTopEdge],
    };
    const shape = {
      ...mockShape('open-shell'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [outerFrontFace, innerFrontFace],
      _edges: [outerTopEdge, innerTopEdge],
    };

    oc.BRepGProp_Face_2 = mockConstructor(
      (face: { _normal?: [number, number, number] }) => ({
        Bounds: vi
          .fn()
          .mockImplementation(
            (
              uMin: { current: number },
              uMax: { current: number },
              vMin: { current: number },
              vMax: { current: number },
            ) => {
              uMin.current = 0;
              uMax.current = 1;
              vMin.current = 0;
              vMax.current = 1;
            },
          ),
        Normal: vi
          .fn()
          .mockImplementation(
            (
              _u: number,
              _v: number,
              _p: unknown,
              v: { X: () => number; Y: () => number; Z: () => number },
            ) => {
              const [nx, ny, nz] = face._normal ?? [0, 0, 1];
              Object.assign(v, mockDir(nx, ny, nz));
            },
          ),
        delete: vi.fn(),
      }),
    );

    labelMap.register(oc, 'body', shape);
    const edges = labelMap.resolveEdges(oc, 'body.top.perimeter');
    expect(edges).toEqual([outerTopEdge]);
  });

  it('resolveEdges falls back to shape perimeter when matched top face yields no perimeter edges', () => {
    const strayTopFaceEdge = {
      ...mockShape('stray-top-edge'),
      _first: { _point: mockPnt(3, 4, 10) },
      _last: { _point: mockPnt(7, 6, 10) },
    };
    const outerTopEdge = {
      ...mockShape('outer-top-edge'),
      _first: { _point: mockPnt(0, 10, 10) },
      _last: { _point: mockPnt(10, 10, 10) },
    };
    const outerSideFace = {
      ...mockShape('outer-side-face'),
      _center: mockPnt(5, 10, 5),
      _normal: [0, 1, 0],
      _edges: [outerTopEdge],
    };
    const strayTopFace = {
      ...mockShape('stray-top-face'),
      _center: mockPnt(5, 5, 10),
      _normal: [0, 0, 1],
      _bbox: { xMin: 3, yMin: 4, zMin: 10, xMax: 7, yMax: 6, zMax: 10 },
      _edges: [strayTopFaceEdge],
    };
    const shape = {
      ...mockShape('open-shell-with-stray-top-face'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [outerSideFace, strayTopFace],
      _edges: [outerTopEdge, strayTopFaceEdge],
    };

    oc.BRepGProp_Face_2 = mockConstructor(
      (face: { _normal?: [number, number, number] }) => ({
        Bounds: vi
          .fn()
          .mockImplementation(
            (
              uMin: { current: number },
              uMax: { current: number },
              vMin: { current: number },
              vMax: { current: number },
            ) => {
              uMin.current = 0;
              uMax.current = 1;
              vMin.current = 0;
              vMax.current = 1;
            },
          ),
        Normal: vi
          .fn()
          .mockImplementation(
            (
              _u: number,
              _v: number,
              _p: unknown,
              v: { X: () => number; Y: () => number; Z: () => number },
            ) => {
              const [nx, ny, nz] = face._normal ?? [0, 0, 1];
              Object.assign(v, mockDir(nx, ny, nz));
            },
          ),
        delete: vi.fn(),
      }),
    );

    labelMap.register(oc, 'body', shape);
    const edges = labelMap.resolveEdges(oc, 'body.top.perimeter');
    expect(edges).toEqual([outerTopEdge]);
  });

  it('resolveAxis distinguishes bare top face, top center, and back_left corner', () => {
    labelMap.register(oc, 'base', mockShape());

    const bare = labelMap.resolveAxis(oc, {
      faceRef: 'base.top',
    }) as ReturnType<typeof mockAx2>;
    const center = labelMap.resolveAxis(oc, {
      faceRef: 'base.top.center',
    }) as ReturnType<typeof mockAx2>;
    const corner = labelMap.resolveAxis(oc, {
      faceRef: 'base.top.corner.back_left',
    }) as ReturnType<typeof mockAx2>;

    const bareLoc = bare.Location();
    const centerLoc = center.Location();
    const cornerLoc = corner.Location();
    expect([bareLoc.X(), bareLoc.Y(), bareLoc.Z()]).toEqual([0, 10, 10]);
    expect([centerLoc.X(), centerLoc.Y(), centerLoc.Z()]).toEqual([5, 5, 10]);
    expect([cornerLoc.X(), cornerLoc.Y(), cornerLoc.Z()]).toEqual([0, 10, 10]);
  });

  it('resolveAxis offsets top front_left inward with positive y', () => {
    const topFace = {
      ...mockShape('top-face'),
      _center: mockPnt(0, 0, 32),
      _normal: [0, 0, 1] as [number, number, number],
      _bbox: { xMin: -50, yMin: -40, zMin: 32, xMax: 50, yMax: 40, zMax: 32 },
    };
    const shape = {
      ...mockShape('body'),
      _bbox: { xMin: -50, yMin: -40, zMin: 0, xMax: 50, yMax: 40, zMax: 32 },
      _faces: [topFace],
    };

    oc.BRepGProp_Face_2 = mockConstructor(
      (face: { _normal?: [number, number, number] }) => ({
        Bounds: vi
          .fn()
          .mockImplementation(
            (
              uMin: { current: number },
              uMax: { current: number },
              vMin: { current: number },
              vMax: { current: number },
            ) => {
              uMin.current = 0;
              uMax.current = 1;
              vMin.current = 0;
              vMax.current = 1;
            },
          ),
        Normal: vi
          .fn()
          .mockImplementation(
            (
              _u: number,
              _v: number,
              _p: unknown,
              v: { X: () => number; Y: () => number; Z: () => number },
            ) => {
              const [nx, ny, nz] = face._normal ?? [0, 0, 1];
              Object.assign(v, mockDir(nx, ny, nz));
            },
          ),
        delete: vi.fn(),
      }),
    );

    labelMap.register(oc, 'body', shape);
    const ax = labelMap.resolveAxis(oc, {
      faceRef: 'body.top.corner.front_left',
      offsetX: 8,
      offsetY: 8,
    }) as ReturnType<typeof mockAx2>;
    const loc = ax.Location();
    expect([loc.X(), loc.Y(), loc.Z()]).toEqual([-42, -32, 32]);
  });

  it('resolveAxis offsets bare top face from back_left toward front-right', () => {
    const topFace = {
      ...mockShape('top-face'),
      _center: mockPnt(0, 0, 32),
      _normal: [0, 0, 1] as [number, number, number],
      _bbox: { xMin: -50, yMin: -40, zMin: 32, xMax: 50, yMax: 40, zMax: 32 },
    };
    const shape = {
      ...mockShape('body'),
      _bbox: { xMin: -50, yMin: -40, zMin: 0, xMax: 50, yMax: 40, zMax: 32 },
      _faces: [topFace],
    };

    oc.BRepGProp_Face_2 = mockConstructor(
      (face: { _normal?: [number, number, number] }) => ({
        Bounds: vi
          .fn()
          .mockImplementation(
            (
              uMin: { current: number },
              uMax: { current: number },
              vMin: { current: number },
              vMax: { current: number },
            ) => {
              uMin.current = 0;
              uMax.current = 1;
              vMin.current = 0;
              vMax.current = 1;
            },
          ),
        Normal: vi
          .fn()
          .mockImplementation(
            (
              _u: number,
              _v: number,
              _p: unknown,
              v: { X: () => number; Y: () => number; Z: () => number },
            ) => {
              const [nx, ny, nz] = face._normal ?? [0, 0, 1];
              Object.assign(v, mockDir(nx, ny, nz));
            },
          ),
        delete: vi.fn(),
      }),
    );

    labelMap.register(oc, 'body', shape);
    const ax = labelMap.resolveAxis(oc, {
      faceRef: 'body.top',
      offsetX: 8,
      offsetY: 8,
    }) as ReturnType<typeof mockAx2>;
    const loc = ax.Location();
    expect([loc.X(), loc.Y(), loc.Z()]).toEqual([-42, 32, 32]);
  });

  it('resolveAxis uses whole body bounds for open-shell top anchors', () => {
    const topRimFace = {
      ...mockShape('top-rim-face'),
      _center: mockPnt(0, -39, 32),
      _normal: [0, 0, 1] as [number, number, number],
      _bbox: { xMin: -50, yMin: -40, zMin: 32, xMax: 50, yMax: -38, zMax: 32 },
    };
    const shape = {
      ...mockShape('open-shell'),
      _bbox: { xMin: -50, yMin: -40, zMin: 0, xMax: 50, yMax: 40, zMax: 32 },
      _faces: [topRimFace],
    };

    oc.BRepGProp_Face_2 = mockConstructor(
      (face: { _normal?: [number, number, number] }) => ({
        Bounds: vi
          .fn()
          .mockImplementation(
            (
              uMin: { current: number },
              uMax: { current: number },
              vMin: { current: number },
              vMax: { current: number },
            ) => {
              uMin.current = 0;
              uMax.current = 1;
              vMin.current = 0;
              vMax.current = 1;
            },
          ),
        Normal: vi
          .fn()
          .mockImplementation(
            (
              _u: number,
              _v: number,
              _p: unknown,
              v: { X: () => number; Y: () => number; Z: () => number },
            ) => {
              const [nx, ny, nz] = face._normal ?? [0, 0, 1];
              Object.assign(v, mockDir(nx, ny, nz));
            },
          ),
        delete: vi.fn(),
      }),
    );

    labelMap.register(oc, 'body', shape);

    const center = labelMap.resolveAxis(oc, {
      faceRef: 'body.top.center',
    }) as ReturnType<typeof mockAx2>;
    const corner = labelMap.resolveAxis(oc, {
      faceRef: 'body.top.corner.front_left',
      offsetX: 8,
      offsetY: 8,
    }) as ReturnType<typeof mockAx2>;

    const centerLoc = center.Location();
    const cornerLoc = corner.Location();
    expect([centerLoc.X(), centerLoc.Y(), centerLoc.Z()]).toEqual([0, 0, 32]);
    expect([cornerLoc.X(), cornerLoc.Y(), cornerLoc.Z()]).toEqual([
      -42, -32, 32,
    ]);
  });

  it('resolveAxis uses the top-left corner for a bare vertical side face', () => {
    const frontFace = {
      ...mockShape('front-face'),
      _center: mockPnt(5, 0, 5),
      _normal: [0, -1, 0] as [number, number, number],
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 0, zMax: 10 },
    };
    const shape = {
      ...mockShape('body'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [frontFace],
    };

    oc.BRepGProp_Face_2 = mockConstructor(
      (face: { _normal?: [number, number, number] }) => ({
        Bounds: vi
          .fn()
          .mockImplementation(
            (
              uMin: { current: number },
              uMax: { current: number },
              vMin: { current: number },
              vMax: { current: number },
            ) => {
              uMin.current = 0;
              uMax.current = 1;
              vMin.current = 0;
              vMax.current = 1;
            },
          ),
        Normal: vi
          .fn()
          .mockImplementation(
            (
              _u: number,
              _v: number,
              _p: unknown,
              v: { X: () => number; Y: () => number; Z: () => number },
            ) => {
              const [nx, ny, nz] = face._normal ?? [0, 0, 1];
              Object.assign(v, mockDir(nx, ny, nz));
            },
          ),
        delete: vi.fn(),
      }),
    );

    labelMap.register(oc, 'body', shape);

    const bare = labelMap.resolveAxis(oc, {
      faceRef: 'body.side.front',
    }) as ReturnType<typeof mockAx2>;
    const center = labelMap.resolveAxis(oc, {
      faceRef: 'body.side.front.center',
    }) as ReturnType<typeof mockAx2>;

    const bareLoc = bare.Location();
    const centerLoc = center.Location();
    expect([bareLoc.X(), bareLoc.Y(), bareLoc.Z()]).toEqual([0, 0, 10]);
    expect([centerLoc.X(), centerLoc.Y(), centerLoc.Z()]).toEqual([5, 0, 5]);
  });
});

// ── OcctBridge with mock OC ───────────────────────────────────────────────────

/**
 * Constructs bridge from the supplied values.
 */
function makeBridge(oc: ReturnType<typeof makeMockOC>): OcctBridge {
  // Access private constructor via casting
  return new (OcctBridge as unknown as new (oc: unknown) => OcctBridge)(oc);
}

/**
 * Handles use extrude shape in the bridge flow.
 */
function useExtrudeShape(
  oc: ReturnType<typeof makeMockOC>,
  shape: object,
): void {
  oc.BRepPrimAPI_MakePrism_1 = mockConstructor(() => ({
    IsDone: () => true,
    Shape: () => shape,
    delete: vi.fn(),
  }));
}

/**
 * Handles use extrude shapes in the bridge flow.
 */
function useExtrudeShapes(
  oc: ReturnType<typeof makeMockOC>,
  shapes: object[],
): void {
  let index = 0;
  oc.BRepPrimAPI_MakePrism_1 = mockConstructor(() => ({
    IsDone: () => true,
    Shape: () => shapes[index++] ?? mockShape('extra-prism'),
    delete: vi.fn(),
  }));
}

/**
 * Handles use normal aware face classifier in the bridge flow.
 */
function useNormalAwareFaceClassifier(oc: ReturnType<typeof makeMockOC>): void {
  oc.BRepGProp_Face_2 = mockConstructor(
    (face: { _normal?: [number, number, number] }) => ({
      Bounds: vi
        .fn()
        .mockImplementation(
          (
            uMin: { current: number },
            uMax: { current: number },
            vMin: { current: number },
            vMax: { current: number },
          ) => {
            uMin.current = 0;
            uMax.current = 1;
            vMin.current = 0;
            vMax.current = 1;
          },
        ),
      Normal: vi
        .fn()
        .mockImplementation(
          (
            _u: number,
            _v: number,
            _p: unknown,
            v: { X: () => number; Y: () => number; Z: () => number },
          ) => {
            const [nx, ny, nz] = face._normal ?? [0, 0, 1];
            Object.assign(v, mockDir(nx, ny, nz));
          },
        ),
      delete: vi.fn(),
    }),
  );
}

describe('OcctBridge.build — basic extrude', () => {
  let oc: ReturnType<typeof makeMockOC>;

  beforeEach(() => {
    oc = makeMockOC();
  });

  it('returns ok:true for sketch+extrude program', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [makeSketch('s'), makeExtrude('obj', 's')],
      parts: [],
      baseUnitMm: 1,
    };
    const result = bridge.build(program);
    expect(result.ok).toBe(true);
  });

  it('calls BRepBuilderAPI_MakeEdge_3 four times for rect sketch', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [makeSketch('s', 20, 10), makeExtrude('obj', 's', 5)],
      parts: [],
      baseUnitMm: 1,
    };
    bridge.build(program);
    expect(oc.BRepBuilderAPI_MakeEdge_3).toHaveBeenCalledTimes(4);
  });

  it('calls BRepPrimAPI_MakePrism_1 for extrude', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [makeSketch('s'), makeExtrude('obj', 's', 8)],
      parts: [],
      baseUnitMm: 1,
    };
    bridge.build(program);
    expect(oc.BRepPrimAPI_MakePrism_1).toHaveBeenCalledTimes(1);
  });

  it('builds open surface meshes separately from thicken solids', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        { kind: 'surface', name: 'cap', boundary: 's', span: SPAN },
        {
          kind: 'surfaceOffset',
          name: 'offset_cap',
          source: 'cap',
          distance: 2,
          span: SPAN,
        },
        {
          kind: 'surfaceThicken',
          objName: 'solid_cap',
          surfaceName: 'offset_cap',
          thickness: 1.5,
          span: SPAN,
        },
      ],
      parts: [],
      baseUnitMm: 1,
    };
    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.meshes.some((mesh) => mesh.isOpenSurface)).toBe(true);
      expect(result.meshes.some((mesh) => mesh.bodyName === 'solid_cap')).toBe(
        true,
      );
    }
  });

  it('offsets and thickens side-face surfaces along the face normal', () => {
    const sideFace = mockShape('front-face');
    const state = {
      labelMap: {
        getFaceHandles: vi.fn().mockReturnValue([sideFace]),
        getAllFaceHandles: vi.fn().mockReturnValue([]),
        resolveEdges: vi.fn().mockReturnValue([]),
        resolveAxis: vi
          .fn()
          .mockReturnValue(
            mockAx2With(mockPnt(), mockDir(0, -1, 0), mockDir(1, 0, 0)),
          ),
      },
      sketchFaces: new Map(),
      surfaceShapes: new Map(),
      surfaceNormals: new Map(),
      surfaceMaterials: new Map(),
      bodyShapes: new Map(),
    } as unknown as GroupBuildState;

    buildSurfaceFillOperation(oc, state, {
      kind: 'surface',
      name: 'front_patch',
      boundary: 'body.outer.side.front',
      span: SPAN,
    });
    buildSurfaceOffsetOperation(oc, state, {
      kind: 'surfaceOffset',
      name: 'raised_front_patch',
      source: 'front_patch',
      distance: 5,
      span: SPAN,
    });
    buildSurfaceThickenOperation(oc, state, {
      kind: 'surfaceThicken',
      objName: 'cover',
      surfaceName: 'raised_front_patch',
      thickness: 1.4,
      span: SPAN,
    });

    expect(oc.gp_Vec_4).toHaveBeenCalledWith(0, -5, 0);
    expect(oc.gp_Vec_4).toHaveBeenCalledWith(0, -1.4, 0);
  });

  it('applies rotate ops with gp_Trsf.SetRotation_1', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [makeSketch('s'), makeExtrude('obj', 's', 8), makeRotate('obj', 45)],
      parts: [],
      baseUnitMm: 1,
    };
    bridge.build(program);
    expect(oc.gp_Ax1_2).toHaveBeenCalled();
    expect(
      oc.gp_Trsf_1.mock.results.some((result) => {
        const trsf = result.value as {
          SetRotation_1?: { mock?: { calls: unknown[] } };
        };
        return (trsf.SetRotation_1?.mock?.calls.length ?? 0) > 0;
      }),
    ).toBe(true);
  });

  it('applies rotate ops to resolved placed instance object names', () => {
    const bridge = makeBridge(oc);
    const placedSketch = makeSketch('body_7');
    placedSketch.placement = {
      faceRef: 'base.top.center',
      anchorRef: 'body_7.bottom.center',
      anchor: {
        ref: 'body_7.bottom.center',
        localPoint: [0, 0, 0],
        localNormal: [0, 0, -1],
      },
    };
    const program: IRProgram = {
      ops: [
        makeSketch('base_s'),
        makeExtrude('base', 'base_s', 8),
        placedSketch,
        makeExtrude('body_7', 'body_7', 2),
        makeRotate('body_7', 12),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
  });

  it.each([
    ['XZ', [0, -1, 0], [1, 0, 0], [0, -5, 0]],
    ['YZ', [1, 0, 0], [0, 1, 0], [5, 0, 0]],
  ] as const)(
    'uses %s as the default sketch workplane',
    (workplane, normal, xAxis, extrudeVec) => {
      const bridge = makeBridge(oc);
      const program: IRProgram = {
        ops: [makeSketch('s'), makeExtrude('obj', 's', 5)],
        parts: [],
        baseUnitMm: 1,
        workplane: workplane as Workplane,
      };

      bridge.build(program);

      const [, zDir, xDir] = oc.gp_Ax2_2.mock.calls[0] as [
        unknown,
        ReturnType<typeof mockDir>,
        ReturnType<typeof mockDir>,
      ];
      expect([zDir.X(), zDir.Y(), zDir.Z()]).toEqual(normal);
      expect([xDir.X(), xDir.Y(), xDir.Z()]).toEqual(xAxis);
      expect(oc.gp_Vec_4).toHaveBeenCalledWith(...extrudeVec);
    },
  );

  it('returns mesh with typed arrays', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [makeSketch('s'), makeExtrude('obj', 's')],
      parts: [],
      baseUnitMm: 1,
    };
    const result = bridge.build(program) as {
      ok: true;
      meshes: { vertices: unknown; normals: unknown; indices: unknown }[];
    };
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.meshes[0].vertices).toBeInstanceOf(Float32Array);
      expect(result.meshes[0].normals).toBeInstanceOf(Float32Array);
      expect(result.meshes[0].indices).toBeInstanceOf(Uint32Array);
    }
  });

  it('extractMesh falls back to triangle normals when OCCT face normal fails', () => {
    const face = mockShape('tri-face');
    const shape = { ...mockShape('tri-shape'), _faces: [face] };
    const nodes = [mockPnt(0, 0, 0), mockPnt(1, 0, 0), mockPnt(0, 1, 0)];
    const tri = {
      Get: vi.fn(
        (
          a: { current: number },
          b: { current: number },
          c: { current: number },
        ) => {
          a.current = 1;
          b.current = 2;
          c.current = 3;
        },
      ),
      delete: vi.fn(),
    };

    oc.BRep_Tool.Triangulation = vi.fn().mockReturnValue({
      IsNull: () => false,
      get: () => ({
        NbNodes: () => 3,
        NbTriangles: () => 1,
        Node: (i: number) => nodes[i - 1],
        Triangle: () => tri,
      }),
    });
    oc.BRepGProp_Face_2 = mockConstructor(() => ({
      Bounds: vi
        .fn()
        .mockImplementation(
          (
            uMin: { current: number },
            uMax: { current: number },
            vMin: { current: number },
            vMax: { current: number },
          ) => {
            uMin.current = 0;
            uMax.current = 1;
            vMin.current = 0;
            vMax.current = 1;
          },
        ),
      Normal: vi.fn(() => {
        throw new Error('bad uv');
      }),
      delete: vi.fn(),
    }));

    const bridge = makeBridge(oc) as unknown as {
      extractMesh(shape: unknown): {
        normals: Float32Array;
        indices: Uint32Array;
      };
    };
    const mesh = bridge.extractMesh(shape);

    expect(Array.from(mesh.indices)).toEqual([0, 1, 2]);
    expect(Array.from(mesh.normals)).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1]);
  });

  it('returns a source error if mesh extraction throws unexpectedly', () => {
    oc.BRepMesh_IncrementalMesh_2 = mockConstructor(() => {
      throw new Error('mesher exploded');
    });

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [makeSketch('s'), makeExtrude('obj', 's')],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/Mesh extraction failed/);
      expect(result.error.message).toMatch(/mesher exploded/);
      expect(result.error.span).toEqual(SPAN);
    }
  });

  it('keeps all live extrude bodies in the final part shape after details', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('base', 60, 40),
        makeExtrude('base', 'base', 10),
        {
          kind: 'sketch',
          name: 'boss',
          primitive: { kind: 'circle', diameter: 12 },
          placement: null,
          span: SPAN,
        },
        {
          kind: 'extrude',
          objName: 'boss',
          sketchName: 'boss',
          depth: 6,
          from: { faceRef: 'base.top.center' },
          symmetric: false,
          wrap: false,
          span: SPAN,
        },
        makeSketch('flange', 50, 6),
        {
          kind: 'extrude',
          objName: 'flange',
          sketchName: 'flange',
          depth: 4,
          from: { faceRef: 'base.top.center' },
          symmetric: true,
          wrap: false,
          span: SPAN,
        },
        makeFillet('base.top.edges', 1),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRep_Builder).toHaveBeenCalledTimes(2);
    const builder = oc.BRep_Builder.mock.results[1]?.value;
    expect(builder.MakeCompound).toHaveBeenCalledTimes(1);
    expect(builder.Add).toHaveBeenCalledTimes(3);
    expect(
      builder.Add.mock.calls.map(
        ([, shape]: [unknown, { _tag?: string }]) => shape._tag,
      ),
    ).toEqual(['fillet-result', 'prism-1', 'prism-2']);
  });
});

describe('OcctBridge.build — M19 advanced geometry', () => {
  let oc: ReturnType<typeof makeMockOC>;

  beforeEach(() => {
    oc = makeMockOC();
  });

  it('builds profile wires and revolve shapes, then resolves named face edges for modifiers', () => {
    const bridge = makeBridge(oc);
    const revolve: IRRevolve = {
      kind: 'revolve',
      objName: 'vase',
      sketchName: 'profile',
      angleDeg: 360,
      around: 'y',
      span: SPAN,
    };
    const program: IRProgram = {
      ops: [
        makeProfileSketch('profile'),
        revolve,
        makeFillet('vase.face.lip.edges', 0.5),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepBuilderAPI_MakeEdge_9).toHaveBeenCalled();
    expect(oc.BRepPrimAPI_MakeRevol_1).toHaveBeenCalledTimes(1);
    expect(oc.BRepFilletAPI_MakeFillet).toHaveBeenCalledTimes(1);
  });

  it('resolves cardinal revolve axes in the placed sketch frame', () => {
    useNormalAwareFaceClassifier(oc);
    const frontFace = {
      ...mockShape('front-face'),
      _normal: [0, -1, 0] as [number, number, number],
      _center: mockPnt(0, -5, 2),
    };
    const baseShape = {
      ...mockShape('base-shape'),
      _faces: [frontFace],
      _bbox: { xMin: -5, yMin: -5, zMin: 0, xMax: 5, yMax: 5, zMax: 4 },
    };
    useExtrudeShape(oc, baseShape);

    const bridge = makeBridge(oc);
    const profile = makeProfileSketch('profile');
    profile.placement = { faceRef: 'base.front.center' };
    const revolve: IRRevolve = {
      kind: 'revolve',
      objName: 'vase',
      sketchName: 'profile',
      angleDeg: 360,
      around: 'y',
      span: SPAN,
    };
    const program: IRProgram = {
      ops: [makeSketch('base'), makeExtrude('base', 'base'), profile, revolve],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    const axisDir = oc.gp_Ax1_2.mock.calls[0]?.[1] as {
      X(): number;
      Y(): number;
      Z(): number;
    };
    expect(axisDir.X()).toBeCloseTo(0);
    expect(axisDir.Y()).toBeCloseTo(0);
    expect(axisDir.Z()).toBeCloseTo(1);
  });

  it('builds unguided and guided lofts with the expected OCCT builders', () => {
    const bridge = makeBridge(oc);
    const loft: IRLoft = {
      kind: 'loft',
      objName: 'body',
      sketchNames: ['base', 'top'],
      height: 20,
      guide: null,
      span: SPAN,
    };
    const guided: IRLoft = {
      kind: 'loft',
      objName: 'guided',
      sketchNames: ['base', 'top'],
      height: 20,
      guide: 'rail',
      span: SPAN,
    };
    const program: IRProgram = {
      ops: [
        makeProfileSketch('base'),
        makeProfileSketch('top'),
        makeProfileSketch('rail', false),
        loft,
        guided,
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepOffsetAPI_ThruSections).toHaveBeenCalledTimes(2);
    expect(oc.BRepFill_PipeShell).not.toHaveBeenCalled();
  });

  it('validates cylindrical wrap targets and carries surface angle placement', () => {
    const bridge = makeBridge(oc);
    const rib: IRExtrude = {
      kind: 'extrude',
      objName: 'rib',
      sketchName: 'ribSketch',
      depth: 1,
      from: { faceRef: 'cyl.curved', surfaceAngleDeg: 45 },
      symmetric: false,
      wrap: true,
      span: SPAN,
    };
    const program: IRProgram = {
      ops: [
        makeSketch('cylSketch'),
        makeExtrude('cyl', 'cylSketch', 10),
        makeSketch('ribSketch'),
        rib,
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepAdaptor_Surface).toHaveBeenCalled();
    expect(oc.gp_Ax2_2).toHaveBeenCalled();
  });

  it('reports source-span errors for non-cylindrical wrap targets', () => {
    oc.BRepAdaptor_Surface = mockConstructor(() => ({
      GetType: () => 0,
      delete: vi.fn(),
    }));
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('cylSketch'),
        makeExtrude('cyl', 'cylSketch', 10),
        makeSketch('ribSketch'),
        {
          kind: 'extrude',
          objName: 'rib',
          sketchName: 'ribSketch',
          depth: 1,
          from: { faceRef: 'cyl.curved', surfaceAngleDeg: 45 },
          symmetric: false,
          wrap: true,
          span: { file: 'wrap.bscd', line: 7, col: 3 },
        },
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/not cylindrical/);
      expect(result.error.span).toEqual({
        file: 'wrap.bscd',
        line: 7,
        col: 3,
      });
    }
  });
});

describe('OcctBridge.build — boolean cut', () => {
  let oc: ReturnType<typeof makeMockOC>;

  beforeEach(() => {
    oc = makeMockOC();
  });

  it('calls BRepAlgoAPI_Cut_3 for a cut op', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('base'),
        makeExtrude('base', 'base', 10),
        makeSketch('hole'),
        makeCut('hole', 'hole', 'base.top.center'),
      ],
      parts: [],
      baseUnitMm: 1,
    };
    bridge.build(program);
    expect(oc.BRepAlgoAPI_Cut_3).toHaveBeenCalledTimes(1);
  });

  it('positions the cut sketch onto the requested face before cutting', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('base'),
        makeExtrude('base', 'base', 10),
        makeSketch('hole'),
        makeCut('hole', 'hole', 'base.top.corner.front_left'),
      ],
      parts: [],
      baseUnitMm: 1,
    };
    bridge.build(program);
    expect(oc.BRepBuilderAPI_Transform_2).toHaveBeenCalled();
  });

  it('cuts with a copied predefined solid tool', () => {
    const bridge = makeBridge(oc);
    const solidCut: IRSolidCut = {
      kind: 'solid_cut',
      objName: 'slot',
      tool: { kind: 'object', objName: 'tool' },
      from: { faceRef: 'base.top.center' },
      span: SPAN,
    };
    const program: IRProgram = {
      ops: [
        makeSketch('base_sk'),
        makeExtrude('base', 'base_sk', 10),
        makeSketch('tool_sk', 4, 4),
        makeExtrude('tool', 'tool_sk', 12),
        solidCut,
      ],
      parts: [],
      baseUnitMm: 1,
    };
    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepAlgoAPI_Cut_3).toHaveBeenCalledTimes(1);
    expect(oc.BRepBuilderAPI_Transform_2).toHaveBeenCalled();
  });

  it('keeps a predefined solid cut tool as a visible explicit-part component', () => {
    const bridge = makeBridge(oc);
    const solidCut: IRSolidCut = {
      kind: 'solid_cut',
      objName: 'front_port',
      tool: { kind: 'object', objName: 'side_tool' },
      from: { faceRef: 'base.front.center' },
      span: SPAN,
    };
    const program: IRProgram = {
      ops: [
        makePart('orange_part', '#D97706'),
        makeSketch('base_sk'),
        makeExtrude('base', 'base_sk', 10),
        makeSketch('tool_sk', 4, 8),
        makeExtrude('side_tool', 'tool_sk', 12),
        solidCut,
      ],
      parts: ['orange_part'],
      baseUnitMm: 1,
    };
    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepAlgoAPI_Cut_3).toHaveBeenCalledTimes(1);
    expect(oc.BRepAlgoAPI_Fuse_3).not.toHaveBeenCalled();
  });

  it('keeps one-line ref solid cut tools hidden but reusable', () => {
    const bridge = makeBridge(oc);
    const solidCut: IRSolidCut = {
      kind: 'solid_cut',
      objName: 'top_slot',
      tool: { kind: 'object', objName: 'punch_tool' },
      from: { faceRef: 'base.top.center' },
      span: SPAN,
    };
    const program: IRProgram = {
      ops: [
        makePart('green_part', '#16A34A'),
        makeSketch('base_sk'),
        makeExtrude('base', 'base_sk', 10),
        makeSketch('tool_sk', 4, 8),
        makeExtrude('punch_tool', 'tool_sk', 12),
        { kind: 'declareShape', name: 'punch_tool', span: SPAN },
        solidCut,
      ],
      parts: ['green_part'],
      baseUnitMm: 1,
    };
    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepAlgoAPI_Cut_3).toHaveBeenCalledTimes(1);
    expect(oc.BRepAlgoAPI_Fuse_3).not.toHaveBeenCalled();
    expect(
      oc.gp_Ax2_2.mock.calls.some((call) =>
        axisCallMatchesDirections(call, [0, 0, 1], [1, 0, 0]),
      ),
    ).toBe(true);
  });

  it('builds inline revolve solid cut tools in a radial axial profile plane', () => {
    const bridge = makeBridge(oc);
    const solidCut: IRSolidCut = {
      kind: 'solid_cut',
      objName: 'ring_socket',
      tool: {
        kind: 'operation',
        operation: {
          kind: 'revolve',
          objName: 'ring_socket__tool',
          sketchName: 'cutter_profile',
          angleDeg: 360,
          around: 'z',
          radius: 7,
          span: SPAN,
        },
      },
      from: { faceRef: 'base.top.center' },
      span: SPAN,
    };
    const program: IRProgram = {
      ops: [
        makeSketch('base_sk', 48, 34),
        makeExtrude('base', 'base_sk', 14),
        makeSketch('cutter_profile', 4, 10),
        solidCut,
        makeFillet('ring_socket.top.edges', 0.25),
        makeFillet('ring_socket.bottom.edges', 0.25),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepPrimAPI_MakeRevol_1).toHaveBeenCalledTimes(1);
    expect(oc.BRepAlgoAPI_Cut_3).toHaveBeenCalledTimes(1);
    expect(oc.BRepFilletAPI_MakeFillet).toHaveBeenCalled();
    const radialAxialAxis = oc.gp_Ax2_2.mock.calls.some((call) =>
      axisCallMatchesDirections(call, [0, -1, 0], [1, 0, 0]),
    );
    expect(radialAxialAxis).toBe(true);
  });

  it('keeps regular revolve objects on the existing sketch-plane path', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('profile', 4, 10),
        {
          kind: 'revolve',
          objName: 'ring',
          sketchName: 'profile',
          angleDeg: 360,
          around: 'z',
          span: SPAN,
        },
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepPrimAPI_MakeRevol_1).toHaveBeenCalledTimes(1);
    const radialAxialAxis = oc.gp_Ax2_2.mock.calls.some((call) =>
      axisCallMatchesDirections(call, [0, -1, 0], [1, 0, 0]),
    );
    expect(radialAxialAxis).toBe(false);
  });

  it('aims a top-face cut back into the target solid', () => {
    const bridge = makeBridge(oc) as unknown as {
      cutDepthTowardShape(
        ax2: unknown,
        targetShape: unknown,
        depth: number,
      ): number;
    };
    const ax2 = mockAx2With(
      mockPnt(0, 0, 10),
      mockDir(0, 0, 1),
      mockDir(1, 0, 0),
    );
    const signedDepth = bridge.cutDepthTowardShape(ax2, mockShape('solid'), 25);
    expect(signedDepth).toBe(-25);
  });

  it('aims a top-face solid tool back into the target solid', () => {
    const bridge = makeBridge(oc) as unknown as {
      solidCutTargetAxis(
        ax2: unknown,
        targetShape: unknown,
      ): {
        Direction(): { Z(): number };
      };
    };
    const ax2 = mockAx2With(
      mockPnt(0, 0, 10),
      mockDir(0, 0, 1),
      mockDir(1, 0, 0),
    );
    const target = {
      ...mockShape('solid'),
      _bbox: { xMin: -5, yMin: -5, zMin: 0, xMax: 5, yMax: 5, zMax: 10 },
    };
    const inward = bridge.solidCutTargetAxis(ax2, target);
    expect(inward.Direction().Z()).toBe(-1);
  });

  it('fails with error when cut target is unknown', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('hole'),
        makeCut('hole', 'hole', 'nonexistent.top.center'),
      ],
      parts: [],
      baseUnitMm: 1,
    };
    const result = bridge.build(program);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/nonexistent/);
    }
  });
});

describe('OcctBridge.build — fillet and chamfer', () => {
  let oc: ReturnType<typeof makeMockOC>;

  beforeEach(() => {
    oc = makeMockOC();
  });

  it('fuses additive part bodies by default before resolving fillets', () => {
    useNormalAwareFaceClassifier(oc);
    const baseRemainingTopEdge = {
      ...mockShape('base-remaining-top-edge'),
      _sourceName: 'base',
    };
    const bossTopEdge = {
      ...mockShape('boss-top-edge'),
      _sourceName: 'boss',
    };
    const baseShape = {
      ...mockShape('base-body'),
      _region: 'base',
      _bbox: { xMin: -30, yMin: -20, zMin: 0, xMax: 30, yMax: 20, zMax: 10 },
      _faces: [
        {
          ...mockShape('base-top'),
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 10),
          _edges: [mockShape('base-top-edge')],
        },
      ],
    };
    const bossShape = {
      ...mockShape('boss-body'),
      _region: 'boss',
      _bbox: { xMin: -6, yMin: -6, zMin: 10, xMax: 6, yMax: 6, zMax: 16 },
    };
    const fusedShape = {
      ...mockShape('fused-part'),
      _bbox: { xMin: -30, yMin: -20, zMin: 0, xMax: 30, yMax: 20, zMax: 16 },
      _faces: [
        {
          ...mockShape('fused-top'),
          _sourceName: 'base',
          _region: 'base',
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(-15, 0, 10),
          _edges: [baseRemainingTopEdge],
        },
        {
          ...mockShape('boss-top'),
          _sourceName: 'boss',
          _region: 'boss',
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 16),
          _edges: [bossTopEdge],
        },
      ],
      _edges: [baseRemainingTopEdge, bossTopEdge],
    };
    useExtrudeShapes(oc, [baseShape, bossShape]);
    oc.BRepAlgoAPI_Fuse_3 = mockConstructor(() => ({
      IsDone: () => true,
      Shape: () => fusedShape,
      Build: vi.fn(),
      delete: vi.fn(),
    }));

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makePart('bracket'),
        makeSketch('base', 60, 40),
        makeExtrude('base', 'base', 10),
        {
          ...makeSketch('boss'),
          primitive: { kind: 'circle', diameter: 12 },
        },
        {
          ...makeExtrude('boss', 'boss', 6),
          from: { faceRef: 'base.top.center' },
        },
        makeFillet('boss.top.edges', 2),
      ],
      parts: ['bracket'],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.ok).toBe(true);
    expect(oc.BRepAlgoAPI_Fuse_3).toHaveBeenCalledTimes(1);
    const filler = oc.BRepFilletAPI_MakeFillet.mock.results[0]?.value;
    expect(filler.Add_2).toHaveBeenCalledTimes(1);
    expect(filler.Add_2).toHaveBeenCalledWith(2, bossTopEdge);
  });

  it('overlaps placed part extrudes internally before fusing', () => {
    useNormalAwareFaceClassifier(oc);
    const baseShape = {
      ...mockShape('base-body'),
      _bbox: { xMin: -30, yMin: -20, zMin: 0, xMax: 30, yMax: 20, zMax: 10 },
      _faces: [
        {
          ...mockShape('base-top'),
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 10),
          _edges: [mockShape('base-top-edge')],
        },
      ],
    };
    const bossShape = {
      ...mockShape('boss-body'),
      _bbox: { xMin: -6, yMin: -6, zMin: 10, xMax: 6, yMax: 6, zMax: 16 },
    };
    useExtrudeShapes(oc, [baseShape, bossShape]);

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makePart('bracket'),
        makeSketch('base', 60, 40),
        makeExtrude('base', 'base', 10),
        makeSketch('boss', 12, 12),
        {
          ...makeExtrude('boss', 'boss', 6),
          from: { faceRef: 'base.top.center' },
        },
      ],
      parts: ['bracket'],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    if (!result.ok) throw new Error(result.error.message);

    const vecCalls = oc.gp_Vec_4.mock.calls;
    expect(
      vecCalls.some(
        ([x, y, z]) =>
          Math.abs(x) === 0 &&
          Math.abs(y) === 0 &&
          Math.abs(z + 0.0006) < 1e-12,
      ),
    ).toBe(true);
    expect(
      vecCalls.some(
        ([x, y, z]) =>
          Math.abs(x) === 0 &&
          Math.abs(y) === 0 &&
          Math.abs(z - 6.0006) < 1e-12,
      ),
    ).toBe(true);
  });

  it('fillets a symmetric flange bottom as the visible fused shoulder seam', () => {
    useNormalAwareFaceClassifier(oc);
    const flangeBottomSeedA = {
      ...mockShape('flange-bottom-seed-a'),
      _first: { _point: mockPnt(-25, -3, 8) },
      _last: { _point: mockPnt(25, -3, 8) },
    };
    const flangeBottomSeedB = {
      ...mockShape('flange-bottom-seed-b'),
      _first: { _point: mockPnt(25, -3, 8) },
      _last: { _point: mockPnt(25, 3, 8) },
    };
    const shoulderLeft = {
      ...mockShape('flange-shoulder-left'),
      _sourceName: 'flange',
      _first: { _point: mockPnt(-25, -3, 10) },
      _last: { _point: mockPnt(-6.2, -3, 10) },
    };
    const shoulderRight = {
      ...mockShape('flange-shoulder-right'),
      _sourceName: 'flange',
      _first: { _point: mockPnt(6.2, -3, 10) },
      _last: { _point: mockPnt(25, -3, 10) },
    };
    const shoulderB = {
      ...mockShape('flange-shoulder-b'),
      _sourceName: 'flange',
      _first: { _point: mockPnt(25, -3, 10) },
      _last: { _point: mockPnt(25, 3, 10) },
    };
    const baseTopEdge = {
      ...mockShape('base-top-edge'),
      _sourceName: 'base',
      _first: { _point: mockPnt(-30, -20, 10) },
      _last: { _point: mockPnt(30, -20, 10) },
    };
    const baseShape = {
      ...mockShape('base-body'),
      _bbox: { xMin: -30, yMin: -20, zMin: 0, xMax: 30, yMax: 20, zMax: 10 },
      _faces: [
        {
          ...mockShape('base-top'),
          _sourceName: 'base',
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 10),
          _edges: [baseTopEdge],
        },
      ],
      _edges: [baseTopEdge],
    };
    const flangeShape = {
      ...mockShape('flange-body'),
      _bbox: { xMin: -25, yMin: -3, zMin: 8, xMax: 25, yMax: 3, zMax: 12 },
      _faces: [
        {
          ...mockShape('flange-bottom'),
          _sourceName: 'flange',
          _normal: [0, 0, -1] as [number, number, number],
          _center: mockPnt(0, 0, 8),
          _edges: [flangeBottomSeedA, flangeBottomSeedB],
        },
      ],
      _edges: [flangeBottomSeedA, flangeBottomSeedB],
    };
    const fusedShape = {
      ...mockShape('fused-flange-part'),
      _bbox: { xMin: -30, yMin: -20, zMin: 0, xMax: 30, yMax: 20, zMax: 12 },
      _faces: [
        {
          ...mockShape('base-top-fragment'),
          _sourceName: 'base',
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(-15, 0, 10),
          _edges: [baseTopEdge],
        },
      ],
      _edges: [baseTopEdge, shoulderLeft, shoulderRight, shoulderB],
    };
    useExtrudeShapes(oc, [baseShape, flangeShape]);
    oc.BRepAlgoAPI_Fuse_3 = mockConstructor(() => ({
      IsDone: () => true,
      Shape: () => fusedShape,
      Build: vi.fn(),
      delete: vi.fn(),
    }));

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makePart('plate'),
        makeSketch('base', 60, 40),
        makeExtrude('base', 'base', 10),
        makeSketch('flange', 50, 6),
        {
          ...makeExtrude('flange', 'flange', 4),
          from: { faceRef: 'base.top.center' },
          symmetric: true,
        },
        makeFillet('flange.bottom.edges', 1),
      ],
      parts: ['plate'],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);

    if (!result.ok) throw new Error(result.error.message);
    const filler = oc.BRepFilletAPI_MakeFillet.mock.results[0]?.value;
    expect(filler.Add_2).toHaveBeenCalledTimes(3);
    expect(filler.Add_2).toHaveBeenCalledWith(1, shoulderLeft);
    expect(filler.Add_2).toHaveBeenCalledWith(1, shoulderRight);
    expect(filler.Add_2).toHaveBeenCalledWith(1, shoulderB);
    expect(filler.Add_2).not.toHaveBeenCalledWith(1, baseTopEdge);
  });

  it('fillets the test-01 flange seam after flushing a three-component part', () => {
    useNormalAwareFaceClassifier(oc);
    const baseTopEdge = {
      ...mockShape('base-top-edge'),
      _sourceName: 'base',
      _first: { _point: mockPnt(-30, -20, 10) },
      _last: { _point: mockPnt(30, -20, 10) },
    };
    const baseBottomEdge = {
      ...mockShape('base-bottom-edge'),
      _sourceName: 'base',
      _first: { _point: mockPnt(-30, -20, 0) },
      _last: { _point: mockPnt(30, -20, 0) },
    };
    const bossTopEdge = {
      ...mockShape('boss-top-edge'),
      _sourceName: 'boss',
      _first: { _point: mockPnt(-6, -6, 16) },
      _last: { _point: mockPnt(6, -6, 16) },
    };
    const bossBottomSeed = {
      ...mockShape('boss-bottom-seed'),
      _first: { _point: mockPnt(-6, -6, 10) },
      _last: { _point: mockPnt(6, -6, 10) },
    };
    const bossShoulder = {
      ...mockShape('boss-shoulder'),
      _first: { _point: mockPnt(-6, -6, 10) },
      _last: { _point: mockPnt(6, -6, 10) },
    };
    const flangeBottomSeedA = {
      ...mockShape('flange-bottom-seed-a'),
      _first: { _point: mockPnt(-25, -3, 8) },
      _last: { _point: mockPnt(25, -3, 8) },
    };
    const flangeBottomSeedB = {
      ...mockShape('flange-bottom-seed-b'),
      _first: { _point: mockPnt(25, -3, 8) },
      _last: { _point: mockPnt(25, 3, 8) },
    };
    const shoulderLeft = {
      ...mockShape('flange-shoulder-left'),
      _sourceName: 'flange',
      _first: { _point: mockPnt(-25, -3, 10) },
      _last: { _point: mockPnt(-6.2, -3, 10) },
    };
    const shoulderRight = {
      ...mockShape('flange-shoulder-right'),
      _sourceName: 'flange',
      _first: { _point: mockPnt(6.2, -3, 10) },
      _last: { _point: mockPnt(25, -3, 10) },
    };
    const shoulderB = {
      ...mockShape('flange-shoulder-b'),
      _sourceName: 'flange',
      _first: { _point: mockPnt(25, -3, 10) },
      _last: { _point: mockPnt(25, 3, 10) },
    };
    const baseShape = {
      ...mockShape('base-body'),
      _bbox: { xMin: -30, yMin: -20, zMin: 0, xMax: 30, yMax: 20, zMax: 10 },
      _faces: [
        {
          ...mockShape('base-top'),
          _sourceName: 'base',
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 10),
          _edges: [baseTopEdge],
        },
        {
          ...mockShape('base-bottom'),
          _sourceName: 'base',
          _normal: [0, 0, -1] as [number, number, number],
          _center: mockPnt(0, 0, 0),
          _edges: [baseBottomEdge],
        },
      ],
      _edges: [baseTopEdge, baseBottomEdge],
    };
    const bossShape = {
      ...mockShape('boss-body'),
      _bbox: { xMin: -6, yMin: -6, zMin: 10, xMax: 6, yMax: 6, zMax: 16 },
      _faces: [
        {
          ...mockShape('boss-top'),
          _sourceName: 'boss',
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 16),
          _edges: [bossTopEdge],
        },
        {
          ...mockShape('boss-bottom'),
          _sourceName: 'boss',
          _normal: [0, 0, -1] as [number, number, number],
          _center: mockPnt(0, 0, 10),
          _edges: [bossBottomSeed],
        },
      ],
      _edges: [bossTopEdge, bossBottomSeed],
    };
    const flangeShape = {
      ...mockShape('flange-body'),
      _bbox: { xMin: -25, yMin: -3, zMin: 8, xMax: 25, yMax: 3, zMax: 12 },
      _faces: [
        {
          ...mockShape('flange-bottom'),
          _sourceName: 'flange',
          _normal: [0, 0, -1] as [number, number, number],
          _center: mockPnt(0, 0, 8),
          _edges: [flangeBottomSeedA, flangeBottomSeedB],
        },
      ],
      _edges: [flangeBottomSeedA, flangeBottomSeedB],
    };
    const fusedBaseBoss = {
      ...mockShape('fused-base-boss'),
      _bbox: { xMin: -30, yMin: -20, zMin: 0, xMax: 30, yMax: 20, zMax: 16 },
      _edges: [baseTopEdge, baseBottomEdge, bossTopEdge],
    };
    const fusedPart = {
      ...mockShape('fused-test-01-part'),
      _bbox: { xMin: -30, yMin: -20, zMin: 0, xMax: 30, yMax: 20, zMax: 16 },
      _faces: [
        {
          ...mockShape('base-top-fragment'),
          _sourceName: 'base',
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(-15, 0, 10),
          _edges: [baseTopEdge],
        },
        {
          ...mockShape('boss-top-fragment'),
          _sourceName: 'boss',
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 16),
          _edges: [bossTopEdge],
        },
      ],
      _edges: [
        baseTopEdge,
        baseBottomEdge,
        bossTopEdge,
        bossShoulder,
        shoulderLeft,
        shoulderRight,
        shoulderB,
      ],
    };
    const filletedPart = {
      ...fusedPart,
      _tag: 'filleted-test-01-part',
      _faces: [
        ...(fusedPart._faces as object[]),
        {
          ...mockShape('base-bottom-fragment'),
          _sourceName: 'base',
          _normal: [0, 0, -1] as [number, number, number],
          _center: mockPnt(0, 0, 0),
          _edges: [baseBottomEdge],
        },
      ],
    };
    useExtrudeShapes(oc, [baseShape, bossShape, flangeShape]);
    const fuseResults = [fusedBaseBoss, fusedPart];
    oc.BRepAlgoAPI_Fuse_3 = mockConstructor(() => ({
      IsDone: () => true,
      Shape: () => fuseResults.shift() ?? mockShape('unexpected-fuse'),
      Build: vi.fn(),
      delete: vi.fn(),
    }));
    oc.BRepFilletAPI_MakeFillet = mockConstructor(() => ({
      Add_2: vi.fn(),
      Build: vi.fn(),
      Build_1: vi.fn(),
      IsDone: () => true,
      Shape: () => filletedPart,
      delete: vi.fn(),
    }));

    const bridge = makeBridge(oc);
    const result = bridge.build({
      ops: [
        makePart('plate'),
        makeSketch('base', 60, 40),
        makeExtrude('base', 'base', 10),
        makeSketch('boss', 12, 12),
        {
          ...makeExtrude('boss', 'boss', 6),
          from: { faceRef: 'base.top.center' },
        },
        makeSketch('flange', 50, 6),
        {
          ...makeExtrude('flange', 'flange', 4),
          from: { faceRef: 'base.top.center' },
          symmetric: true,
        },
        makeFillet('base.top.edges', 1.5),
        makeFillet('boss.top.edges', 1),
        makeFillet('flange.bottom.edges', 1),
        makeChamfer('base.bottom.edges', 0.5),
      ],
      parts: ['plate'],
      baseUnitMm: 1,
    });

    if (!result.ok) throw new Error(result.error.message);
    expect(oc.BRepAlgoAPI_Fuse_3).toHaveBeenCalledTimes(2);
    const filletCalls = oc.BRepFilletAPI_MakeFillet.mock.results.flatMap(
      (result) => result.value.Add_2.mock.calls,
    );
    expect(filletCalls).toContainEqual([1, shoulderLeft]);
    expect(filletCalls).toContainEqual([1, shoulderRight]);
    expect(filletCalls).toContainEqual([1, shoulderB]);
    expect(filletCalls).not.toContainEqual([1, flangeBottomSeedA]);
    expect(filletCalls).not.toContainEqual([1, flangeBottomSeedB]);
    expect(filletCalls).not.toContainEqual([1, bossShoulder]);
    expect(filletCalls).not.toContainEqual([1, baseTopEdge]);

    useExtrudeShapes(oc, [baseShape, bossShape, flangeShape]);
    const combinedFuseResults = [fusedBaseBoss, fusedPart];
    oc.BRepAlgoAPI_Fuse_3 = mockConstructor(() => ({
      IsDone: () => true,
      Shape: () => combinedFuseResults.shift() ?? mockShape('unexpected-fuse'),
      Build: vi.fn(),
      delete: vi.fn(),
    }));
    oc.BRepFilletAPI_MakeFillet = mockConstructor(() => ({
      Add_2: vi.fn(),
      Build: vi.fn(),
      Build_1: vi.fn(),
      IsDone: () => true,
      Shape: () => filletedPart,
      delete: vi.fn(),
    }));

    const combined = bridge.build({
      ops: [
        makePart('plate'),
        makeSketch('base', 60, 40),
        makeExtrude('base', 'base', 10),
        makeSketch('boss', 12, 12),
        {
          ...makeExtrude('boss', 'boss', 6),
          from: { faceRef: 'base.top.center' },
        },
        makeSketch('flange', 50, 6),
        {
          ...makeExtrude('flange', 'flange', 4),
          from: { faceRef: 'base.top.center' },
          symmetric: true,
        },
        makeFillet('flange.bottom.edges', 1),
        makeFillet('boss.bottom.edges', 1),
      ],
      parts: ['plate'],
      baseUnitMm: 1,
    });
    if (!combined.ok) throw new Error(combined.error.message);
    const combinedFilletCalls =
      oc.BRepFilletAPI_MakeFillet.mock.results.flatMap(
        (result) => result.value.Add_2.mock.calls,
      );
    expect(combinedFilletCalls).toContainEqual([1, shoulderLeft]);
    expect(combinedFilletCalls).toContainEqual([1, shoulderRight]);
    expect(combinedFilletCalls).toContainEqual([1, shoulderB]);
    expect(combinedFilletCalls).toContainEqual([1, bossShoulder]);
  });

  it('fillets a placed boss bottom as the fused base-contact seam', () => {
    useNormalAwareFaceClassifier(oc);
    const bossBottomSeed = {
      ...mockShape('boss-bottom-seed'),
      _first: { _point: mockPnt(-6, -6, 9.99) },
      _last: { _point: mockPnt(6, -6, 9.99) },
    };
    const bossShoulder = {
      ...mockShape('boss-shoulder'),
      _sourceName: 'boss',
      _first: { _point: mockPnt(-6, -6, 10) },
      _last: { _point: mockPnt(6, -6, 10) },
    };
    const baseShape = {
      ...mockShape('base-body'),
      _bbox: { xMin: -30, yMin: -20, zMin: 0, xMax: 30, yMax: 20, zMax: 10 },
      _faces: [
        {
          ...mockShape('base-top'),
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 10),
        },
      ],
    };
    const bossShape = {
      ...mockShape('boss-body'),
      _bbox: { xMin: -6, yMin: -6, zMin: 9.99, xMax: 6, yMax: 6, zMax: 16 },
      _faces: [
        {
          ...mockShape('boss-bottom'),
          _sourceName: 'boss',
          _normal: [0, 0, -1] as [number, number, number],
          _center: mockPnt(0, 0, 9.99),
          _edges: [bossBottomSeed],
        },
      ],
      _edges: [bossBottomSeed],
    };
    const fusedShape = {
      ...mockShape('fused-boss-part'),
      _bbox: { xMin: -30, yMin: -20, zMin: 0, xMax: 30, yMax: 20, zMax: 16 },
      _edges: [bossShoulder],
    };
    useExtrudeShapes(oc, [baseShape, bossShape]);
    oc.BRepAlgoAPI_Fuse_3 = mockConstructor(() => ({
      IsDone: () => true,
      Shape: () => fusedShape,
      Build: vi.fn(),
      delete: vi.fn(),
    }));

    const bridge = makeBridge(oc);
    const result = bridge.build({
      ops: [
        makePart('plate'),
        makeSketch('base', 60, 40),
        makeExtrude('base', 'base', 10),
        makeSketch('boss', 12, 12),
        {
          ...makeExtrude('boss', 'boss', 6),
          from: { faceRef: 'base.top.center' },
        },
        makeFillet('boss.bottom.edges', 0.5),
      ],
      parts: ['plate'],
      baseUnitMm: 1,
    });

    if (!result.ok) throw new Error(result.error.message);
    const filler = oc.BRepFilletAPI_MakeFillet.mock.results[0]?.value;
    expect(filler.Add_2).toHaveBeenCalledTimes(1);
    expect(filler.Add_2).toHaveBeenCalledWith(0.5, bossShoulder);
  });

  it('configures robust fuse options and simplifies boolean results', () => {
    const shape = mockShape('fused');
    const fuser = {
      SetNonDestructive: vi.fn(),
      SetRunParallel: vi.fn(),
      SetFuzzyValue: vi.fn(),
      SetGlue: vi.fn(),
      Build: vi.fn(),
      IsDone: () => true,
      SimplifyResult: vi.fn(),
      Shape: () => shape,
      delete: vi.fn(),
    };
    oc.BOPAlgo_GlueEnum = { BOPAlgo_GlueShift: 'shift' };
    oc.BRepAlgoAPI_Fuse_3 = mockConstructor(() => fuser);

    const result = applyStableBoolFuse(
      oc,
      mockShape('a'),
      mockShape('b'),
      SPAN,
    );

    expect(result).toBe(shape);
    expect(fuser.SetNonDestructive).toHaveBeenCalledWith(true);
    expect(fuser.SetRunParallel).toHaveBeenCalledWith(false);
    expect(fuser.SetFuzzyValue).toHaveBeenCalledWith(1e-7);
    expect(fuser.SetGlue).toHaveBeenCalledWith('shift');
    expect(fuser.SimplifyResult).toHaveBeenCalledWith(true, true, 1e-7);
  });

  it('heals invalid fuse results before returning them', () => {
    const invalidShape = mockShape('invalid-fuse');
    const healedShape = mockShape('healed-fuse');
    let validationCount = 0;
    oc.BRepCheck_Analyzer = mockConstructor(() => ({
      IsValid: () => validationCount++ > 0,
      delete: vi.fn(),
    }));
    oc.ShapeFix_Shape_2 = mockConstructor(() => ({
      SetPrecision: vi.fn(),
      SetMinTolerance: vi.fn(),
      SetMaxTolerance: vi.fn(),
      Perform: vi.fn(),
      Shape: () => healedShape,
      delete: vi.fn(),
    }));
    oc.BRepAlgoAPI_Fuse_3 = mockConstructor(() => ({
      Build: vi.fn(),
      IsDone: () => true,
      Shape: () => invalidShape,
      delete: vi.fn(),
    }));

    const result = applyStableBoolFuse(
      oc,
      mockShape('a'),
      mockShape('b'),
      SPAN,
    );

    expect(result).toBe(healedShape);
    expect(oc.ShapeFix_Shape_2).toHaveBeenCalledWith(invalidShape);
  });

  it('configures, simplifies, and returns valid boolean cut results', () => {
    const shape = mockShape('cut-result');
    const cutter = {
      SetNonDestructive: vi.fn(),
      SetRunParallel: vi.fn(),
      SetFuzzyValue: vi.fn(),
      SetGlue: vi.fn(),
      Build: vi.fn(),
      IsDone: () => true,
      SimplifyResult: vi.fn(),
      Shape: () => shape,
      delete: vi.fn(),
    };
    oc.BRepAlgoAPI_Cut_3 = mockConstructor(() => cutter);

    const result = applyStableBoolCut(
      oc,
      mockShape('target'),
      mockShape('tool'),
      SPAN,
    );

    expect(result).toBe(shape);
    expect(cutter.SetNonDestructive).toHaveBeenCalledWith(true);
    expect(cutter.SetRunParallel).toHaveBeenCalledWith(false);
    expect(cutter.SetFuzzyValue).toHaveBeenCalledWith(1e-7);
    expect(cutter.SetGlue).not.toHaveBeenCalled();
    expect(cutter.SimplifyResult).toHaveBeenCalledWith(true, true, 1e-7);
  });

  it('heals invalid cut results before returning them', () => {
    const invalidShape = mockShape('invalid-cut');
    const healedShape = mockShape('healed-cut');
    let validationCount = 0;
    oc.BRepCheck_Analyzer = mockConstructor(() => ({
      IsValid: () => validationCount++ > 0,
      delete: vi.fn(),
    }));
    oc.ShapeFix_Shape_2 = mockConstructor(() => ({
      SetPrecision: vi.fn(),
      SetMinTolerance: vi.fn(),
      SetMaxTolerance: vi.fn(),
      Perform: vi.fn(),
      Shape: () => healedShape,
      delete: vi.fn(),
    }));
    oc.BRepAlgoAPI_Cut_3 = mockConstructor(() => ({
      Build: vi.fn(),
      IsDone: () => true,
      SimplifyResult: vi.fn(),
      Shape: () => invalidShape,
      delete: vi.fn(),
    }));

    const result = applyStableBoolCut(
      oc,
      mockShape('target'),
      mockShape('tool'),
      SPAN,
    );

    expect(result).toBe(healedShape);
    expect(oc.ShapeFix_Shape_2).toHaveBeenCalledWith(invalidShape);
  });

  it('reports failed boolean cuts with the source span', () => {
    oc.BRepAlgoAPI_Cut_3 = mockConstructor(() => ({
      Build: vi.fn(),
      IsDone: () => false,
      delete: vi.fn(),
    }));

    expect(() =>
      applyStableBoolCut(oc, mockShape('target'), mockShape('tool'), SPAN),
    ).toThrow(/Boolean cut failed/);
  });

  it('expands fillets across tangent-connected edge chains', () => {
    useNormalAwareFaceClassifier(oc);
    const edgeA = {
      ...mockShape('edge-a'),
      _tangentGroup: 'rim',
      _first: { _point: mockPnt(0, 0, 10) },
      _last: { _point: mockPnt(5, 0, 10) },
    };
    const edgeB = {
      ...mockShape('edge-b'),
      _tangentGroup: 'rim',
      _first: { _point: mockPnt(5, 0, 10) },
      _last: { _point: mockPnt(10, 0, 10) },
    };
    const shape = {
      ...mockShape('cylinder-like-body'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 20, yMax: 20, zMax: 20 },
      _faces: [
        {
          ...mockShape('top-face'),
          _normal: [0, 0, 1] as [number, number, number],
          _edges: [edgeA],
        },
      ],
      _edges: [edgeA, edgeB],
    };
    useExtrudeShapes(oc, [shape, shape, shape]);

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 10),
        makeFillet('base.top.edges', 2),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    const filler = oc.BRepFilletAPI_MakeFillet.mock.results[0]?.value;
    expect(filler.Add_2).toHaveBeenCalledTimes(2);
    expect(filler.Add_2).toHaveBeenNthCalledWith(1, 2, edgeA);
    expect(filler.Add_2).toHaveBeenNthCalledWith(2, 2, edgeB);
  });

  it('reports obviously oversized fillet radii before invoking OCCT', () => {
    useNormalAwareFaceClassifier(oc);
    const topEdge = mockShape('top-edge');
    const shape = {
      ...mockShape('small-body'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 4, yMax: 4, zMax: 4 },
      _faces: [
        {
          ...mockShape('top-face'),
          _normal: [0, 0, 1] as [number, number, number],
          _edges: [topEdge],
        },
      ],
      _edges: [topEdge],
    };
    useExtrudeShape(oc, shape);

    const bridge = makeBridge(oc);
    const result = bridge.build({
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 4),
        makeFillet('base.top.edges', 3),
      ],
      parts: [],
      baseUnitMm: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.validations[0]?.message).toMatch(
      /maximum estimated radius is 2/,
    );
    expect(result.validations[0]?.span).toEqual(SPAN);
    expect(oc.BRepFilletAPI_MakeFillet).not.toHaveBeenCalled();
  });

  it('fillets a placed body local top after that top becomes a world side', () => {
    useNormalAwareFaceClassifier(oc);
    const baseShape = {
      ...mockShape('base'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [
        {
          ...mockShape('base-front'),
          _center: mockPnt(5, 0, 5),
          _normal: [0, -1, 0] as [number, number, number],
        },
      ],
    };
    /**
     * Creates a local point value for the current operation.
     */
    const localPoint = ([x, y, z]: [number, number, number]) =>
      mockPnt(x, -z, y);
    const childTopFrontEdge = {
      ...mockShape('child-top-front-edge'),
      _first: { _point: localPoint([0, 0, 10]) },
      _last: { _point: localPoint([10, 0, 10]) },
    };
    const childTopBackEdge = {
      ...mockShape('child-top-back-edge'),
      _first: { _point: localPoint([0, 10, 10]) },
      _last: { _point: localPoint([10, 10, 10]) },
    };
    const childShape = {
      ...mockShape('child'),
      _bbox: { xMin: 0, yMin: -10, zMin: 0, xMax: 10, yMax: 0, zMax: 10 },
      _faces: [
        {
          ...mockShape('child-local-top'),
          _center: localPoint([5, 5, 10]),
          _normal: [0, -1, 0] as [number, number, number],
          _edges: [childTopFrontEdge, childTopBackEdge],
        },
      ],
      _edges: [childTopFrontEdge, childTopBackEdge],
    };
    useExtrudeShapes(oc, [baseShape, childShape]);

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('base'),
        makeExtrude('base', 'base', 10),
        makeSketch('child'),
        {
          kind: 'extrude',
          objName: 'child',
          sketchName: 'child',
          depth: 10,
          from: { faceRef: 'base.side.front.center' },
          symmetric: false,
          wrap: false,
          span: SPAN,
        },
        makeFillet('child.top.edges', 0.5),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    const filler = oc.BRepFilletAPI_MakeFillet.mock.results[0]?.value;
    expect(filler.Add_2).toHaveBeenCalledTimes(2);
    expect(filler.Add_2).toHaveBeenNthCalledWith(1, 0.5, childTopFrontEdge);
    expect(filler.Add_2).toHaveBeenNthCalledWith(2, 0.5, childTopBackEdge);
  });

  it('keeps cut aliases in a placed body local frame', () => {
    useNormalAwareFaceClassifier(oc);
    const baseShape = {
      ...mockShape('base'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [
        {
          ...mockShape('base-front'),
          _center: mockPnt(5, 0, 5),
          _normal: [0, -1, 0] as [number, number, number],
        },
      ],
    };
    /**
     * Creates a local point value for the current operation.
     */
    const localPoint = ([x, y, z]: [number, number, number]) =>
      mockPnt(x, -z, y);
    const outerTopEdge = {
      ...mockShape('outer-local-top-edge'),
      _first: { _point: localPoint([0, 0, 10]) },
      _last: { _point: localPoint([10, 0, 10]) },
    };
    const cutTopEdge = {
      ...mockShape('cut-local-top-edge'),
      _first: { _point: localPoint([3, 4, 10]) },
      _last: { _point: localPoint([7, 4, 10]) },
    };
    const childShape = {
      ...mockShape('child'),
      _bbox: { xMin: 0, yMin: -10, zMin: 0, xMax: 10, yMax: 0, zMax: 10 },
      _faces: [
        {
          ...mockShape('child-local-top'),
          _center: localPoint([5, 5, 10]),
          _normal: [0, -1, 0] as [number, number, number],
          _edges: [outerTopEdge],
        },
      ],
      _edges: [outerTopEdge],
    };
    const cutResult = {
      ...mockShape('child-after-cut'),
      _bbox: { xMin: 0, yMin: -10, zMin: 0, xMax: 10, yMax: 0, zMax: 10 },
      _faces: [
        {
          ...mockShape('child-cut-local-top'),
          _center: localPoint([5, 5, 10]),
          _normal: [0, -1, 0] as [number, number, number],
          _edges: [outerTopEdge, cutTopEdge],
        },
      ],
      _edges: [outerTopEdge, cutTopEdge],
    };
    useExtrudeShapes(oc, [baseShape, childShape, mockShape('cut-tool')]);
    oc.BRepAlgoAPI_Cut_3 = mockConstructor(() => ({
      Build: vi.fn(),
      IsDone: () => true,
      Shape: () => cutResult,
      delete: vi.fn(),
    }));

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('base'),
        makeExtrude('base', 'base', 10),
        makeSketch('child'),
        {
          kind: 'extrude',
          objName: 'child',
          sketchName: 'child',
          depth: 10,
          from: { faceRef: 'base.side.front.center' },
          symmetric: false,
          wrap: false,
          span: SPAN,
        },
        makeSketch('hole'),
        makeCut('hole', 'hole', 'child.top.center', 1),
        makeFillet('hole.top.edges', 0.1),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    const filler = oc.BRepFilletAPI_MakeFillet.mock.results[0]?.value;
    expect(filler.Add_2).toHaveBeenCalledTimes(1);
    expect(filler.Add_2).toHaveBeenCalledWith(0.1, cutTopEdge);
  });

  it('selects generated pocket rim edges for cut aliases inside explicit parts', () => {
    useNormalAwareFaceClassifier(oc);
    const baseTopEdge = {
      ...mockShape('base-top-edge'),
      _first: { _point: mockPnt(-20, 15, 10) },
      _last: { _point: mockPnt(20, 15, 10) },
    };
    const pocketRimEdge = {
      ...mockShape('pocket-rim-edge'),
      _first: { _point: mockPnt(-6, 4, 10) },
      _last: { _point: mockPnt(6, 4, 10) },
    };
    const pocketFloorBoreEdge = {
      ...mockShape('pocket-floor-bore-edge'),
      _first: { _point: mockPnt(-2, 0, 8) },
      _last: { _point: mockPnt(2, 0, 8) },
    };
    const unrelatedTopHoleEdge = {
      ...mockShape('unrelated-top-hole-edge'),
      _first: { _point: mockPnt(12, 0, 10) },
      _last: { _point: mockPnt(16, 0, 10) },
    };
    const baseShape = {
      ...mockShape('base-body'),
      _bbox: { xMin: -20, yMin: -15, zMin: 0, xMax: 20, yMax: 15, zMax: 10 },
      _faces: [
        {
          ...mockShape('base-top'),
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 10),
          _edges: [baseTopEdge],
        },
      ],
      _edges: [baseTopEdge],
    };
    const cutResult = {
      ...mockShape('base-after-pocket'),
      _bbox: { xMin: -20, yMin: -15, zMin: 0, xMax: 20, yMax: 15, zMax: 10 },
      _faces: [
        {
          ...mockShape('cut-top-face'),
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 10),
          _edges: [
            baseTopEdge,
            pocketRimEdge,
            pocketFloorBoreEdge,
            unrelatedTopHoleEdge,
          ],
        },
      ],
      _edges: [
        baseTopEdge,
        pocketRimEdge,
        pocketFloorBoreEdge,
        unrelatedTopHoleEdge,
      ],
    };
    const pocketTool = {
      ...mockShape('pocket-tool'),
      _bbox: { xMin: -6, yMin: -4, zMin: 8, xMax: 6, yMax: 4, zMax: 10 },
    };
    useExtrudeShapes(oc, [baseShape, pocketTool]);
    oc.BRepAlgoAPI_Cut_3 = mockConstructor(() => ({
      Build: vi.fn(),
      IsDone: () => true,
      Shape: () => cutResult,
      delete: vi.fn(),
    }));
    oc.BRepFilletAPI_MakeFillet = mockConstructor(() => ({
      Add_2: vi.fn(),
      Build: vi.fn(),
      IsDone: () => true,
      Shape: () => cutResult,
      delete: vi.fn(),
    }));

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makePart('block'),
        makeSketch('base', 40, 30),
        makeExtrude('base', 'base', 10),
        makeSketch('pocket', 12, 8),
        makeCut('pocket', 'pocket', 'base.top.center', 2),
        makeFillet('pocket.top.edges', 0.5),
        makeChamfer('base.top.edges', 0.25),
      ],
      parts: ['block'],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    if (!result.ok) throw new Error(result.error.message);
    expect(oc.BRepFilletAPI_MakeFillet).toHaveBeenCalledTimes(1);
    const filler = oc.BRepFilletAPI_MakeFillet.mock.results[0]?.value;
    expect(filler.Add_2).toHaveBeenCalledTimes(1);
    expect(filler.Add_2).toHaveBeenCalledWith(0.5, pocketRimEdge);
    expect(filler.Add_2).not.toHaveBeenCalledWith(0.5, pocketFloorBoreEdge);
    expect(filler.Add_2).not.toHaveBeenCalledWith(0.5, unrelatedTopHoleEdge);
    const chamferer = oc.BRepFilletAPI_MakeChamfer.mock.results[0]?.value;
    expect(chamferer.Add_2).toHaveBeenCalledWith(0.25, unrelatedTopHoleEdge);
    expect(chamferer.Add_2).not.toHaveBeenCalledWith(0.25, pocketRimEdge);
    expect(chamferer.Add_2).not.toHaveBeenCalledWith(0.25, pocketFloorBoreEdge);
  });

  it('selects generated pocket floor perimeter edges for cut alias bottom refs', () => {
    useNormalAwareFaceClassifier(oc);
    const pocketTopRimEdge = {
      ...mockShape('pocket-top-rim-edge'),
      _first: { _point: mockPnt(-6, 4, 10) },
      _last: { _point: mockPnt(6, 4, 10) },
    };
    const pocketFloorEdge = {
      ...mockShape('pocket-floor-edge'),
      _first: { _point: mockPnt(-6, 4, 8) },
      _last: { _point: mockPnt(6, 4, 8) },
    };
    const pocketFloorBoreEdge = {
      ...mockShape('pocket-floor-bore-edge'),
      _first: { _point: mockPnt(-2, 0, 8) },
      _last: { _point: mockPnt(2, 0, 8) },
    };
    const unrelatedBaseBottomEdge = {
      ...mockShape('unrelated-base-bottom-edge'),
      _first: { _point: mockPnt(-20, -15, 0) },
      _last: { _point: mockPnt(20, -15, 0) },
    };
    const baseShape = {
      ...mockShape('base-body'),
      _bbox: { xMin: -20, yMin: -15, zMin: 0, xMax: 20, yMax: 15, zMax: 10 },
      _faces: [
        {
          ...mockShape('base-top'),
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 10),
          _edges: [pocketTopRimEdge],
        },
      ],
      _edges: [pocketTopRimEdge],
    };
    const cutResult = {
      ...mockShape('base-after-pocket'),
      _bbox: { xMin: -20, yMin: -15, zMin: 0, xMax: 20, yMax: 15, zMax: 10 },
      _faces: [
        {
          ...mockShape('cut-top-face'),
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 10),
          _edges: [pocketTopRimEdge],
        },
        {
          ...mockShape('pocket-floor-face'),
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 8),
          _edges: [pocketFloorEdge, pocketFloorBoreEdge],
        },
      ],
      _edges: [
        pocketTopRimEdge,
        pocketFloorEdge,
        pocketFloorBoreEdge,
        unrelatedBaseBottomEdge,
      ],
    };
    const pocketTool = {
      ...mockShape('pocket-tool'),
      _bbox: { xMin: -6, yMin: -4, zMin: 8, xMax: 6, yMax: 4, zMax: 10 },
    };

    /**
     * Builds with target from the supplied inputs.
     */
    const buildWithTarget = (target: string) => {
      useExtrudeShapes(oc, [baseShape, pocketTool]);
      oc.BRepAlgoAPI_Cut_3 = mockConstructor(() => ({
        Build: vi.fn(),
        IsDone: () => true,
        Shape: () => cutResult,
        delete: vi.fn(),
      }));
      oc.BRepFilletAPI_MakeFillet = mockConstructor(() => ({
        Add_2: vi.fn(),
        Build: vi.fn(),
        IsDone: () => true,
        Shape: () => cutResult,
        delete: vi.fn(),
      }));

      const bridge = makeBridge(oc);
      const program: IRProgram = {
        ops: [
          makePart('block'),
          makeSketch('base', 40, 30),
          makeExtrude('base', 'base', 10),
          makeSketch('pocket', 12, 8),
          makeCut('pocket', 'pocket', 'base.top.center', 2),
          makeFillet(target, 0.5),
        ],
        parts: ['block'],
        baseUnitMm: 1,
      };

      const result = bridge.build(program);
      if (!result.ok) throw new Error(result.error.message);
      expect(oc.BRepFilletAPI_MakeFillet).toHaveBeenCalledTimes(1);
      return oc.BRepFilletAPI_MakeFillet.mock.results[0]?.value;
    };

    const edgesFiller = buildWithTarget('pocket.bottom.edges');
    expect(edgesFiller.Add_2).toHaveBeenCalledTimes(2);
    expect(edgesFiller.Add_2).toHaveBeenCalledWith(0.5, pocketFloorEdge);
    expect(edgesFiller.Add_2).toHaveBeenCalledWith(0.5, pocketFloorBoreEdge);
    expect(edgesFiller.Add_2).not.toHaveBeenCalledWith(0.5, pocketTopRimEdge);
    expect(edgesFiller.Add_2).not.toHaveBeenCalledWith(
      0.5,
      unrelatedBaseBottomEdge,
    );

    const perimeterFiller = buildWithTarget('pocket.bottom.perimeter');
    expect(perimeterFiller.Add_2).toHaveBeenCalledTimes(1);
    expect(perimeterFiller.Add_2).toHaveBeenCalledWith(0.5, pocketFloorEdge);
    expect(perimeterFiller.Add_2).not.toHaveBeenCalledWith(
      0.5,
      pocketTopRimEdge,
    );
    expect(perimeterFiller.Add_2).not.toHaveBeenCalledWith(
      0.5,
      pocketFloorBoreEdge,
    );
    expect(perimeterFiller.Add_2).not.toHaveBeenCalledWith(
      0.5,
      unrelatedBaseBottomEdge,
    );
  });

  it('selects closed circular cut-floor perimeter edges by region bounds', () => {
    useNormalAwareFaceClassifier(oc);
    const pocketTopRimEdge = {
      ...mockShape('pocket-top-rim-edge'),
      _first: { _point: mockPnt(6, 0, 10) },
      _last: { _point: mockPnt(6, 0, 10) },
      _bbox: { xMin: -6, yMin: -4, zMin: 10, xMax: 6, yMax: 4, zMax: 10 },
    };
    const closedFloorEdge = {
      ...mockShape('closed-pocket-floor-edge'),
      _first: { _point: mockPnt(6, 0, 8) },
      _last: { _point: mockPnt(6, 0, 8) },
      _bbox: { xMin: -6, yMin: -4, zMin: 8, xMax: 6, yMax: 4, zMax: 8 },
    };
    const baseShape = {
      ...mockShape('base-body'),
      _bbox: { xMin: -20, yMin: -15, zMin: 0, xMax: 20, yMax: 15, zMax: 10 },
      _faces: [
        {
          ...mockShape('base-top'),
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 10),
          _edges: [pocketTopRimEdge],
        },
      ],
      _edges: [pocketTopRimEdge],
    };
    const cutResult = {
      ...mockShape('base-after-circular-pocket'),
      _bbox: { xMin: -20, yMin: -15, zMin: 0, xMax: 20, yMax: 15, zMax: 10 },
      _faces: [
        {
          ...mockShape('pocket-floor-face'),
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 8),
          _edges: [closedFloorEdge],
        },
      ],
      _edges: [pocketTopRimEdge, closedFloorEdge],
    };
    const pocketTool = {
      ...mockShape('circular-pocket-tool'),
      _bbox: { xMin: -6, yMin: -4, zMin: 8, xMax: 6, yMax: 4, zMax: 10 },
    };

    useExtrudeShapes(oc, [baseShape, pocketTool]);
    oc.BRepAlgoAPI_Cut_3 = mockConstructor(() => ({
      Build: vi.fn(),
      IsDone: () => true,
      Shape: () => cutResult,
      delete: vi.fn(),
    }));
    oc.BRepFilletAPI_MakeFillet = mockConstructor(() => ({
      Add_2: vi.fn(),
      Build: vi.fn(),
      IsDone: () => true,
      Shape: () => cutResult,
      delete: vi.fn(),
    }));

    const bridge = makeBridge(oc);
    const result = bridge.build({
      ops: [
        makePart('block'),
        makeSketch('base', 40, 30),
        makeExtrude('base', 'base', 10),
        makeSketch('pocket', 12, 8),
        makeCut('pocket', 'pocket', 'base.top.center', 2),
        makeFillet('pocket.bottom.perimeter', 0.5),
      ],
      parts: ['block'],
      baseUnitMm: 1,
    });

    if (!result.ok) throw new Error(result.error.message);
    const filler = oc.BRepFilletAPI_MakeFillet.mock.results[0]?.value;
    expect(filler.Add_2).toHaveBeenCalledTimes(1);
    expect(filler.Add_2).toHaveBeenCalledWith(0.5, closedFloorEdge);
    expect(filler.Add_2).not.toHaveBeenCalledWith(0.5, pocketTopRimEdge);
  });

  it('keeps loft-cut bottom edges on the interior floor loop', () => {
    useNormalAwareFaceClassifier(oc);
    const cutLabels = new FaceLabelMap();
    const topRimEdge = {
      ...mockShape('loft-cut-top-rim'),
      _first: { _point: mockPnt(58.5, 0, 30) },
      _last: { _point: mockPnt(58.5, 0, 30) },
      _bbox: {
        xMin: -58.5,
        yMin: -58.5,
        zMin: 30,
        xMax: 58.5,
        yMax: 58.5,
        zMax: 30,
      },
    };
    const internalCapLoop = {
      ...mockShape('loft-cut-internal-cap-loop'),
      _first: { _point: mockPnt(58.5, 0, 5) },
      _last: { _point: mockPnt(58.5, 0, 5) },
      _bbox: {
        xMin: -58.5,
        yMin: -58.5,
        zMin: 5,
        xMax: 58.5,
        yMax: 58.5,
        zMax: 5,
      },
    };
    const wallFloorEdge = {
      ...mockShape('loft-cut-wall-floor-edge'),
      _first: { _point: mockPnt(58.5, 0, 5) },
      _last: { _point: mockPnt(58.5, 0, 5) },
      _bbox: {
        xMin: -58.5,
        yMin: -58.5,
        zMin: 5,
        xMax: 58.5,
        yMax: 58.5,
        zMax: 5,
      },
    };
    const floorWallRim = {
      ...mockShape('loft-cut-floor-wall-rim'),
      _first: { _point: mockPnt(62.5, 0, 5) },
      _last: { _point: mockPnt(62.5, 0, 5) },
      _bbox: {
        xMin: -62.5,
        yMin: -62.5,
        zMin: 5,
        xMax: 62.5,
        yMax: 62.5,
        zMax: 5,
      },
    };
    const cutResult = {
      ...mockShape('tray-after-solid-loft-cut'),
      _bbox: {
        xMin: -67.5,
        yMin: -67.5,
        zMin: 0,
        xMax: 67.5,
        yMax: 67.5,
        zMax: 30,
      },
      _faces: [
        {
          ...mockShape('loft-cut-entrance'),
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 30),
          _edges: [topRimEdge],
        },
        {
          ...mockShape('loft-cut-floor'),
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 5),
          _edges: [internalCapLoop, floorWallRim],
        },
        {
          ...mockShape('loft-cut-wall'),
          _normal: [1, 0, 0] as [number, number, number],
          _center: mockPnt(58.5, 0, 12),
          _edges: [wallFloorEdge],
        },
      ],
      _edges: [topRimEdge, internalCapLoop, wallFloorEdge, floorWallRim],
    };
    const loftCutRegion = {
      ...mockShape('placed-loft-cut-tool'),
      _solidCutToolKind: 'loft',
      _bbox: {
        xMin: -62.5,
        yMin: -62.5,
        zMin: 5,
        xMax: 62.5,
        yMax: 62.5,
        zMax: 30,
      },
    };

    cutLabels.register(
      oc,
      'tray_cut',
      cutResult,
      'inner',
      undefined,
      loftCutRegion,
    );

    expect(cutLabels.getBlendEdges(oc, 'tray_cut.bottom.edges')).toEqual([
      wallFloorEdge,
    ]);
    expect(cutLabels.getBlendEdges(oc, 'tray_cut.bottom.perimeter')).toEqual([
      floorWallRim,
    ]);
  });

  it('fillets the original loft edge then cuts once with the blended tool', () => {
    useNormalAwareFaceClassifier(oc);
    const trayTopEdge = {
      ...mockShape('tray-top-edge'),
      _first: { _point: mockPnt(-30, -30, 30) },
      _last: { _point: mockPnt(30, -30, 30) },
      _bbox: { xMin: -30, yMin: -30, zMin: 30, xMax: 30, yMax: 30, zMax: 30 },
    };
    const floorRim = {
      ...mockShape('cut-floor-rim'),
      _first: { _point: mockPnt(10, 0, 0) },
      _last: { _point: mockPnt(10, 0, 0) },
      _bbox: { xMin: -10, yMin: -10, zMin: 0, xMax: 10, yMax: 10, zMax: 0 },
    };
    const toolFloorLoop = {
      ...mockShape('tool-floor-loop'),
      _first: { _point: mockPnt(10, 0, 0) },
      _last: { _point: mockPnt(10, 0, 0) },
      _bbox: { xMin: -10, yMin: -10, zMin: 0, xMax: 10, yMax: 10, zMax: 0 },
    };
    const trayShape = {
      ...mockShape('tray-body'),
      _bbox: { xMin: -30, yMin: -30, zMin: 0, xMax: 30, yMax: 30, zMax: 30 },
      _faces: [
        {
          ...mockShape('tray-top'),
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 30),
          _edges: [trayTopEdge],
        },
      ],
      _edges: [trayTopEdge],
    };
    const loftTool = {
      ...mockShape('loft-tool'),
      _sourceOperationKind: 'loft',
      _bbox: { xMin: -10, yMin: -10, zMin: 0, xMax: 10, yMax: 10, zMax: 25 },
      _faces: [
        {
          ...mockShape('tool-bottom'),
          _normal: [0, 0, -1] as [number, number, number],
          _center: mockPnt(0, 0, 0),
          _edges: [toolFloorLoop],
        },
      ],
      _edges: [toolFloorLoop],
    };
    const cutResult = {
      ...mockShape('tray-after-loft-cut'),
      _bbox: { xMin: -30, yMin: -30, zMin: 0, xMax: 30, yMax: 30, zMax: 30 },
      _faces: [
        {
          ...mockShape('cut-wall'),
          _normal: [1, 0, 0] as [number, number, number],
          _center: mockPnt(10, 0, 12),
          _edges: [floorRim],
        },
        {
          ...mockShape('cut-floor'),
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(0, 0, 0),
          _edges: [floorRim],
        },
      ],
      _edges: [floorRim],
    };
    const filletedTool = {
      ...mockShape('filleted-loft-tool'),
      _bbox: loftTool._bbox,
      _edges: [toolFloorLoop],
    };
    const rebuiltCutResult = {
      ...mockShape('tray-after-tool-fillet-cut'),
      _bbox: cutResult._bbox,
      _faces: cutResult._faces,
      _edges: cutResult._edges,
    };
    const cutResults = [cutResult, rebuiltCutResult];
    let cutIndex = 0;
    const filler = {
      Add_2: vi.fn(),
      Build: vi.fn(),
      IsDone: () => true,
      Shape: () => filletedTool,
      delete: vi.fn(),
    };

    useExtrudeShapes(oc, [trayShape, loftTool]);
    oc.BRepBuilderAPI_Transform_2 = mockConstructor((shape: unknown) => ({
      IsDone: () => true,
      Shape: () => shape,
      delete: vi.fn(),
    }));
    oc.BRepAlgoAPI_Cut_3 = mockConstructor(() => ({
      Build: vi.fn(),
      IsDone: () => true,
      Shape: () => cutResults[cutIndex++] ?? rebuiltCutResult,
      SimplifyResult: vi.fn(),
      delete: vi.fn(),
    }));
    oc.BRepFilletAPI_MakeFillet = mockConstructor((shape: unknown) => {
      expect(shape).toBe(loftTool);
      return filler;
    });

    const solidCut: IRSolidCut = {
      kind: 'solid_cut',
      objName: 'tray_cut',
      tool: { kind: 'object', objName: 'tray_cut_ref' },
      from: { faceRef: 'tray.top.center' },
      span: SPAN,
    };
    const program: IRProgram = {
      ops: [
        makeSketch('tray_sketch', 60, 60),
        makeExtrude('tray', 'tray_sketch', 30),
        makeSketch('tool_sketch', 20, 20),
        makeExtrude('tray_cut_ref', 'tool_sketch', 25),
        { kind: 'declareShape', name: 'tray_cut_ref', span: SPAN },
        solidCut,
        makeFillet('tray_cut.bottom.edges', 2),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = makeBridge(oc).build(program);
    if (!result.ok) throw new Error(result.error.message);
    expect(oc.BRepFilletAPI_MakeFillet).toHaveBeenCalledTimes(1);
    expect(filler.Add_2).toHaveBeenCalledTimes(1);
    expect(filler.Add_2).toHaveBeenCalledWith(2, toolFloorLoop);
    expect(filler.Add_2).not.toHaveBeenCalledWith(2, floorRim);
    expect(oc.BRepAlgoAPI_Cut_3).toHaveBeenCalledTimes(2);
    expect(oc.BRepAlgoAPI_Cut_3.mock.calls[1]?.[1]).toBe(filletedTool);
  });

  it('cuts only overlapping deferred part components without eager fuse', () => {
    useNormalAwareFaceClassifier(oc);
    const baseShape = {
      ...mockShape('base-body'),
      _bbox: { xMin: -20, yMin: -20, zMin: 0, xMax: 20, yMax: 20, zMax: 5 },
    };
    const nearBoss = {
      ...mockShape('near-boss'),
      _bbox: { xMin: -4, yMin: -4, zMin: 5, xMax: 4, yMax: 4, zMax: 10 },
    };
    const farBoss = {
      ...mockShape('far-boss'),
      _bbox: { xMin: 50, yMin: 50, zMin: 5, xMax: 58, yMax: 58, zMax: 10 },
    };
    const tool = {
      ...mockShape('cut-tool'),
      _bbox: { xMin: -5, yMin: -5, zMin: -1, xMax: 5, yMax: 5, zMax: 11 },
    };
    const baseCut = { ...mockShape('base-cut'), _bbox: baseShape._bbox };
    const nearCut = { ...mockShape('near-cut'), _bbox: nearBoss._bbox };
    useExtrudeShapes(oc, [baseShape, nearBoss, farBoss, tool]);
    const cutResults = [baseCut, nearCut];
    oc.BRepAlgoAPI_Cut_3 = mockConstructor(() => ({
      Build: vi.fn(),
      IsDone: () => true,
      Shape: () => cutResults.shift() ?? mockShape('unexpected-cut'),
      delete: vi.fn(),
    }));
    oc.BRepAlgoAPI_Fuse_3 = mockConstructor(() => ({
      Build: vi.fn(),
      IsDone: () => true,
      Shape: () => mockShape('fused-part'),
      delete: vi.fn(),
    }));

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makePart('panel'),
        makeSketch('base', 40, 40),
        makeExtrude('base', 'base', 5),
        makeSketch('near', 8, 8),
        makeExtrude('near', 'near', 5),
        makeSketch('far', 8, 8),
        makeExtrude('far', 'far', 5),
        makeSketch('hole', 4, 4),
        makeCut('hole', 'hole', 'base.top.center', null),
      ],
      parts: ['panel'],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    if (!result.ok) throw new Error(result.error.message);
    expect(oc.BRepAlgoAPI_Cut_3).toHaveBeenCalledTimes(2);
    expect(oc.BRepAlgoAPI_Fuse_3).not.toHaveBeenCalled();
  });

  it('rotates a deferred part component without collapsing the part owner', () => {
    const baseShape = {
      ...mockShape('base-body'),
      _bbox: { xMin: -20, yMin: -20, zMin: 0, xMax: 20, yMax: 20, zMax: 5 },
    };
    const nearBoss = {
      ...mockShape('near-boss'),
      _bbox: { xMin: -4, yMin: -4, zMin: 5, xMax: 4, yMax: 4, zMax: 10 },
    };
    const farBoss = {
      ...mockShape('far-boss'),
      _bbox: { xMin: 50, yMin: 50, zMin: 5, xMax: 58, yMax: 58, zMax: 10 },
    };
    useExtrudeShapes(oc, [baseShape, nearBoss, farBoss]);
    oc.BRepAlgoAPI_Fuse_3 = mockConstructor(() => ({
      Build: vi.fn(),
      IsDone: () => true,
      Shape: () => mockShape('unexpected-fuse'),
      delete: vi.fn(),
    }));

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makePart('panel'),
        makeSketch('base', 40, 40),
        makeExtrude('base', 'base', 5),
        makeSketch('near', 8, 8),
        makeExtrude('near', 'near', 5),
        makeSketch('far', 8, 8),
        makeExtrude('far', 'far', 5),
        makeRotate('near', 15),
      ],
      parts: ['panel'],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    if (!result.ok) throw new Error(result.error.message);
    const rotatedShapes = oc.BRepBuilderAPI_Transform_2.mock.calls.map(
      ([shape]) => shape,
    );
    expect(rotatedShapes).toContain(nearBoss);
    expect(rotatedShapes).not.toContain(baseShape);
    expect(oc.BRepAlgoAPI_Fuse_3).not.toHaveBeenCalled();
  });

  it('calls BRepFilletAPI_MakeFillet for fillet op', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 10),
        makeFillet('base.top.edges', 2),
      ],
      parts: [],
      baseUnitMm: 1,
    };
    bridge.build(program);
    expect(oc.BRepFilletAPI_MakeFillet).toHaveBeenCalledTimes(1);
  });

  it('calls BRepFilletAPI_MakeChamfer for chamfer op', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 10),
        makeChamfer('base.top.edges', 0.5), // mock face classified as 'top' (+Z normal)
      ],
      parts: [],
      baseUnitMm: 1,
    };
    bridge.build(program);
    expect(oc.BRepFilletAPI_MakeChamfer).toHaveBeenCalledTimes(1);
  });

  it('batches two fillet ops on the same body into one builder', () => {
    useNormalAwareFaceClassifier(oc);
    const topEdge = mockShape('top-edge');
    const bottomEdge = mockShape('bottom-edge');
    const shape = {
      ...mockShape('body'),
      _faces: [
        {
          ...mockShape('top-face'),
          _normal: [0, 0, 1] as [number, number, number],
          _edges: [topEdge],
        },
        {
          ...mockShape('bottom-face'),
          _normal: [0, 0, -1] as [number, number, number],
          _edges: [bottomEdge],
        },
      ],
      _edges: [topEdge, bottomEdge],
    };
    useExtrudeShape(oc, shape);

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 10),
        makeFillet('base.top.edges', 2),
        makeFillet('base.bottom.edges', 1),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepFilletAPI_MakeFillet).toHaveBeenCalledTimes(1);
    const filler = oc.BRepFilletAPI_MakeFillet.mock.results[0]?.value;
    expect(filler.Add_2).toHaveBeenCalledTimes(2);
    expect(filler.Add_2).toHaveBeenNthCalledWith(1, 2, topEdge);
    expect(filler.Add_2).toHaveBeenNthCalledWith(2, 1, bottomEdge);
  });

  it('batches two chamfer ops on the same body into one builder', () => {
    useNormalAwareFaceClassifier(oc);
    const topEdge = mockShape('top-edge');
    const bottomEdge = mockShape('bottom-edge');
    const shape = {
      ...mockShape('body'),
      _faces: [
        {
          ...mockShape('top-face'),
          _normal: [0, 0, 1] as [number, number, number],
          _edges: [topEdge],
        },
        {
          ...mockShape('bottom-face'),
          _normal: [0, 0, -1] as [number, number, number],
          _edges: [bottomEdge],
        },
      ],
      _edges: [topEdge, bottomEdge],
    };
    useExtrudeShape(oc, shape);

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 10),
        makeChamfer('base.top.edges', 0.5),
        makeChamfer('base.bottom.edges', 0.25),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepFilletAPI_MakeChamfer).toHaveBeenCalledTimes(1);
    const chamferer = oc.BRepFilletAPI_MakeChamfer.mock.results[0]?.value;
    expect(chamferer.Add_2).toHaveBeenCalledTimes(2);
    expect(chamferer.Add_2).toHaveBeenNthCalledWith(1, 0.5, topEdge);
    expect(chamferer.Add_2).toHaveBeenNthCalledWith(2, 0.25, bottomEdge);
  });

  it('retries a failed fillet batch as disconnected edge groups without changing radii', () => {
    useNormalAwareFaceClassifier(oc);
    const topEdge = {
      ...mockShape('top-edge'),
      _first: { _point: mockPnt(0, 10, 10) },
      _last: { _point: mockPnt(10, 10, 10) },
    };
    const bottomEdge = {
      ...mockShape('bottom-edge'),
      _first: { _point: mockPnt(0, 0, 0) },
      _last: { _point: mockPnt(10, 0, 0) },
    };
    const shape = {
      ...mockShape('body'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [
        {
          ...mockShape('top-face'),
          _normal: [0, 0, 1] as [number, number, number],
          _edges: [topEdge],
        },
        {
          ...mockShape('bottom-face'),
          _normal: [0, 0, -1] as [number, number, number],
          _edges: [bottomEdge],
        },
      ],
      _edges: [topEdge, bottomEdge],
    };
    useExtrudeShape(oc, shape);

    const builders: Array<{
      Add_2: ReturnType<typeof vi.fn>;
      Build: ReturnType<typeof vi.fn>;
      IsDone: () => boolean;
      NbFaultyContours: () => number;
      NbFaultyVertices: () => number;
      HasResult: () => boolean;
      Shape: () => object;
      delete: ReturnType<typeof vi.fn>;
    }> = [];
    oc.BRepFilletAPI_MakeFillet = mockConstructor(() => {
      const index = builders.length;
      const builder = {
        Add_2: vi.fn(),
        Build: vi.fn(),
        IsDone: () =>
          index !== 0 && builders[index].Add_2.mock.calls.length === 1,
        NbFaultyContours: () => (index === 0 ? 1 : 0),
        NbFaultyVertices: () => 0,
        HasResult: () => index !== 0,
        Shape: () => mockShape(`fillet-result-${index}`),
        delete: vi.fn(),
      };
      builders.push(builder);
      return builder;
    });

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 10),
        makeFillet('base.top.edges', 2),
        makeFillet('base.bottom.edges', 1),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepFilletAPI_MakeFillet).toHaveBeenCalledTimes(3);
    expect(builders[0].Add_2).toHaveBeenCalledTimes(2);
    expect(builders[1].Add_2).toHaveBeenCalledWith(2, topEdge);
    expect(builders[2].Add_2).toHaveBeenCalledWith(1, bottomEdge);
  });

  it('records a failed fillet target and continues later fillet targets', () => {
    useNormalAwareFaceClassifier(oc);
    const topEdge = {
      ...mockShape('top-edge'),
      _first: { _point: mockPnt(0, 10, 10) },
      _last: { _point: mockPnt(10, 10, 10) },
    };
    const bottomEdge = {
      ...mockShape('bottom-edge'),
      _first: { _point: mockPnt(0, 0, 0) },
      _last: { _point: mockPnt(10, 0, 0) },
    };
    const filletedBottom = mockShape('filleted-bottom');
    const shape = {
      ...mockShape('body'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [
        {
          ...mockShape('top-face'),
          _normal: [0, 0, 1] as [number, number, number],
          _edges: [topEdge],
        },
        {
          ...mockShape('bottom-face'),
          _normal: [0, 0, -1] as [number, number, number],
          _edges: [bottomEdge],
        },
      ],
      _edges: [topEdge, bottomEdge],
    };
    useExtrudeShape(oc, shape);

    const builders: Array<{
      Add_2: ReturnType<typeof vi.fn>;
      Build: ReturnType<typeof vi.fn>;
      IsDone: () => boolean;
      NbFaultyContours: () => number;
      NbFaultyVertices: () => number;
      HasResult: () => boolean;
      Shape: () => object;
      delete: ReturnType<typeof vi.fn>;
    }> = [];
    oc.BRepFilletAPI_MakeFillet = mockConstructor(() => {
      const index = builders.length;
      const builder = {
        Add_2: vi.fn(),
        Build: vi.fn(),
        IsDone: () => index === 2,
        NbFaultyContours: () => (index === 2 ? 0 : 1),
        NbFaultyVertices: () => 0,
        HasResult: () => index === 2,
        Shape: () => filletedBottom,
        delete: vi.fn(),
      };
      builders.push(builder);
      return builder;
    });

    const bridge = makeBridge(oc);
    const result = bridge.build({
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 10),
        makeFillet('base.top.edges', 2),
        makeFillet('base.bottom.edges', 1),
      ],
      parts: [],
      baseUnitMm: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(builders).toHaveLength(3);
    expect(builders[1].Add_2).toHaveBeenCalledWith(2, topEdge);
    expect(builders[2].Add_2).toHaveBeenCalledWith(1, bottomEdge);
    expect(result.validations).toHaveLength(1);
    expect(result.validations[0].message).toMatch(/base.top.edges/);
  });

  it('retries failed fused-part fillets by source target before disconnected edge groups', () => {
    useNormalAwareFaceClassifier(oc);
    const edgeR = { ...mockShape('r-edge'), _sourceName: 'r' };
    const edgeC = { ...mockShape('c-edge'), _sourceName: 'c' };
    const shape = {
      ...mockShape('fused-shapes'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 80, yMax: 30, zMax: 12 },
      _faces: [
        {
          ...mockShape('r-top'),
          _sourceName: 'r',
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(12, 12, 10),
          _edges: [edgeR],
        },
        {
          ...mockShape('c-top'),
          _sourceName: 'c',
          _normal: [0, 0, 1] as [number, number, number],
          _center: mockPnt(40, 20, 10),
          _edges: [edgeC],
        },
      ],
      _edges: [edgeR, edgeC],
    };
    useExtrudeShapes(oc, [shape, shape, shape]);
    oc.BRepAlgoAPI_Fuse_3 = mockConstructor(() => ({
      IsDone: () => true,
      Shape: () => shape,
      Build: vi.fn(),
      delete: vi.fn(),
    }));

    const builders: Array<{
      Add_2: ReturnType<typeof vi.fn>;
      Build: ReturnType<typeof vi.fn>;
      IsDone: () => boolean;
      NbFaultyContours: () => number;
      NbFaultyVertices: () => number;
      HasResult: () => boolean;
      Shape: () => object;
      delete: ReturnType<typeof vi.fn>;
    }> = [];
    oc.BRepFilletAPI_MakeFillet = mockConstructor(() => {
      const index = builders.length;
      const builder = {
        Add_2: vi.fn(),
        Build: vi.fn(),
        IsDone: () =>
          index !== 0 || builders[index].Add_2.mock.calls.length === 1,
        NbFaultyContours: () => (index === 0 ? 1 : 0),
        NbFaultyVertices: () => 0,
        HasResult: () => index !== 0,
        Shape: () => mockShape(`target-retry-${index}`),
        delete: vi.fn(),
      };
      builders.push(builder);
      return builder;
    });

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makePart('shapes'),
        makeSketch('base'),
        makeExtrude('base', 'base', 4),
        makeSketch('r'),
        makeExtrude('r', 'r', 10),
        makeSketch('c'),
        makeExtrude('c', 'c', 10),
        { kind: 'fuse', targets: ['r', 'c'], span: SPAN },
        makeFillet('r.top.edges', 1),
        makeFillet('c.top.edges', 1),
      ],
      parts: ['shapes'],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);

    if (!result.ok) throw new Error(result.error.message);
    expect(result.ok).toBe(true);
    expect(builders).toHaveLength(3);
    expect(builders[0].Add_2).toHaveBeenCalledTimes(2);
    expect(builders[1].Add_2).toHaveBeenCalledTimes(1);
    expect(builders[2].Add_2).toHaveBeenCalledTimes(1);
  });

  it('runs chamfer phase before fillet phase even when source order is fillet then chamfer', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 10),
        makeFillet('base.top.edges', 2),
        makeChamfer('base.top.edges', 0.5),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    const chamferer = oc.BRepFilletAPI_MakeChamfer.mock.results[0]?.value;
    const filler = oc.BRepFilletAPI_MakeFillet.mock.results[0]?.value;
    expect(chamferer.Build.mock.invocationCallOrder[0]).toBeLessThan(
      filler.Build.mock.invocationCallOrder[0],
    );
  });

  it('keeps earlier cut-feature fillets before later body chamfers', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('baseSketch'),
        makeExtrude('base', 'baseSketch', 10),
        makeSketch('pocketSketch'),
        makeCut('pocket', 'pocketSketch', 'base.top', 2),
        makeFillet('pocket.top.edges', 1),
        makeChamfer('base.top.edges', 0.5),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    const filler = oc.BRepFilletAPI_MakeFillet.mock.results[0]?.value;
    const chamferer = oc.BRepFilletAPI_MakeChamfer.mock.results[0]?.value;
    expect(filler.Build.mock.invocationCallOrder[0]).toBeLessThan(
      chamferer.Build.mock.invocationCallOrder[0],
    );
  });

  it('runs drafts before chamfers and fillets', () => {
    oc.BRepGProp.SurfaceProperties_1 = vi.fn(
      (_face: { _center?: unknown }, gprops: { _centre?: unknown }) => {
        gprops._centre = mockPnt(5, 5, 10);
      },
    );
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 10),
        makeFillet('base.top.edges', 2),
        makeChamfer('base.top.edges', 0.5),
        makeDraft('base.top', 1.5),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    const drafter = oc.BRepOffsetAPI_DraftAngle_2.mock.results[0]?.value;
    const chamferer = oc.BRepFilletAPI_MakeChamfer.mock.results[0]?.value;
    const filler = oc.BRepFilletAPI_MakeFillet.mock.results[0]?.value;
    expect(drafter.Build.mock.invocationCallOrder[0]).toBeLessThan(
      chamferer.Build.mock.invocationCallOrder[0],
    );
    expect(chamferer.Build.mock.invocationCallOrder[0]).toBeLessThan(
      filler.Build.mock.invocationCallOrder[0],
    );
  });

  it('does not mix modifiers targeting different bodies into one builder', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('baseSketch'),
        makeExtrude('base', 'baseSketch', 10),
        makeSketch('lidSketch'),
        makeExtrude('lid', 'lidSketch', 2),
        makeFillet('base.top.edges', 1),
        makeFillet('lid.top.edges', 0.5),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepFilletAPI_MakeFillet).toHaveBeenCalledTimes(2);
  });

  it('dedupes duplicate same-edge same-value selections', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 10),
        makeFillet('base.top.edges', 2),
        makeFillet('base.top.edges', 2),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    const filler = oc.BRepFilletAPI_MakeFillet.mock.results[0]?.value;
    expect(filler.Add_2).toHaveBeenCalledTimes(1);
  });

  it('reports duplicate same-edge different-value selections as validations', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 10),
        makeFillet('base.top.edges', 2),
        makeFillet('base.top.edges', 1),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepFilletAPI_MakeFillet).not.toHaveBeenCalled();
    if (!result.ok) throw new Error(result.error.message);
    expect(result.validations[0]?.message).toMatch(/Conflicting fillet radii/);
    expect(result.validations[0]?.message).toMatch(/base.top.edges/);
  });

  it('fillet fails with error when target object is unknown', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [makeFillet('ghost.top.edges', 1)],
      parts: [],
      baseUnitMm: 1,
    };
    const result = bridge.build(program);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/ghost/);
  });

  it('wraps unexpected fillet exceptions as validation errors', () => {
    oc.BRepFilletAPI_MakeFillet = mockConstructor(() => {
      throw new Error('constructor exploded');
    });

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 10),
        makeFillet('base.top.edges', 1),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.validations[0]?.message).toMatch(
      /Fillet phase failed for body 'base'/,
    );
    expect(result.validations[0]?.message).toMatch(/constructor exploded/);
    expect(result.validations[0]?.span).toEqual(SPAN);
  });

  it('fillet overlap error is translated into a useful message', () => {
    oc.BRepFilletAPI_MakeFillet = mockConstructor(() => ({
      Add_2: vi.fn(),
      Build: vi.fn(() => {
        throw 17036784;
      }),
      IsDone: () => false,
      NbFaultyContours: () => 1,
      NbFaultyVertices: () => 0,
      HasResult: () => false,
      Shape: () => mockShape('fillet-result'),
      delete: vi.fn(),
    }));

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 10),
        makeFillet('base.top.edges', 2),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.validations[0]?.message).toMatch(
      /overlapping or invalid fillets/i,
    );
    expect(result.validations[0]?.message).toMatch(/17036784/);
  });

  it('fillet batch fails clearly without silently retrying a smaller radius', () => {
    const add = vi.fn();
    oc.BRepFilletAPI_MakeFillet = mockConstructor(() => ({
      Add_2: add,
      Build: vi.fn(),
      IsDone: () => false,
      NbFaultyContours: () => 1,
      NbFaultyVertices: () => 0,
      HasResult: () => false,
      Shape: () => mockShape('failed-fillet'),
      delete: vi.fn(),
    }));

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 10),
        makeFillet('base.top.edges', 2),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepFilletAPI_MakeFillet).toHaveBeenCalledTimes(1);
    expect(add).toHaveBeenCalledWith(2, expect.anything());
    if (!result.ok) throw new Error(result.error.message);
    expect(result.validations[0]?.message).toMatch(
      /Fillet phase failed for body 'base'/,
    );
    expect(result.validations[0]?.message).toMatch(/base.top.edges/);
    expect(result.validations[0]?.message).toMatch(
      /overlapping or invalid fillets/i,
    );
  });

  it('chamfer exception is translated into a validation error', () => {
    oc.BRepFilletAPI_MakeChamfer = mockConstructor(() => ({
      Add_2: vi.fn(),
      Build: vi.fn(() => {
        throw 17036784;
      }),
      IsDone: () => false,
      Shape: () => mockShape('chamfer-result'),
      delete: vi.fn(),
    }));

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('base', 's', 10),
        makeChamfer('base.top.edges', 0.5),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.validations[0]?.message).toMatch(
      /overlapping or invalid chamfers/i,
    );
    expect(result.validations[0]?.message).toMatch(/17036784/);
    expect(result.validations[0]?.span).toEqual(SPAN);
  });
});

describe('OcctBridge.build — shell', () => {
  let oc: ReturnType<typeof makeMockOC>;

  beforeEach(() => {
    oc = makeMockOC();
  });

  it('calls BRepOffsetAPI_MakeThickSolid_1 for shell op', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('body', 's', 20),
        makeShell('body', 2, ['top']),
      ],
      parts: [],
      baseUnitMm: 1,
    };
    bridge.build(program);
    expect(oc.BRepOffsetAPI_MakeThickSolid_1).toHaveBeenCalledTimes(1);
    const sheller = oc.BRepOffsetAPI_MakeThickSolid_1.mock.results[0]?.value;
    expect(sheller.MakeThickSolidByJoin).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      -2,
      1e-3,
      'BRepOffset_Skin',
      false,
      false,
      'GeomAbs_Arc',
      false,
    );
  });

  it('fails with error when shell target is unknown', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [makeShell('phantom', 2, ['top'])],
      parts: [],
      baseUnitMm: 1,
    };
    const result = bridge.build(program);
    expect(result.ok).toBe(false);
  });
});

describe('OcctBridge.build — circle sketch', () => {
  let oc: ReturnType<typeof makeMockOC>;

  beforeEach(() => {
    oc = makeMockOC();
  });

  it('calls the gp_Circ edge constructor for circle primitive', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        {
          kind: 'sketch',
          name: 'c',
          primitive: { kind: 'circle', diameter: 6 },
          placement: null,
          span: SPAN,
        },
        makeExtrude('cyl', 'c', 5),
      ],
      parts: [],
      baseUnitMm: 1,
    };
    bridge.build(program);
    expect(oc.BRepBuilderAPI_MakeEdge_8).toHaveBeenCalledTimes(1);
  });

  it('builds subtractive composite sketches as a boolean-cut face', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        {
          kind: 'sketch',
          name: 'ring',
          primitive: {
            kind: 'sketchBoolean',
            op: 'subtract',
            left: { kind: 'circle', diameter: 10 },
            right: { kind: 'circle', diameter: 8 },
          },
          placement: null,
          span: SPAN,
        },
        makeExtrude('ring', 'ring', 2),
      ],
      parts: [],
      baseUnitMm: 1,
    };
    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepAlgoAPI_Cut_3).toHaveBeenCalledTimes(1);
    expect(oc.BRepPrimAPI_MakePrism_1).toHaveBeenCalledTimes(1);
  });

  it('applies sketch-local at placement before composition', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        {
          kind: 'sketch',
          name: 'placed',
          primitive: {
            kind: 'sketchBoolean',
            op: 'add',
            left: { kind: 'circle', diameter: 10 },
            right: {
              kind: 'sketchAt',
              primitive: { kind: 'circle', diameter: 2 },
              x: 3,
              y: 0,
            },
          },
          placement: null,
          span: SPAN,
        },
        makeExtrude('placed', 'placed', 2),
      ],
      parts: [],
      baseUnitMm: 1,
    };
    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepBuilderAPI_Transform_2).toHaveBeenCalled();
    expect(oc.BRepAlgoAPI_Fuse_3).toHaveBeenCalledTimes(1);
  });
});

describe('OcctBridge.build — roundrect sketch', () => {
  let oc: ReturnType<typeof makeMockOC>;

  beforeEach(() => {
    oc = makeMockOC();
  });

  it('builds a non-degenerate rounded rectangle with four arcs and four lines', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        {
          kind: 'sketch',
          name: 'slot',
          primitive: { kind: 'roundrect', width: 10, height: 4, radius: 1 },
          placement: null,
          span: SPAN,
        },
        makeExtrude('slot', 'slot', 2),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepBuilderAPI_MakeEdge_9).toHaveBeenCalledTimes(4);
    expect(oc.BRepBuilderAPI_MakeEdge_3).toHaveBeenCalledTimes(4);
  });

  it('skips zero-length side edges for slot-shaped roundrects', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        {
          kind: 'sketch',
          name: 'slot',
          primitive: { kind: 'roundrect', width: 10, height: 4, radius: 2 },
          placement: null,
          span: SPAN,
        },
        makeExtrude('slot', 'slot', 2),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepBuilderAPI_MakeEdge_9).toHaveBeenCalledTimes(4);
    expect(oc.BRepBuilderAPI_MakeEdge_3).toHaveBeenCalledTimes(2);
  });
});

describe('OcctBridge.build — multi-part program', () => {
  let oc: ReturnType<typeof makeMockOC>;

  beforeEach(() => {
    oc = makeMockOC();
  });

  it('renders repeated alignShape placements as independent instances', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        {
          kind: 'importShape',
          name: 'motor',
          fsPath: '/shapes/imported/T21.step',
          format: 'step',
          span: SPAN,
        },
        {
          kind: 'ref',
          name: 'motor_shape',
          baseName: 'motor',
          span: SPAN,
        },
        makePart('housing'),
        {
          kind: 'alignShape',
          name: 'motor_shape',
          instanceName: 'motor_shape_0',
          sourceRef: null,
          targetPlacement: { faceRef: '0,0,0' },
          span: SPAN,
        },
        {
          kind: 'alignShape',
          name: 'motor_shape',
          instanceName: 'motor_shape_1',
          sourceRef: 'motor_shape.side.left.center',
          targetPlacement: { faceRef: 'motor_shape_0.top.center' },
          span: SPAN,
        },
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meshes).toHaveLength(1);

    const transformCalls = oc.BRepBuilderAPI_Transform_2.mock.calls;
    expect(transformCalls).toHaveLength(2);
    expect(transformCalls[0][0]).toBe(transformCalls[1][0]);
    expect(transformCalls[0][0]).not.toMatchObject({ _tag: 'trsf-face' });
  });

  it('hides declared ref object sources until they are placed', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makePart('fixture'),
        makeSketch('profile'),
        makeExtrude('body', 'profile'),
        { kind: 'declareShape', name: 'body', span: SPAN },
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meshes).toHaveLength(0);
  });

  it('renders placed declared ref object sources as instances', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makePart('fixture'),
        makeSketch('profile'),
        makeExtrude('body', 'profile'),
        { kind: 'declareShape', name: 'body', span: SPAN },
        {
          kind: 'alignShape',
          name: 'body',
          instanceName: 'body_0',
          sourceRef: 'body.bottom.center',
          targetPlacement: { faceRef: '0,0,0' },
          span: SPAN,
        },
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.meshes).toHaveLength(1);
    expect(result.meshes[0].bodyName).toBe('body_0');
  });

  it('produces one mesh per part', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makePart('base', '#2563EB'),
        makeSketch('s1'),
        makeExtrude('o1', 's1'),
        makePart('lid', '#7C3AED'),
        makeSketch('s2'),
        makeExtrude('o2', 's2'),
      ],
      parts: ['base', 'lid'],
      baseUnitMm: 1,
    };
    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.meshes).toHaveLength(2);
      expect(result.meshes[0].partName).toBe('base');
      expect(result.meshes[0].color).toBe('#2563EB');
      expect(result.meshes[1].partName).toBe('lid');
      expect(result.meshes[1].color).toBe('#7C3AED');
    }
  });

  it('auto-assigns color when part has no color', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [makePart('p', null), makeSketch('s'), makeExtrude('o', 's')],
      parts: ['p'],
      baseUnitMm: 1,
    };
    const result = bridge.build(program);
    if (result.ok) {
      expect(result.meshes[0].color).toMatch(/^#/);
    }
  });

  it('uses completed part names as placement labels for later parts', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makePart('tray'),
        makeSketch('body'),
        makeExtrude('body', 'body', 10),
        makePart('cover'),
        makeSketch('face'),
        {
          kind: 'extrude',
          objName: 'face',
          sketchName: 'face',
          depth: 2,
          from: { faceRef: 'tray.top.center' },
          symmetric: false,
          wrap: false,
          span: SPAN,
        },
      ],
      parts: ['tray', 'cover'],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    const axisZs = oc.gp_Ax2_2.mock.calls.map((call) => {
      const [loc] = call as [ReturnType<typeof mockPnt>];
      return loc?.Z?.();
    });
    expect(axisZs).toContain(10);
  });

  it('registers the final detailed part shape for cross-part placement', () => {
    oc.BRepFilletAPI_MakeFillet = mockConstructor(() => ({
      Add_2: vi.fn(),
      Build: vi.fn(),
      IsDone: () => true,
      Shape: () => ({
        ...mockShape('fillet-result'),
        _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 20, yMax: 20, zMax: 42 },
      }),
      delete: vi.fn(),
    }));

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makePart('tray'),
        makeSketch('body'),
        makeExtrude('body', 'body', 10),
        makeFillet('body.top.edges', 1),
        makePart('cover'),
        makeSketch('face'),
        {
          kind: 'extrude',
          objName: 'face',
          sketchName: 'face',
          depth: 2,
          from: { faceRef: 'tray.top.center' },
          symmetric: false,
          wrap: false,
          span: SPAN,
        },
      ],
      parts: ['tray', 'cover'],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    const axisZs = oc.gp_Ax2_2.mock.calls.map((call) => {
      const [loc] = call as [ReturnType<typeof mockPnt>];
      return loc?.Z?.();
    });
    expect(axisZs).toContain(42);
  });
});

describe('OcctBridge.build — error span propagation', () => {
  let oc: ReturnType<typeof makeMockOC>;

  beforeEach(() => {
    oc = makeMockOC();
  });

  it('error includes source span', () => {
    const bridge = makeBridge(oc);
    const badSpan = { file: 'main.bscd', line: 42, col: 5 };
    const program: IRProgram = {
      ops: [
        {
          kind: 'sketch',
          name: 'h',
          primitive: { kind: 'circle', diameter: 3 },
          placement: null,
          span: SPAN,
        } as IRSketch,
        {
          kind: 'cut',
          objName: 'h',
          sketchName: 'h',
          through: true,
          depth: null,
          from: { faceRef: 'ghost.top' },
          wrap: false,
          span: badSpan,
        } as IRCut,
      ],
      parts: [],
      baseUnitMm: 1,
    };
    const result = bridge.build(program);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.span.line).toBe(42);
      expect(result.error.span.file).toBe('main.bscd');
    }
  });
});

describe('OcctBridge.build — extrude with unknown sketch', () => {
  let oc: ReturnType<typeof makeMockOC>;

  beforeEach(() => {
    oc = makeMockOC();
  });

  it('returns error for missing sketch in extrude', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [makeExtrude('obj', 'noSuchSketch', 5)],
      parts: [],
      baseUnitMm: 1,
    };
    const result = bridge.build(program);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/noSuchSketch/);
  });
});

describe('OcctBridge.build — symmetric extrude', () => {
  let oc: ReturnType<typeof makeMockOC>;

  beforeEach(() => {
    oc = makeMockOC();
  });

  it('calls gp_Trsf_1 for centering when symmetric=true', () => {
    const bridge = makeBridge(oc);
    const op: IRExtrude = {
      kind: 'extrude',
      objName: 'obj',
      sketchName: 's',
      depth: 10,
      from: null,
      symmetric: true,
      wrap: false,
      span: SPAN,
    };
    const program: IRProgram = {
      ops: [makeSketch('s'), op],
      parts: [],
      baseUnitMm: 1,
    };
    bridge.build(program);
    expect(oc.gp_Trsf_1).toHaveBeenCalled();
  });
});

describe('OcctBridge.build - draft', () => {
  let oc: ReturnType<typeof makeMockOC>;

  beforeEach(() => {
    oc = makeMockOC();
  });

  it('passes the explicit Add flag required by the OpenCascade.js binding', () => {
    oc.BRepGProp.SurfaceProperties_1 = vi.fn(
      (_face: { _center?: unknown }, gprops: { _centre?: unknown }) => {
        gprops._centre = mockPnt(5, 5, 10);
      },
    );
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('body', 's', 20),
        makeDraft('body.top', 1.5),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    bridge.build(program);
    expect(oc.BRepOffsetAPI_DraftAngle_2).toHaveBeenCalledTimes(1);
    const drafter = oc.BRepOffsetAPI_DraftAngle_2.mock.results[0]?.value;
    expect(drafter.Add).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      (1.5 * Math.PI) / 180,
      expect.anything(),
      false,
    );
  });

  it('drafts every matching face fragment for a side target', () => {
    useNormalAwareFaceClassifier(oc);
    const frontA = {
      ...mockShape('front-a'),
      _normal: [0, -1, 0] as [number, number, number],
      _center: mockPnt(2, 0, 5),
    };
    const frontB = {
      ...mockShape('front-b'),
      _normal: [0, -1, 0] as [number, number, number],
      _center: mockPnt(8, 0, 5),
    };
    const shape = {
      ...mockShape('cut-body'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [frontA, frontB],
    };
    useExtrudeShape(oc, shape);

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('body', 's', 20),
        makeDraft('body.side.front', 2),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    const drafter = oc.BRepOffsetAPI_DraftAngle_2.mock.results[0]?.value;
    expect(drafter.Add).toHaveBeenCalledTimes(2);
    expect(drafter.Add).toHaveBeenNthCalledWith(
      1,
      frontA,
      expect.anything(),
      (2 * Math.PI) / 180,
      expect.anything(),
      false,
    );
    expect(drafter.Add).toHaveBeenNthCalledWith(
      2,
      frontB,
      expect.anything(),
      (2 * Math.PI) / 180,
      expect.anything(),
      false,
    );
  });

  it('drafts all four side directions for a sides target', () => {
    useNormalAwareFaceClassifier(oc);
    const front = {
      ...mockShape('front'),
      _normal: [0, -1, 0] as [number, number, number],
      _center: mockPnt(5, 0, 5),
    };
    const back = {
      ...mockShape('back'),
      _normal: [0, 1, 0] as [number, number, number],
      _center: mockPnt(5, 10, 5),
    };
    const left = {
      ...mockShape('left'),
      _normal: [-1, 0, 0] as [number, number, number],
      _center: mockPnt(0, 5, 5),
    };
    const right = {
      ...mockShape('right'),
      _normal: [1, 0, 0] as [number, number, number],
      _center: mockPnt(10, 5, 5),
    };
    const top = {
      ...mockShape('top'),
      _normal: [0, 0, 1] as [number, number, number],
      _center: mockPnt(5, 5, 10),
    };
    const shape = {
      ...mockShape('body'),
      _bbox: { xMin: 0, yMin: 0, zMin: 0, xMax: 10, yMax: 10, zMax: 10 },
      _faces: [front, back, left, right, top],
    };
    useExtrudeShape(oc, shape);

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        makeSketch('s'),
        makeExtrude('body', 's', 20),
        makeDraft('body.sides', 2),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    const drafter = oc.BRepOffsetAPI_DraftAngle_2.mock.results[0]?.value;
    expect(drafter.Add).toHaveBeenCalledTimes(4);
    expect(drafter.Add).toHaveBeenCalledWith(
      front,
      expect.anything(),
      (2 * Math.PI) / 180,
      expect.anything(),
      false,
    );
    expect(drafter.Add).toHaveBeenCalledWith(
      back,
      expect.anything(),
      (2 * Math.PI) / 180,
      expect.anything(),
      false,
    );
    expect(drafter.Add).toHaveBeenCalledWith(
      left,
      expect.anything(),
      (2 * Math.PI) / 180,
      expect.anything(),
      false,
    );
    expect(drafter.Add).toHaveBeenCalledWith(
      right,
      expect.anything(),
      (2 * Math.PI) / 180,
      expect.anything(),
      false,
    );
  });
});

describe('OcctBridge.build — word sketch', () => {
  let oc: ReturnType<typeof makeMockOC>;

  beforeEach(() => {
    oc = makeMockOC();
  });

  it('builds serif alias text from the bundled serif font path', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        {
          kind: 'sketch',
          name: 'lbl',
          primitive: {
            kind: 'word',
            text: 'Hi',
            size: 5,
            font: 'Times New Roman',
            align: 'center',
          },
          placement: null,
          span: SPAN,
        } as IRSketch,
        makeExtrude('engrave', 'lbl', 0.5),
      ],
      parts: [],
      baseUnitMm: 1,
    };
    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(oc.BRepBuilderAPI_MakeEdge_3).not.toHaveBeenCalled();
    expect(oc.StdPrs_BRepFont_1).toHaveBeenCalledTimes(1);
    expect(oc.StdPrs_BRepTextBuilder).toHaveBeenCalledTimes(1);
    const font = oc.StdPrs_BRepFont_1.mock.results[0]?.value;
    expect(font.Init_1).toHaveBeenCalledWith(
      expect.objectContaining({ _value: OCCT_FALLBACK_SERIF_FONT_PATH }),
      5,
      0,
    );
    const builder = oc.StdPrs_BRepTextBuilder.mock.results[0]?.value;
    expect(builder.Perform_2).toHaveBeenCalledWith(
      font,
      expect.objectContaining({ _value: 'Hi' }),
      expect.anything(),
      oc.Graphic3d_HorizontalTextAlignment.Graphic3d_HTA_CENTER,
      oc.Graphic3d_VerticalTextAlignment.Graphic3d_VTA_CENTER,
    );
    expect(oc.NCollection_Utf8String_4).toHaveBeenCalledWith(
      OCCT_FALLBACK_SERIF_FONT_PATH,
      OCCT_FALLBACK_SERIF_FONT_PATH.length,
    );
    expect(oc.NCollection_Utf8String_4).toHaveBeenCalledWith('Hi', 2);
  });

  it('passes right alignment through to the OpenCascade text builder with bundled sans fonts', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        {
          kind: 'sketch',
          name: 'lbl',
          primitive: {
            kind: 'word',
            text: 'Hi',
            size: 5,
            font: 'Arial',
            align: 'right',
          },
          placement: null,
          span: SPAN,
        } as IRSketch,
        makeExtrude('engrave', 'lbl', 0.5),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    const font = oc.StdPrs_BRepFont_1.mock.results[0]?.value;
    const builder = oc.StdPrs_BRepTextBuilder.mock.results[0]?.value;
    expect(builder.Perform_2).toHaveBeenCalledWith(
      font,
      expect.objectContaining({ _value: 'Hi' }),
      expect.anything(),
      oc.Graphic3d_HorizontalTextAlignment.Graphic3d_HTA_RIGHT,
      oc.Graphic3d_VerticalTextAlignment.Graphic3d_VTA_CENTER,
    );
  });

  it('builds mono alias text from the bundled mono font path', () => {
    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        {
          kind: 'sketch',
          name: 'lbl',
          primitive: {
            kind: 'word',
            text: 'Hi',
            size: 5,
            font: 'mono',
            align: 'center',
          },
          placement: null,
          span: SPAN,
        } as IRSketch,
        makeExtrude('engrave', 'lbl', 0.5),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    const font = oc.StdPrs_BRepFont_1.mock.results[0]?.value;
    expect(font.Init_1).toHaveBeenCalledWith(
      expect.objectContaining({ _value: OCCT_FALLBACK_MONO_FONT_PATH }),
      5,
      0,
    );
  });

  it('writes and uses imported font assets by exact OCCT FS path', () => {
    const bridge = makeBridge(oc);
    const font = {
      kind: 'fontAsset' as const,
      name: 'brand',
      sourcePath: 'C:/workspace/fonts/Brand.ttf',
      fsPath: '/fonts/imported/C_workspace_fonts_Brand.ttf',
    };
    const program: IRProgram = {
      ops: [
        {
          kind: 'sketch',
          name: 'lbl',
          primitive: {
            kind: 'word',
            text: 'Hi',
            size: 5,
            font,
            align: 'center',
          },
          placement: null,
          span: SPAN,
        } as IRSketch,
        makeExtrude('engrave', 'lbl', 0.5),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program, {
      fonts: [{ ...font, data: new Uint8Array([1, 2, 3]) }],
      shapes: [],
    });

    expect(result.ok).toBe(true);
    expect(oc.FS.mkdir).toHaveBeenCalledWith('/fonts');
    expect(oc.FS.mkdir).toHaveBeenCalledWith('/fonts/imported');
    expect(oc.FS.writeFile).toHaveBeenCalledWith(
      font.fsPath,
      new Uint8Array([1, 2, 3]),
    );
    const loaded = oc.StdPrs_BRepFont_1.mock.results[0]?.value;
    expect(loaded.Init_1).toHaveBeenCalledWith(
      expect.objectContaining({ _value: font.fsPath }),
      5,
      0,
    );
    expect(loaded.Init_2).not.toHaveBeenCalled();
  });

  it('fails hard when an imported font cannot be initialized', () => {
    const importedFont = {
      Init_1: vi.fn().mockReturnValue(false),
      Init_2: vi.fn().mockReturnValue(false),
      delete: vi.fn(),
    };
    oc.StdPrs_BRepFont_1.mockImplementation(function () {
      return importedFont;
    });

    const bridge = makeBridge(oc);
    const font = {
      kind: 'fontAsset' as const,
      name: 'brand',
      sourcePath: 'C:/workspace/fonts/Brand.ttf',
      fsPath: '/fonts/imported/C_workspace_fonts_Brand.ttf',
    };
    const program: IRProgram = {
      ops: [
        {
          kind: 'sketch',
          name: 'lbl',
          primitive: { kind: 'word', text: 'Hi', size: 5, font, align: 'left' },
          placement: null,
          span: SPAN,
        } as IRSketch,
        makeExtrude('engrave', 'lbl', 0.5),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program, {
      fonts: [{ ...font, data: new Uint8Array([1, 2, 3]) }],
      shapes: [],
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.message).toContain("imported font 'brand'");
    expect(oc.StdPrs_BRepFont_1).toHaveBeenCalledTimes(1);
    expect(importedFont.Init_2).not.toHaveBeenCalled();
  });

  it('falls back to the bundled font path when the requested font cannot be initialized', () => {
    const missingFont = {
      Init_1: vi.fn().mockReturnValue(false),
      Init_2: vi.fn().mockReturnValue(false),
      delete: vi.fn(),
    };
    const fallbackFont = {
      Init_1: vi.fn().mockReturnValue(true),
      Init_2: vi.fn().mockReturnValue(false),
      delete: vi.fn(),
    };
    oc.StdPrs_BRepFont_1.mockImplementationOnce(function () {
      return missingFont;
    }).mockImplementationOnce(function () {
      return fallbackFont;
    });

    const bridge = makeBridge(oc);
    const program: IRProgram = {
      ops: [
        {
          kind: 'sketch',
          name: 'lbl',
          primitive: {
            kind: 'word',
            text: 'Hi',
            size: 5,
            font: 'Missing Display',
            align: 'left',
          },
          placement: null,
          span: SPAN,
        } as IRSketch,
        makeExtrude('engrave', 'lbl', 0.5),
      ],
      parts: [],
      baseUnitMm: 1,
    };

    const result = bridge.build(program);
    expect(result.ok).toBe(true);
    expect(missingFont.Init_2).toHaveBeenCalledWith(
      expect.objectContaining({ _value: 'Missing Display' }),
      expect.any(Number),
      5,
    );
    expect(fallbackFont.Init_1).toHaveBeenCalledWith(
      expect.objectContaining({ _value: OCCT_FALLBACK_FONT_PATH }),
      5,
      0,
    );
    const builder = oc.StdPrs_BRepTextBuilder.mock.results[0]?.value;
    expect(builder.Perform_2).toHaveBeenCalledWith(
      fallbackFont,
      expect.objectContaining({ _value: 'Hi' }),
      expect.anything(),
      oc.Graphic3d_HorizontalTextAlignment.Graphic3d_HTA_LEFT,
      oc.Graphic3d_VerticalTextAlignment.Graphic3d_VTA_CENTER,
    );
  });
});
