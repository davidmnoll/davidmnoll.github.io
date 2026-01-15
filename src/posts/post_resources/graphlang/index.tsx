import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface GraphNode {
  id: string;
  label: string;
  annotation?: string;
}

interface GraphEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  address?: string;
}

interface GraphDefinition {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rootId?: string;
  description?: string;
}

type NatExpr = { kind: 'zero' } | { kind: 'succ' | 'decr'; inner: NatExpr };
type ListExpr = { kind: 'nil' } | { kind: 'cons'; head: NatExpr; tail: ListExpr };
type AddressingScheme = 'hilbert' | 'morton';
type BoolMatrix = boolean[][];

const MATRIX_LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const createMatrix = (size: number): BoolMatrix =>
  Array.from({ length: size }, () => Array.from({ length: size }, () => false));

const adjustMatrix = (matrix: BoolMatrix, size: number): BoolMatrix => {
  const next = createMatrix(size);
  for (let row = 0; row < Math.min(matrix.length, size); row += 1) {
    for (let col = 0; col < Math.min(matrix[row].length, size); col += 1) {
      next[row][col] = matrix[row][col];
    }
  }
  return next;
};

const matrixLabel = (index: number) => MATRIX_LABELS[index] ?? `N${index + 1}`;

const createBoolMatrix = (rows: number, cols: number, fill = false): BoolMatrix =>
  Array.from({ length: rows }, () => Array.from({ length: cols }, () => fill));

const identityBoolMatrix = (size: number): BoolMatrix => {
  const matrix = createBoolMatrix(size, size, false);
  for (let i = 0; i < size; i += 1) {
    matrix[i][i] = true;
  }
  return matrix;
};

const booleanMatrixOr = (a: BoolMatrix, b: BoolMatrix): BoolMatrix =>
  a.map((row, rowIndex) => row.map((value, colIndex) => value || b[rowIndex][colIndex]));

const booleanMatrixEqual = (a: BoolMatrix, b: BoolMatrix) =>
  a.length === b.length &&
  a[0]?.length === b[0]?.length &&
  a.every((row, rowIndex) => row.every((value, colIndex) => value === b[rowIndex][colIndex]));

const booleanMatrixMultiply = (a: BoolMatrix, b: BoolMatrix): BoolMatrix => {
  const rows = a.length;
  const cols = b[0]?.length ?? 0;
  const result = createBoolMatrix(rows, cols, false);
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      let value = false;
      for (let k = 0; k < b.length; k += 1) {
        if (a[i][k] && b[k][j]) {
          value = true;
          break;
        }
      }
      result[i][j] = value;
    }
  }
  return result;
};

const booleanMatrixTranspose = (matrix: BoolMatrix): BoolMatrix => {
  const rows = matrix.length;
  const cols = matrix[0]?.length ?? 0;
  const result = createBoolMatrix(cols, rows, false);
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      result[j][i] = matrix[i][j];
    }
  }
  return result;
};

const booleanMatrixTensor = (a: BoolMatrix, b: BoolMatrix): BoolMatrix => {
  const rows = a.length * b.length;
  const cols = (a[0]?.length ?? 0) * (b[0]?.length ?? 0);
  const result = createBoolMatrix(rows, cols, false);
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < (a[0]?.length ?? 0); j += 1) {
      if (!a[i][j]) continue;
      for (let m = 0; m < b.length; m += 1) {
        for (let n = 0; n < (b[0]?.length ?? 0); n += 1) {
          if (!b[m][n]) continue;
          const row = i * b.length + m;
          const col = j * (b[0]?.length ?? 0) + n;
          result[row][col] = true;
        }
      }
    }
  }
  return result;
};

const sliceMatrix = (
  matrix: BoolMatrix,
  rowStart: number,
  rowEnd: number,
  colStart: number,
  colEnd: number,
): BoolMatrix => {
  const rows = rowEnd - rowStart;
  const cols = colEnd - colStart;
  const result = createBoolMatrix(rows, cols, false);
  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      result[i][j] = matrix[rowStart + i][colStart + j];
    }
  }
  return result;
};

const reflexiveTransitiveClosure = (matrix: BoolMatrix): BoolMatrix => {
  const size = matrix.length;
  let closure = booleanMatrixOr(identityBoolMatrix(size), matrix);
  let changed = true;
  while (changed) {
    const next = booleanMatrixOr(closure, booleanMatrixMultiply(closure, matrix));
    changed = !booleanMatrixEqual(next, closure);
    closure = next;
  }
  return closure;
};

const mortonAddress = (row: number, col: number, size: number) => row * size + col;

const hilbertAddress = (row: number, col: number, size: number) => {
  const maxDimension = Math.max(size, size);
  const order = Math.max(1, Math.ceil(Math.log2(maxDimension)));
  const dimension = 1 << order;
  let x = Math.min(col, dimension - 1);
  let y = Math.min(row, dimension - 1);
  let index = 0;
  for (let i = order - 1; i >= 0; i -= 1) {
    const rx = (x >> i) & 1;
    const ry = (y >> i) & 1;
    const digit = (3 * rx) ^ ry;
    index += digit << (2 * i);
    if (ry === 0) {
      if (rx === 1) {
        x = dimension - 1 - x;
        y = dimension - 1 - y;
      }
      const temp = x;
      x = y;
      y = temp;
    }
  }
  return index;
};

const computeAddress = (row: number, col: number, size: number, scheme: AddressingScheme) => {
  if (scheme === 'morton') {
    return mortonAddress(row, col, size);
  }
  return hilbertAddress(row, col, size);
};

const schemeDescription = (scheme: AddressingScheme) =>
  scheme === 'hilbert' ? 'Hilbert curve' : 'Morton (row-major)';

const matrixToGraph = (matrix: BoolMatrix, scheme: AddressingScheme): GraphDefinition => {
  const nodes: GraphNode[] = matrix.map((_, index) => ({
    id: `matrix-node-${index}`,
    label: matrixLabel(index),
    annotation: `Node ${index}`,
  }));
  const edges: GraphEdge[] = [];
  const size = matrix.length;
  matrix.forEach((rowValues, row) => {
    rowValues.forEach((value, col) => {
      if (!value) return;
      const address = computeAddress(row, col, size, scheme);
      edges.push({
        id: `matrix-edge-${row}-${col}`,
        from: nodes[row].id,
        to: nodes[col].id,
        label: `${matrixLabel(row)} → ${matrixLabel(col)}`,
        address: `${schemeDescription(scheme)} Φ = ${address}`,
      });
    });
  });
  return { nodes, edges };
};

const computeWitnessIndices = (matrix: BoolMatrix, boundary: number) => {
  const total = matrix.length;
  const visited = new Set<number>();
  const queue: number[] = [];
  for (let i = 0; i < Math.min(boundary, total); i += 1) {
    queue.push(i);
    visited.add(i);
  }
  while (queue.length > 0) {
    const node = queue.shift()!;
    for (let col = 0; col < total; col += 1) {
      if (!matrix[node][col] || visited.has(col)) continue;
      visited.add(col);
      queue.push(col);
    }
  }
  return Array.from(visited)
    .filter(index => index >= boundary)
    .map(index => index - boundary)
    .sort((a, b) => a - b);
};

const computeCategoricalTrace = (matrix: BoolMatrix, objectSize: number) => {
  const total = matrix.length;
  if (objectSize <= 0 || objectSize >= total) {
    return {
      traced: sliceMatrix(matrix, 0, Math.min(objectSize, total), 0, Math.min(objectSize, total)),
      witnesses: [],
    };
  }
  const blockAA = sliceMatrix(matrix, 0, objectSize, 0, objectSize);
  const blockAU = sliceMatrix(matrix, 0, objectSize, objectSize, total);
  const blockUA = sliceMatrix(matrix, objectSize, total, 0, objectSize);
  const blockUU = sliceMatrix(matrix, objectSize, total, objectSize, total);
  const loopClosure = reflexiveTransitiveClosure(blockUU);
  const mediated = booleanMatrixMultiply(booleanMatrixMultiply(blockAU, loopClosure), blockUA);
  const traced = booleanMatrixOr(blockAA, mediated);
  return {
    traced,
    witnesses: computeWitnessIndices(matrix, objectSize),
  };
};

const tokenize = (input: string) => input.toLowerCase().match(/[a-z]+|\(|\)|,|\[|\]/g) ?? [];

const parseNatExpression = (input: string): NatExpr => {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Provide a nat expression.');
  if (/^[+-]?\d+$/.test(trimmed)) {
    const value = Number.parseInt(trimmed, 10);
    return numberToNatExpr(value);
  }

  const tokens = tokenize(trimmed);
  let index = 0;

  const parseNat = (): NatExpr => {
    const token = tokens[index];
    if (!token) {
      throw new Error('Unexpected end of expression while parsing nat.');
    }
    if (token === 'zero') {
      index += 1;
      return { kind: 'zero' };
    }
    if (token === 'succ' || token === 'decr') {
      index += 1;
      const hasParen = tokens[index] === '(';
      if (hasParen) index += 1;
      const inner = parseNat();
      if (hasParen) {
        if (tokens[index] !== ')') {
          throw new Error(`Missing closing parenthesis for ${token}.`);
        }
        index += 1;
      }
      return { kind: token, inner };
    }
    throw new Error(`Unexpected token "${token}" in nat expression.`);
  };

  const result = parseNat();
  if (index < tokens.length) {
    throw new Error('Could not parse full nat expression.');
  }
  return result;
};

const parseListConstructorExpression = (input: string): ListExpr => {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Provide a list expression.');
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const items = trimmed
      .slice(1, -1)
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
    const natItems = items.map(item => parseNatExpression(item));
    return natItems.reduceRight<ListExpr>(
      (tail, head) => ({ kind: 'cons', head, tail }),
      { kind: 'nil' },
    );
  }

  const tokens = tokenize(trimmed);
  let index = 0;

  const expect = (value: string) => {
    if (tokens[index] !== value) {
      throw new Error(`Expected "${value}" but found "${tokens[index] ?? 'end of input'}".`);
    }
    index += 1;
  };

  const parseNat = (): NatExpr => {
    const token = tokens[index];
    if (!token) throw new Error('Unexpected end of expression while parsing nat in list.');
    if (token === 'zero') {
      index += 1;
      return { kind: 'zero' };
    }
    if (token === 'succ' || token === 'decr') {
      index += 1;
      const hasParen = tokens[index] === '(';
      if (hasParen) index += 1;
      const inner = parseNat();
      if (hasParen) {
        expect(')');
      }
      return { kind: token, inner };
    }
    throw new Error(`Unexpected token "${token}" inside list head.`);
  };

  const parseList = (): ListExpr => {
    const token = tokens[index];
    if (!token) throw new Error('Unexpected end of expression while parsing list.');
    if (token === 'nil') {
      index += 1;
      return { kind: 'nil' };
    }
    if (token === 'cons') {
      index += 1;
      if (tokens[index] === '(') {
        index += 1;
      }
      const head = parseNat();
      if (tokens[index] === ',') {
        index += 1;
      } else {
        throw new Error('List constructor requires a comma between head and tail.');
      }
      const tail = parseList();
      if (tokens[index] === ')') {
        index += 1;
      }
      return { kind: 'cons', head, tail };
    }
    throw new Error(`Unexpected token "${token}" in list expression.`);
  };

  const result = parseList();
  if (index < tokens.length) {
    throw new Error('Could not parse full list expression.');
  }
  return result;
};

const stringifyNat = (expr: NatExpr): string => {
  if (expr.kind === 'zero') return 'zero';
  return `${expr.kind}(${stringifyNat(expr.inner)})`;
};

const stringifyList = (expr: ListExpr): string => {
  const items = listToArray(expr).map(item => stringifyNat(item));
  return `[${items.join(', ')}]`;
};

const cloneNat = (expr: NatExpr): NatExpr => {
  if (expr.kind === 'zero') return { kind: 'zero' };
  return { kind: expr.kind, inner: cloneNat(expr.inner) };
};

const listToArray = (expr: ListExpr): NatExpr[] => {
  const result: NatExpr[] = [];
  let current = expr;
  while (current.kind === 'cons') {
    result.push(current.head);
    current = current.tail;
  }
  return result;
};

const arrayToList = (values: NatExpr[]): ListExpr =>
  values.reduceRight<ListExpr>(
    (tail, head) => ({ kind: 'cons', head: cloneNat(head), tail }),
    { kind: 'nil' },
  );

const evaluateNat = (expr: NatExpr): number => {
  if (expr.kind === 'zero') return 0;
  const value = evaluateNat(expr.inner);
  return expr.kind === 'succ' ? value + 1 : value - 1;
};

const numberToNatExpr = (value: number): NatExpr => {
  const base: NatExpr = { kind: 'zero' };
  if (value === 0) return base;
  let result: NatExpr = base;
  const direction: NatExpr['kind'] = value > 0 ? 'succ' : 'decr';
  for (let i = 0; i < Math.abs(value); i += 1) {
    result = { kind: direction, inner: result };
  }
  return result;
};

const stringToListExpr = (input: string): ListExpr => {
  const chars = Array.from(input);
  const natValues = chars.map(char => numberToNatExpr(char.codePointAt(0) ?? 0));
  return arrayToList(natValues);
};

const createGraphBuilder = () => {
  let nodeCounter = 0;
  let edgeCounter = 0;
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const createNode = (label: string, annotation?: string) => {
    const id = `graph-node-${nodeCounter += 1}`;
    nodes.push({ id, label, annotation });
    return id;
  };
  const link = (from: string, to: string, label?: string) => {
    const id = `graph-edge-${edgeCounter += 1}`;
    edges.push({ id, from, to, label });
  };
  return {
    nodes,
    edges,
    createNode,
    link,
  };
};

const visitNatGraph = (expr: NatExpr, builder: ReturnType<typeof createGraphBuilder>): string => {
  if (expr.kind === 'zero') {
    return builder.createNode('Zero', 'Base');
  }
  const childId = visitNatGraph(expr.inner, builder);
  const label = expr.kind === 'succ' ? 'Succ' : 'Decr';
  const nodeId = builder.createNode(label);
  builder.link(nodeId, childId, 'input');
  return nodeId;
};

const buildNatGraph = (expr: NatExpr): GraphDefinition => {
  const builder = createGraphBuilder();
  const rootId = visitNatGraph(expr, builder);
  return {
    nodes: builder.nodes,
    edges: builder.edges,
    rootId,
    description: `Value = ${evaluateNat(expr)}`,
  };
};

const visitListGraph = (expr: ListExpr, builder: ReturnType<typeof createGraphBuilder>): string => {
  if (expr.kind === 'nil') {
    return builder.createNode('Nil', 'Empty list');
  }
  const headId = visitNatGraph(expr.head, builder);
  const tailId = visitListGraph(expr.tail, builder);
  const consId = builder.createNode('Cons');
  builder.link(consId, headId, 'head');
  builder.link(consId, tailId, 'tail');
  return consId;
};

const buildListGraph = (expr: ListExpr): GraphDefinition => {
  const builder = createGraphBuilder();
  const rootId = visitListGraph(expr, builder);
  const items = listToArray(expr).map(value => evaluateNat(value));
  return {
    nodes: builder.nodes,
    edges: builder.edges,
    rootId,
    description: `Items = [${items.join(', ')}]`,
  };
};

const GraphSummary = ({ title, graph }: { title: string; graph: GraphDefinition | null }) => (
  <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-sm text-white">
    <h4 className="text-lg font-semibold">{title}</h4>
    {!graph && <p className="mt-2 text-foreground/60">No data yet.</p>}
    {graph && (
      <div className="mt-3 space-y-3">
        {graph.rootId && (
          <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">
            Root node: {graph.nodes.find(node => node.id === graph.rootId)?.label ?? graph.rootId}
          </p>
        )}
        {graph.description && <p className="text-foreground/70">{graph.description}</p>}
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">Nodes ({graph.nodes.length})</p>
          <ul className="mt-2 space-y-1">
            {graph.nodes.map(node => (
              <li key={node.id} className="rounded-xl border border-white/10 px-3 py-2">
                <p className="font-medium">{node.label}</p>
                {node.annotation && <p className="text-xs text-foreground/60">{node.annotation}</p>}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">Edges ({graph.edges.length})</p>
          <ul className="mt-2 space-y-1">
            {graph.edges.map(edge => (
              <li key={edge.id} className="rounded-xl border border-white/10 px-3 py-2">
                <p className="font-medium">
                  {edge.from} → {edge.to}
                </p>
                {(edge.label || edge.address) && (
                  <p className="text-xs text-foreground/60">
                    {[edge.label, edge.address].filter(Boolean).join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )}
  </div>
);

const StatusPill = ({ label, ok }: { label: string; ok: boolean }) => (
  <span
    className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.3em] ${
      ok ? 'border-emerald-400/50 text-emerald-200' : 'border-rose-400/50 text-rose-200'
    }`}
  >
    {label}: {ok ? 'true' : 'false'}
  </span>
);

const MatrixPreview = ({ title, matrix }: { title: string; matrix: BoolMatrix }) => (
  <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-white">
    <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/50">{title}</p>
    {matrix.length === 0 ? (
      <p className="text-xs text-foreground/60">Empty matrix.</p>
    ) : (
      <div className="mt-2 overflow-auto">
        <table className="min-w-[120px] border-collapse text-center text-xs">
          <tbody>
            {matrix.map((row, rowIndex) => (
              <tr key={`matrix-row-${rowIndex}`}>
                {row.map((cell, colIndex) => (
                  <td key={`matrix-cell-${rowIndex}-${colIndex}`} className="border border-white/10 px-2 py-1 text-white/80">
                    {cell ? '1' : '0'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const SectionCard = ({ title, children, subtitle }: { title: string; children: React.ReactNode; subtitle?: string }) => (
  <section className="rounded-3xl border border-white/10 bg-black/30 p-6 text-white">
    <header className="mb-4">
      <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">{title}</p>
      {subtitle && <p className="mt-1 text-sm text-foreground/60">{subtitle}</p>}
    </header>
    {children}
  </section>
);

export const GraphLangPlayground = () => {
  const [matrixSize, setMatrixSize] = useState(4);
  const [matrix, setMatrix] = useState<boolean[][]>(() => createMatrix(4));
  const [addressingScheme, setAddressingScheme] = useState<AddressingScheme>('hilbert');
  const [natInput, setNatInput] = useState('succ(succ(zero))');
  const [listInput, setListInput] = useState('[zero, succ(zero), succ(succ(zero))]');
  const [stringInput, setStringInput] = useState('hi');
  const [traceObjectSize, setTraceObjectSize] = useState(() => Math.min(2, Math.max(1, 4 - 1)));

  const natParse = useMemo(() => {
    try {
      return { expr: parseNatExpression(natInput), error: null as string | null };
    } catch (error) {
      return { expr: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [natInput]);
  const natAst = natParse.expr;
  const natError = natParse.error;

  const listParse = useMemo(() => {
    try {
      return { expr: parseListConstructorExpression(listInput), error: null as string | null };
    } catch (error) {
      return { expr: null, error: error instanceof Error ? error.message : String(error) };
    }
  }, [listInput]);
  const listAst = listParse.expr;
  const listError = listParse.error;

  const stringAst = useMemo(() => stringToListExpr(stringInput), [stringInput]);

  const matrixGraph = useMemo(
    () => matrixToGraph(matrix, addressingScheme),
    [matrix, addressingScheme],
  );
  const natGraph = useMemo(() => (natAst ? buildNatGraph(natAst) : null), [natAst]);
  const listGraph = useMemo(() => (listAst ? buildListGraph(listAst) : null), [listAst]);
  const stringGraph = useMemo(() => buildListGraph(stringAst), [stringAst]);
  const identityMatrixMemo = useMemo(() => identityBoolMatrix(matrixSize), [matrixSize]);
  const composeLeft = useMemo(() => booleanMatrixMultiply(matrix, identityMatrixMemo), [matrix, identityMatrixMemo]);
  const composeRight = useMemo(
    () => booleanMatrixMultiply(identityMatrixMemo, matrix),
    [matrix, identityMatrixMemo],
  );
  const monoidIdentityHolds = useMemo(
    () => booleanMatrixEqual(composeLeft, matrix) && booleanMatrixEqual(composeRight, matrix),
    [composeLeft, composeRight, matrix],
  );
  const tripleComposeLeft = useMemo(
    () => booleanMatrixMultiply(booleanMatrixMultiply(matrix, matrix), matrix),
    [matrix],
  );
  const tripleComposeRight = useMemo(
    () => booleanMatrixMultiply(matrix, booleanMatrixMultiply(matrix, matrix)),
    [matrix],
  );
  const monoidAssociativityHolds = useMemo(
    () => booleanMatrixEqual(tripleComposeLeft, tripleComposeRight),
    [tripleComposeLeft, tripleComposeRight],
  );
  const daggerMatrix = useMemo(() => booleanMatrixTranspose(matrix), [matrix]);
  const daggerInvolution = useMemo(
    () => booleanMatrixEqual(booleanMatrixTranspose(daggerMatrix), matrix),
    [daggerMatrix, matrix],
  );
  const daggerCompositionPreserved = useMemo(() => {
    const composed = booleanMatrixMultiply(matrix, daggerMatrix);
    const dagComposed = booleanMatrixTranspose(composed);
    const reversed = booleanMatrixMultiply(booleanMatrixTranspose(daggerMatrix), booleanMatrixTranspose(matrix));
    return booleanMatrixEqual(dagComposed, reversed);
  }, [matrix, daggerMatrix]);
  const tensorSelf = useMemo(() => booleanMatrixTensor(matrix, matrix), [matrix]);
  const effectiveTraceObjectSize = Math.min(
    traceObjectSize,
    Math.max(1, matrixSize > 1 ? matrixSize - 1 : 1),
  );
  const traceArtifacts = useMemo(
    () => computeCategoricalTrace(matrix, matrixSize > 1 ? effectiveTraceObjectSize : matrixSize),
    [effectiveTraceObjectSize, matrix, matrixSize],
  );
  const traceMatrix = traceArtifacts.traced;
  const traceWitnessNatExpr = useMemo(
    () => numberToNatExpr(traceArtifacts.witnesses.length),
    [traceArtifacts.witnesses.length],
  );
  const traceNatGraph = useMemo(() => buildNatGraph(traceWitnessNatExpr), [traceWitnessNatExpr]);
  const traceListExpr = useMemo(
    () => arrayToList(traceArtifacts.witnesses.map(value => numberToNatExpr(value + 1))),
    [traceArtifacts.witnesses],
  );
  const traceListGraph = useMemo(() => buildListGraph(traceListExpr), [traceListExpr]);
  const traceStringValue = useMemo(
    () => traceArtifacts.witnesses.map(value => String.fromCharCode(97 + value)).join(''),
    [traceArtifacts.witnesses],
  );
  useEffect(() => {
    setTraceObjectSize(current => {
      if (matrixSize <= 1) return 1;
      const maxSize = Math.max(1, matrixSize - 1);
      return Math.min(current, maxSize);
    });
  }, [matrixSize]);

  const updateMatrixSize = (nextSize: number) => {
    const bounded = Math.max(2, Math.min(9, nextSize));
    setMatrixSize(bounded);
    setMatrix(prev => adjustMatrix(prev, bounded));
  };

  const toggleCell = (row: number, col: number) => {
    setMatrix(prev => {
      const next = prev.map(inner => [...inner]);
      next[row][col] = !next[row][col];
      return next;
    });
  };

  const applyNatTransform = useCallback(
    (kind: 'succ' | 'decr') => {
      if (!natAst) return;
      const transformed: NatExpr = { kind, inner: cloneNat(natAst) };
      setNatInput(stringifyNat(transformed));
    },
    [natAst],
  );

  const reverseList = useCallback(() => {
    if (!listAst) return;
    const reversed = arrayToList(listToArray(listAst).reverse());
    setListInput(stringifyList(reversed));
  }, [listAst]);

  const mapListSucc = useCallback(() => {
    if (!listAst) return;
    const mapped = arrayToList(
      listToArray(listAst).map(item => ({ kind: 'succ', inner: cloneNat(item) })),
    );
    setListInput(stringifyList(mapped));
  }, [listAst]);

  const uppercaseString = useCallback(() => {
    setStringInput(value => value.toUpperCase());
  }, []);

  const appendBang = useCallback(() => {
    setStringInput(value => `${value}!`);
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <SectionCard
        title="Matrix-driven dependency graph"
        subtitle="Inspired by SpaceChimpLives • Computing with Geometry – toggle cells to address dependencies via Φ(row, column)."
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label htmlFor="matrix-size">Matrix size</label>
            <input
              id="matrix-size"
              type="number"
              min={2}
              max={9}
              value={matrixSize}
              onChange={event => updateMatrixSize(Number(event.target.value))}
              className="w-16 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-white"
            />
            <div className="flex flex-wrap items-center gap-2">
              {(['hilbert', 'morton'] as AddressingScheme[]).map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setAddressingScheme(option)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] ${
                    addressingScheme === option
                      ? 'bg-emerald-500/70 text-emerald-950'
                      : 'bg-white/5 text-foreground/60 hover:bg-white/10'
                  }`}
                >
                  {option === 'hilbert' ? 'Hilbert Φ' : 'Morton Φ'}
                </button>
              ))}
            </div>
            <p className="text-foreground/60">
              Addressing scheme: {schemeDescription(addressingScheme)}.
            </p>
          </div>

          <div className="overflow-auto rounded-2xl border border-white/10">
            <table className="min-w-[320px] border-collapse text-center text-sm text-white">
              <thead>
                <tr>
                  <th className="p-2" />
                  {matrix.map((_, column) => (
                    <th key={`col-${column}`} className="p-2 text-xs uppercase tracking-[0.3em] text-foreground/60">
                      {matrixLabel(column)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {matrix.map((rowData, row) => (
                  <tr key={`row-${row}`} className="border-t border-white/10">
                    <td className="p-2 text-xs uppercase tracking-[0.3em] text-foreground/60">{matrixLabel(row)}</td>
                    {rowData.map((value, col) => (
                      <td key={`cell-${row}-${col}`} className="p-1">
                        <button
                          type="button"
                          onClick={() => toggleCell(row, col)}
                          className={`h-10 w-10 rounded-xl border text-xs font-semibold transition ${
                            value
                              ? 'border-emerald-400/40 bg-emerald-500/40 text-white'
                              : 'border-white/10 bg-white/5 text-foreground/50 hover:border-white/30'
                          }`}
                        >
                          {value ? '1' : '0'}
                        </button>
                        <p className="mt-1 text-[10px] text-foreground/40">
                          Φ={computeAddress(row, col, matrixSize, addressingScheme)}
                        </p>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <GraphSummary title="Addressed graph" graph={matrixGraph} />
        </div>
      </SectionCard>

      <SectionCard
        title="Monoid + dagger compact closed structure"
        subtitle="Composition closes on adjacency matrices (monoid), while transpose + Kronecker operations demonstrate the dagger compact closed laws."
      >
        <div className="flex flex-wrap gap-3 text-xs">
          <StatusPill label="Identity" ok={monoidIdentityHolds} />
          <StatusPill label="Associative" ok={monoidAssociativityHolds} />
          <StatusPill label="Dagger involutive" ok={daggerInvolution} />
          <StatusPill label="Dagger respects comp" ok={daggerCompositionPreserved} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          <MatrixPreview title="Adjacency M" matrix={matrix} />
          <MatrixPreview title="Identity I" matrix={identityMatrixMemo} />
          <MatrixPreview title="Dagger M†" matrix={daggerMatrix} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <MatrixPreview title="M ∘ I" matrix={composeLeft} />
          <MatrixPreview title="Tensor M ⊗ M" matrix={tensorSelf} />
        </div>
      </SectionCard>

      <SectionCard
        title="Constructor parsers"
        subtitle="Nat expressions use succ/decr/zero, lists build via cons/nil, and strings turn into lists of nat codepoints."
      >
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="text-xs uppercase tracking-[0.3em] text-foreground/50">Nat expression</label>
            <textarea
              value={natInput}
              onChange={event => setNatInput(event.target.value)}
              className="min-h-[120px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-white"
            />
            {natError ? (
              <p className="text-xs text-rose-300">{natError}</p>
            ) : (
              <p className="text-xs text-foreground/60">Normalized: {natAst ? stringifyNat(natAst) : '—'}</p>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="text-xs uppercase tracking-[0.3em] text-foreground/50">List expression</label>
            <textarea
              value={listInput}
              onChange={event => setListInput(event.target.value)}
              className="min-h-[120px] w-full rounded-lg border border-white/10 bg-black/40 p-3 text-sm text-white"
            />
            {listError ? (
              <p className="text-xs text-rose-300">{listError}</p>
            ) : (
              <p className="text-xs text-foreground/60">Normalized: {listAst ? stringifyList(listAst) : '—'}</p>
            )}
          </div>

          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
            <label className="text-xs uppercase tracking-[0.3em] text-foreground/50">String literal</label>
            <input
              value={stringInput}
              onChange={event => setStringInput(event.target.value)}
              className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white"
            />
            <p className="text-xs text-foreground/60">
              Produces {stringInput.length} cons cells / {stringInput.length ? `${stringInput.length} nat heads` : 'nil'}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <GraphSummary title="Nat graph" graph={natGraph} />
          <GraphSummary title="List graph" graph={listGraph} />
          <GraphSummary title="String graph" graph={stringGraph} />
        </div>
      </SectionCard>

      <SectionCard
        title="Pure transforms"
        subtitle="Each control rewrites the parsed AST and regenerates the dependency graph."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">Nat transforms</p>
            <button
              type="button"
              onClick={() => applyNatTransform('succ')}
              disabled={!natAst}
              className="w-full rounded-xl bg-emerald-500/80 px-3 py-2 text-sm font-semibold text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply succ
            </button>
            <button
              type="button"
              onClick={() => applyNatTransform('decr')}
              disabled={!natAst}
              className="w-full rounded-xl bg-sky-500/80 px-3 py-2 text-sm font-semibold text-sky-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Apply decr
            </button>
          </div>

          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">List transforms</p>
            <button
              type="button"
              onClick={reverseList}
              disabled={!listAst}
              className="w-full rounded-xl bg-amber-500/80 px-3 py-2 text-sm font-semibold text-amber-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Reverse list
            </button>
            <button
              type="button"
              onClick={mapListSucc}
              disabled={!listAst}
              className="w-full rounded-xl bg-purple-500/80 px-3 py-2 text-sm font-semibold text-purple-950 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Map succ across list
            </button>
          </div>

          <div className="space-y-2 rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">String transforms</p>
            <button
              type="button"
              onClick={uppercaseString}
              className="w-full rounded-xl bg-rose-500/80 px-3 py-2 text-sm font-semibold text-rose-950"
            >
              Uppercase string
            </button>
            <button
              type="button"
              onClick={appendBang}
              className="w-full rounded-xl bg-indigo-500/80 px-3 py-2 text-sm font-semibold text-indigo-950"
            >
              Append !
            </button>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Trace feedback and datatype fixpoints"
        subtitle="Dagger compact closed structure gives a trace operator. Closing the last wires produces canonical naturals and lists."
      >
        {matrixSize <= 1 ? (
          <p className="text-sm text-foreground/60">Add at least two nodes to build a trace.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <label htmlFor="trace-size">Object wires</label>
              <input
                id="trace-size"
                type="range"
                min={1}
                max={Math.max(1, matrixSize - 1)}
                value={effectiveTraceObjectSize}
                onChange={event => setTraceObjectSize(Number(event.target.value))}
              />
              <p className="text-foreground/60">
                Trace keeps {effectiveTraceObjectSize} boundary nodes and feeds back {Math.max(0, matrixSize - effectiveTraceObjectSize)}.
              </p>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <MatrixPreview title="Traced morphism Tr(M)" matrix={traceMatrix} />
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white">
                <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/50">Witnessed feedback</p>
                {traceArtifacts.witnesses.length === 0 ? (
                  <p className="text-foreground/60">No auxiliary wires participated in the loop.</p>
                ) : (
                  <p>
                    Visited auxiliary slots: {traceArtifacts.witnesses.map(value => value + 1).join(', ')}
                  </p>
                )}
                <p className="mt-2 text-xs text-foreground/60">
                  Interpreting witnesses as code points yields “{traceStringValue || '∅'}”.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <GraphSummary title="Trace-built natural" graph={traceNatGraph} />
              <GraphSummary title="Trace-built list" graph={traceListGraph} />
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
};

export default GraphLangPlayground;
