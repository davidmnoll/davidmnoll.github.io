import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { ContentId, DirectoryEntry, DirectoryNode, DagNode, DagStore } from '@/lib/dag-navvit';
import { DagNavigator } from '@/lib/dag-navvit';
import type { FieldDescriptor, HoleDescriptor, LinearResourceState, StructTypeDescriptor } from './types';
import { resolveType } from './types';

const VARIABLE_DRAG_TYPE = 'application/x-fos-variable';

type ResourceKind = 'none' | 'budget' | 'time' | 'asset' | 'custom' | 'fact';

interface ResourceMetadata {
  kind: ResourceKind;
  label: string;
  quantity: number;
  unit: string;
  consumable: boolean;
  resourceType?: string;
  timeSlots?: Array<{ id: string; start: string; end: string; label: string }>;
}

interface ScopeVariable {
  id: string;
  name: string;
  type: string;
  scopeId: ContentId;
  assignedType?: string;
  valueScopeId?: ContentId;
  resource?: ResourceMetadata;
}

type ScopeEvalFunctionId = 'identity' | 'annotate-with-scope';

interface ScopeMetadata extends Record<string, unknown> {
  nodeKind: 'scope';
  label: string;
  variables: ScopeVariable[];
  allowedTypes?: string[];
  evalFunction?: ScopeEvalFunctionId;
}

interface FunctionParameter {
  name: string;
  type: string;
  role?: 'resource' | 'effect' | 'value';
}

interface FunctionSignature {
  label?: string;
  description?: string;
  action?: 'deposit' | 'withdraw';
  parameters: FunctionParameter[];
}

interface ExpressionMetadata extends Record<string, unknown> {
  nodeKind: 'expression';
  label: string;
  typeName: string;
  fields: ExpressionField[];
  signature?: FunctionSignature;
}

type ExpressionBinding =
  | { kind: 'empty' }
  | { kind: 'hole' }
  | { kind: 'variable'; variableId: string }
  | { kind: 'expression'; nodeId: ContentId };

interface ExpressionField {
  id: string;
  name: string;
  binding: ExpressionBinding;
}

interface ScopedVariableInfo extends ScopeVariable {
  scopeLabel: string;
}

const SPECIAL_TYPE_OPTIONS = ['Type', 'Variable', 'HoTT Equality', 'Sigma', 'Pi', 'Budget', 'Time'] as const;
const HOTT_EQUALITY_CONSTRUCTORS = ['refl', 'sym', 'trans'] as const;
type EqualityConstructor = (typeof HOTT_EQUALITY_CONSTRUCTORS)[number];

interface ScopeEvalFunctionDefinition {
  id: ScopeEvalFunctionId;
  label: string;
  description: string;
  apply: (input: { node: DirectoryNode; scope: ScopeMetadata }) => DirectoryNode;
}

const DEFAULT_SCOPE_EVAL_FUNCTION: ScopeEvalFunctionId = 'identity';

interface FosScopeBuilderProps {
  holes: HoleDescriptor[];
  createBlankValue: (typeName: string) => Record<string, unknown>;
  normalizeStructValue: (typeName: string, value: Record<string, unknown>) => Record<string, unknown>;
  describeType: (typeName: string) => StructTypeDescriptor;
  callEndpoint: (holeName: string, value: Record<string, unknown>) => void;
  getLinearResources: (typeName: string) => LinearResourceState[];
}

const createNodeId = (): ContentId =>
  `cid:${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random().toString(36).slice(2)}` as ContentId;

const createScopeNode = (label: string): DirectoryNode => ({
  kind: 'directory',
  id: createNodeId(),
  entries: [],
  metadata: {
    nodeKind: 'scope',
    label,
    variables: [],
    evalFunction: DEFAULT_SCOPE_EVAL_FUNCTION,
  } satisfies ScopeMetadata,
});

const createExpressionNode = (label: string, typeName: string, fields: ExpressionField[] = []): DirectoryNode => ({
  kind: 'directory',
  id: createNodeId(),
  entries: [],
  metadata: {
    nodeKind: 'expression',
    label,
    typeName,
    fields,
  } satisfies ExpressionMetadata,
});

const isDirectory = (node: DagNode | undefined): node is DirectoryNode => node?.kind === 'directory';

const isScopeMetadata = (metadata: DirectoryNode['metadata']): metadata is ScopeMetadata =>
  Boolean(metadata && (metadata as ScopeMetadata).nodeKind === 'scope');

const isExpressionMetadata = (metadata: DirectoryNode['metadata']): metadata is ExpressionMetadata =>
  Boolean(metadata && (metadata as ExpressionMetadata).nodeKind === 'expression');

const SCOPE_EVAL_FUNCTIONS: Record<ScopeEvalFunctionId, ScopeEvalFunctionDefinition> = {
  identity: {
    id: 'identity',
    label: 'Identity (default)',
    description: 'Leaves the new object untouched before it is placed into the scope.',
    apply: ({ node }) => node,
  },
  'annotate-with-scope': {
    id: 'annotate-with-scope',
    label: 'Annotate with scope',
    description: 'Stamps the scope label onto the object metadata and records when it was added.',
    apply: ({ node, scope }) => {
      if (!isExpressionMetadata(node.metadata)) {
        return node;
      }
      const timestamp = new Date().toISOString();
      return {
        ...node,
        metadata: {
          ...node.metadata,
          label: `${node.metadata.label} @ ${scope.label}`,
          scopeContext: scope.label,
          evaluatedAt: timestamp,
        },
      };
    },
  },
};

const SCOPE_EVAL_FUNCTION_OPTIONS = Object.values(SCOPE_EVAL_FUNCTIONS);

const runScopeEvalFunction = (scope: ScopeMetadata, node: DirectoryNode): DirectoryNode => {
  const evaluator =
    SCOPE_EVAL_FUNCTIONS[scope.evalFunction ?? DEFAULT_SCOPE_EVAL_FUNCTION] ??
    SCOPE_EVAL_FUNCTIONS[DEFAULT_SCOPE_EVAL_FUNCTION];
  return evaluator.apply({ node, scope });
};

const gatherExpressionEntries = (fields: ExpressionField[]): DirectoryEntry[] =>
  fields
    .filter(
      (field): field is ExpressionField & { binding: { kind: 'expression'; nodeId: ContentId } } =>
        field.binding.kind === 'expression',
    )
    .map(field => ({
      name: field.name,
      ref: { kind: 'node', targetId: field.binding.nodeId },
    }));

const formatResourceSummary = (resource?: ResourceMetadata | null) => {
  if (!resource || resource.kind === 'none') return null;
  if (resource.kind === 'budget') {
    return `$${resource.quantity.toFixed(2)} ${resource.label}`;
  }
  if (resource.kind === 'time') {
    const hours = resource.timeSlots?.length ?? resource.quantity;
    return `${hours}h ${resource.label}`;
  }
  return `${resource.quantity} ${resource.unit} ${resource.label}`;
};

const getVariableAssignedType = (variable: ScopeVariable | ScopedVariableInfo) =>
  variable.assignedType ?? variable.resource?.resourceType ?? variable.type;

const sanitizeEntryName = (entries: ReadonlyArray<DirectoryEntry>, baseName: string): string => {
  if (!entries.some(entry => entry.name === baseName)) {
    return baseName;
  }
  let counter = 1;
  let candidate = `${baseName}-${counter}`;
  while (entries.some(entry => entry.name === candidate)) {
    counter += 1;
    candidate = `${baseName}-${counter}`;
  }
  return candidate;
};

const createInitialWorkspace = (): DagStore => {
  const root = createScopeNode('Root Scope');
  const workflowScope = createScopeNode('Todo Workflow');
  const budgetScope = createScopeNode('My Budget');
  const calendarScope = createScopeNode('My Calendar');

  const todoExpression = createExpressionNode('Todo Struct', 'Todo', [
    { id: `field-${createNodeId()}`, name: 'description', binding: { kind: 'hole' } },
    { id: `field-${createNodeId()}`, name: 'slug', binding: { kind: 'hole' } },
    { id: `field-${createNodeId()}`, name: 'ticketId', binding: { kind: 'hole' } },
  ]);
  if (isExpressionMetadata(todoExpression.metadata)) {
    todoExpression.entries = gatherExpressionEntries(todoExpression.metadata.fields);
  }

  const workflowEntry: DirectoryEntry = { name: 'Todo Struct', ref: { kind: 'node', targetId: todoExpression.id } };
  workflowScope.entries = [workflowEntry];

  (root.metadata as ScopeMetadata).allowedTypes = [
    'Type',
    'Variable',
    'HoTT Equality',
    'Sigma',
    'Pi',
    'Todo',
    'TodoTicket',
    'TodoPath',
    'Budget',
    'Time',
  ];
  (root.metadata as ScopeMetadata).variables = [
    {
      id: `var-${createNodeId()}`,
      name: 'My Budget Variable',
      type: 'Variable',
      assignedType: 'Budget',
      scopeId: root.id,
      valueScopeId: budgetScope.id,
      resource: {
        kind: 'budget',
        label: 'Personal Budget',
        quantity: 250,
        unit: 'USD',
        consumable: true,
        resourceType: 'Budget',
      },
    },
    {
      id: `var-${createNodeId()}`,
      name: 'My Calendar Variable',
      type: 'Variable',
      assignedType: 'Time',
      scopeId: root.id,
      valueScopeId: calendarScope.id,
      resource: {
        kind: 'time',
        label: 'Personal Calendar',
        quantity: 10,
        unit: 'hours',
        consumable: true,
        resourceType: 'Time',
        timeSlots: Array.from({ length: 10 }).map((_, index) => {
          const start = new Date();
          start.setDate(start.getDate() + Math.floor(index / 2));
          start.setHours(9 + (index % 2) * 2, 0, 0, 0);
          const end = new Date(start);
          end.setHours(end.getHours() + 2);
          return {
            id: `slot-${createNodeId()}`,
            start: start.toISOString(),
            end: end.toISOString(),
            label: start.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }),
          };
        }),
      },
    },
  ];

  (workflowScope.metadata as ScopeMetadata).allowedTypes = ['Todo', 'Variable', 'HoTT Equality', 'Sigma', 'Pi'];
  (workflowScope.metadata as ScopeMetadata).variables = [
    {
      id: `var-${createNodeId()}`,
      name: 'Create Todo Variable',
      type: 'Variable',
      assignedType: 'Todo',
      scopeId: workflowScope.id,
    },
  ];

  (budgetScope.metadata as ScopeMetadata).allowedTypes = ['Budget', 'Variable', 'HoTT Equality', 'Pi'];
  (budgetScope.metadata as ScopeMetadata).variables = [
    {
      id: `var-${createNodeId()}`,
      name: 'Budget Slice Variable',
      type: 'Variable',
      assignedType: 'Budget',
      scopeId: budgetScope.id,
    },
  ];

  (calendarScope.metadata as ScopeMetadata).allowedTypes = ['Time', 'Variable'];
  (calendarScope.metadata as ScopeMetadata).variables = [];

  const depositFunction = createExpressionNode('Deposit Budget', 'Pi');
  depositFunction.metadata = {
    ...depositFunction.metadata,
    signature: {
      label: 'Deposit Budget',
      description: 'Increases the available budget in a scope.',
      action: 'deposit',
      parameters: [
        { name: 'budget', type: 'Budget', role: 'resource' },
        { name: 'amount', type: 'Number', role: 'value' },
      ],
    },
  };
  const withdrawFunction = createExpressionNode('Spend Budget', 'Pi');
  withdrawFunction.metadata = {
    ...withdrawFunction.metadata,
    signature: {
      label: 'Spend Budget',
      description: 'Spends funds from a scope budget.',
      action: 'withdraw',
      parameters: [
        { name: 'budget', type: 'Budget', role: 'resource' },
        { name: 'amount', type: 'Number', role: 'value' },
      ],
    },
  };

  root.entries = [
    { name: 'Todo Workflow', ref: { kind: 'node', targetId: workflowScope.id } },
    { name: 'My Budget', ref: { kind: 'node', targetId: budgetScope.id } },
    { name: 'My Calendar', ref: { kind: 'node', targetId: calendarScope.id } },
    { name: 'Deposit Budget', ref: { kind: 'node', targetId: depositFunction.id } },
    { name: 'Spend Budget', ref: { kind: 'node', targetId: withdrawFunction.id } },
  ];

  return {
    rootId: root.id,
    nodes: {
      [root.id]: root,
      [workflowScope.id]: workflowScope,
      [budgetScope.id]: budgetScope,
      [calendarScope.id]: calendarScope,
      [todoExpression.id]: todoExpression,
      [depositFunction.id]: depositFunction,
      [withdrawFunction.id]: withdrawFunction,
    },
  };
};

const cloneScopeMetadata = (metadata: ScopeMetadata): ScopeMetadata => ({
  nodeKind: 'scope',
  label: metadata.label,
  allowedTypes: metadata.allowedTypes ? [...metadata.allowedTypes] : undefined,
  evalFunction: metadata.evalFunction ?? DEFAULT_SCOPE_EVAL_FUNCTION,
  variables: metadata.variables.map(variable => ({
    ...variable,
    resource: variable.resource ? { ...variable.resource } : undefined,
  })),
});

const findScopedVariables = (nodes: DagStore['nodes'], crumbs: ReadonlyArray<{ nodeId: ContentId; label: string }>): ScopedVariableInfo[] => {
  const scoped: ScopedVariableInfo[] = [];
  crumbs.forEach(crumb => {
    const node = nodes[crumb.nodeId];
    if (!isDirectory(node)) {
      return;
    }
    const metadata = node.metadata;
    if (!isScopeMetadata(metadata)) {
      return;
    }
    scoped.push(
      ...metadata.variables.map(variable => ({
        ...variable,
        scopeLabel: metadata.label,
      })),
    );
  });
  return scoped;
};

const findPathToNode = (
  nodes: Record<ContentId, DagNode>,
  currentId: ContentId,
  targetId: ContentId,
  path: string[],
): string[] | null => {
  if (currentId === targetId) {
    return path;
  }
  const node = nodes[currentId];
  if (!isDirectory(node)) {
    return null;
  }
  const entries = node.entries ?? [];
  for (const entry of entries) {
    if (entry.ref.kind !== 'node') continue;
    const result = findPathToNode(nodes, entry.ref.targetId as ContentId, targetId, [...path, entry.name]);
    if (result) {
      return result;
    }
  }
  return null;
};

const addExpressionEntryToScope = (
  nodes: Record<ContentId, DagNode>,
  scopeId: ContentId,
  label: string,
  typeName: string,
  options?: { fields?: ExpressionField[]; extraMetadata?: Record<string, unknown> },
) => {
  const scopeNode = nodes[scopeId];
  if (!isDirectory(scopeNode) || !isScopeMetadata(scopeNode.metadata)) {
    return nodes;
  }
  const expressionNode = createExpressionNode(label, typeName, options?.fields ?? []);
  expressionNode.metadata = {
    ...expressionNode.metadata,
    ...(options?.extraMetadata ?? {}),
  };
  const evaluatedNode = {
    ...runScopeEvalFunction(scopeNode.metadata, expressionNode),
    id: expressionNode.id,
  };
  const entryName = sanitizeEntryName(scopeNode.entries, label);
  const updatedScope: DirectoryNode = {
    ...scopeNode,
    entries: [
      ...scopeNode.entries,
      { name: entryName, ref: { kind: 'node', targetId: expressionNode.id } },
    ],
  };
  return {
    ...nodes,
    [scopeId]: updatedScope,
    [expressionNode.id]: evaluatedNode,
  };
};

interface ExpressionEditorCardProps {
  metadata: ExpressionMetadata;
  variables: ScopedVariableInfo[];
  onAddField: (name: string) => void;
  onSetBinding: (fieldId: string, binding: ExpressionBinding) => void;
  onSpawnChild: (fieldId: string, fieldName: string) => void;
  onNavigateToChild: (entryName: string) => void;
}

const ExpressionEditorCard = ({ metadata, variables, onAddField, onSetBinding, onSpawnChild, onNavigateToChild }: ExpressionEditorCardProps) => {
  const [fieldDraft, setFieldDraft] = useState('');
  const variableLookup = useMemo(() => {
    const map = new Map<string, ScopedVariableInfo>();
    variables.forEach(variable => map.set(variable.id, variable));
    return map;
  }, [variables]);

  const handleAddField = (event: React.FormEvent) => {
    event.preventDefault();
    if (!fieldDraft.trim()) return;
    onAddField(fieldDraft.trim());
    setFieldDraft('');
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-black/30 p-4">
      <header>
        <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">Expression</p>
        <h4 className="text-xl font-semibold text-white">{metadata.label}</h4>
        <p className="text-sm text-foreground/60">Type: {metadata.typeName}</p>
      </header>

      <form className="flex gap-2" onSubmit={handleAddField}>
        <input
          value={fieldDraft}
          onChange={event => setFieldDraft(event.target.value)}
          placeholder="Field name"
          className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-foreground/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
        />
        <button
          type="submit"
          className="rounded-xl bg-emerald-500/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-950 hover:bg-emerald-400"
        >
          Add field
        </button>
      </form>

      <div className="space-y-3">
        {metadata.fields.map(field => (
          <div
            key={field.id}
            className="rounded-xl border border-dashed border-white/15 p-3"
            onDragOver={event => {
              if (event.dataTransfer.types.includes(VARIABLE_DRAG_TYPE)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'copy';
              }
            }}
            onDrop={event => {
              if (!event.dataTransfer.types.includes(VARIABLE_DRAG_TYPE)) return;
              event.preventDefault();
              const payload = event.dataTransfer.getData(VARIABLE_DRAG_TYPE);
              if (!payload) return;
              try {
                const { variableId } = JSON.parse(payload) as { variableId: string };
                onSetBinding(field.id, { kind: 'variable', variableId });
              } catch {
                // ignore invalid payloads
              }
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-foreground/50">Field</p>
                <p className="text-base text-white">{field.name}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-foreground/70 hover:border-white/40"
                  onClick={() => onSetBinding(field.id, { kind: 'hole' })}
                >
                  Make hole
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-foreground/70 hover:border-white/40"
                  onClick={() => onSpawnChild(field.id, field.name)}
                >
                  Spawn child
                </button>
                <button
                  type="button"
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-foreground/70 hover:border-white/40"
                  onClick={() => onSetBinding(field.id, { kind: 'empty' })}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="mt-2 text-sm text-white">
              {field.binding.kind === 'hole' && <span className="text-rose-300">Hole input</span>}
              {field.binding.kind === 'empty' && <span className="text-foreground/50">Empty</span>}
              {field.binding.kind === 'variable' && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white">
                  {variableLookup.get(field.binding.variableId)?.name ?? 'Unknown variable'}
                </span>
              )}
              {field.binding.kind === 'expression' && (
                <button
                  type="button"
                  onClick={() => onNavigateToChild(field.name)}
                  className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/70 hover:border-white/40"
                >
                  Open {field.name}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const FosScopeBuilder = ({
  holes,
  createBlankValue,
  normalizeStructValue,
  describeType,
  callEndpoint,
  getLinearResources,
}: FosScopeBuilderProps) => {
  const [store, setStore] = useState<DagStore>(() => createInitialWorkspace());
  const [path, setPath] = useState<string[]>([]);

  const navigator = useMemo(() => new DagNavigator(store), [store]);
  const resolved = useMemo(() => navigator.resolvePath(path), [navigator, path]);
  const activeNode = resolved.activeNode;
  const directoryNode = isDirectory(activeNode) ? activeNode : null;
  const scopeMetadata = directoryNode && isScopeMetadata(directoryNode.metadata) ? directoryNode.metadata : null;
  const expressionMetadata = directoryNode && isExpressionMetadata(directoryNode.metadata) ? directoryNode.metadata : null;
  const activeScopeEvalFunctionId = scopeMetadata?.evalFunction ?? DEFAULT_SCOPE_EVAL_FUNCTION;
  const activeScopeEvalDescriptor =
    SCOPE_EVAL_FUNCTIONS[activeScopeEvalFunctionId] ?? SCOPE_EVAL_FUNCTIONS[DEFAULT_SCOPE_EVAL_FUNCTION];

  const scopedVariables = useMemo(
    () => findScopedVariables(store.nodes, resolved.crumbs),
    [store.nodes, resolved.crumbs],
  );

  const [queryText, setQueryText] = useState('');
  const [queryResults, setQueryResults] = useState<Array<{ id: string; label: string; details: string }>>([]);
  const [activeQueryLabel, setActiveQueryLabel] = useState('');
  const [queryDropdownOpen, setQueryDropdownOpen] = useState(false);
  const [selectedTypeName, setSelectedTypeName] = useState('');
  const [activeHoleName, setActiveHoleName] = useState<string>(holes[0]?.name ?? '');
  const [typeDrafts, setTypeDrafts] = useState<Record<string, Record<string, unknown>>>(() =>
    holes[0] ? { [holes[0].typeName]: createBlankValue(holes[0].typeName) } : {},
  );
  const [typeSubmitStatus, setTypeSubmitStatus] = useState<string | null>(null);
  const [contextCollapsed, setContextCollapsed] = useState(false);
  const [variableExpressionName, setVariableExpressionName] = useState('');
  const [equalityDraft, setEqualityDraft] = useState<{ constructor: EqualityConstructor; left: string; right: string }>({
    constructor: HOTT_EQUALITY_CONSTRUCTORS[0],
    left: '',
    right: '',
  });

  const availableTypeOptions = useMemo(() => {
    const seen = new Set<string>();
    holes.forEach(hole => seen.add(hole.typeName));
    Object.values(store.nodes).forEach(node => {
      if (!isDirectory(node)) return;
      if (isExpressionMetadata(node.metadata)) {
        seen.add(node.metadata.typeName);
      }
      if (isScopeMetadata(node.metadata)) {
        node.metadata.variables.forEach(variable => seen.add(getVariableAssignedType(variable)));
      }
    });
    SPECIAL_TYPE_OPTIONS.forEach(type => seen.add(type));
    return Array.from(seen).sort();
  }, [holes, store.nodes]);

  const allowedTypeOptions = useMemo(() => {
    if (!scopeMetadata?.allowedTypes || scopeMetadata.allowedTypes.length === 0) {
      return availableTypeOptions;
    }
    const allowedSet = new Set(scopeMetadata.allowedTypes);
    return availableTypeOptions.filter(option => allowedSet.has(option));
  }, [availableTypeOptions, scopeMetadata?.allowedTypes]);

  const typeSuggestions = useMemo(() => {
    const normalized = queryText.trim().toLowerCase();
    if (!normalized) return allowedTypeOptions;
    return allowedTypeOptions.filter(option => option.toLowerCase().includes(normalized));
  }, [allowedTypeOptions, queryText]);

  useEffect(() => {
    if (!selectedTypeName) {
      setActiveHoleName('');
      return;
    }
    setTypeDrafts(current => {
      if (current[selectedTypeName]) {
        return current;
      }
      try {
        return {
          ...current,
          [selectedTypeName]: createBlankValue(selectedTypeName),
        };
      } catch {
        return current;
      }
    });
    const matching = holes.filter(hole => hole.typeName === selectedTypeName);
    setActiveHoleName(matching[0]?.name ?? '');
  }, [selectedTypeName, holes, createBlankValue]);

  useEffect(() => {
    if (selectedTypeName && !allowedTypeOptions.includes(selectedTypeName)) {
      setSelectedTypeName('');
      setActiveQueryLabel('');
    }
  }, [allowedTypeOptions, selectedTypeName]);

  const expressionEntries = useMemo(() => {
    if (!directoryNode) return [] as Array<{ entry: DirectoryEntry; metadata: ExpressionMetadata; nodeId: ContentId }>;
    return directoryNode.entries
      .map(entry => {
        if (entry.ref.kind !== 'node') return null;
        const target = store.nodes[entry.ref.targetId];
        if (!isDirectory(target) || !isExpressionMetadata(target.metadata)) return null;
        return { entry, metadata: target.metadata, nodeId: entry.ref.targetId as ContentId };
      })
      .filter(Boolean) as Array<{ entry: DirectoryEntry; metadata: ExpressionMetadata; nodeId: ContentId }>;
  }, [directoryNode, store.nodes]);

  const scopeExpressionsMatchingType = selectedTypeName
    ? expressionEntries.filter(expr => expr.metadata.typeName === selectedTypeName)
    : expressionEntries;

  const filteredScopeVariables = useMemo(() => {
    if (!scopeMetadata) return [];
    if (!selectedTypeName) {
      return scopeMetadata.variables.filter(variable => getVariableAssignedType(variable) !== 'Type');
    }
    return scopeMetadata.variables.filter(variable => getVariableAssignedType(variable) === selectedTypeName);
  }, [scopeMetadata, selectedTypeName]);

  const filteredEntries = useMemo(() => {
    if (!directoryNode) return [];
    const entries = directoryNode.entries ?? [];
    if (!selectedTypeName) {
      return entries.filter(entry => {
        if (entry.ref.kind !== 'node') return true;
        const target = store.nodes[entry.ref.targetId];
        if (!isDirectory(target) || !isExpressionMetadata(target.metadata)) return true;
        return target.metadata.typeName !== 'Type';
      });
    }
    return entries.filter(entry => {
      if (entry.ref.kind !== 'node') return false;
      const target = store.nodes[entry.ref.targetId];
      return isDirectory(target) && isExpressionMetadata(target.metadata) && target.metadata.typeName === selectedTypeName;
    });
  }, [directoryNode, selectedTypeName, store.nodes]);

  const primaryScopeType = useMemo(() => {
    const allowed = scopeMetadata?.allowedTypes ?? [];
    const nonSpecial = allowed.find(
      type => !['Variable', 'Type', 'HoTT Equality', 'Pi', 'Sigma'].includes(type),
    );
    return nonSpecial ?? allowed[0] ?? null;
  }, [scopeMetadata?.allowedTypes]);

  const [functionActionState, setFunctionActionState] = useState<Record<string, Record<string, string>>>({});

  const describeTypeOptional = useCallback(
    (typeName: string) => {
      try {
        return describeType(typeName);
      } catch {
        return null;
      }
    },
    [describeType],
  );

  const isSubtypeOf = useCallback(
    (childType: string, parentType: string) => {
      if (childType === parentType) return true;
      try {
        let descriptor = describeType(childType);
        const visited = new Set<string>();
        while (descriptor?.observes && !visited.has(descriptor.observes)) {
          if (descriptor.observes === parentType) return true;
          visited.add(descriptor.observes);
          descriptor = describeType(descriptor.observes);
        }
      } catch {
        return false;
      }
      return false;
    },
    [describeType],
  );

  const scopeFunctionActions = useMemo(() => {
    if (!primaryScopeType || !scopeMetadata) return [];
    const resourceVariable = scopeMetadata.variables.find(variable => getVariableAssignedType(variable) === primaryScopeType);
    if (!resourceVariable) return [];
    const actions: Array<{
      nodeId: ContentId;
      metadata: ExpressionMetadata;
      label: string;
      parameters: FunctionParameter[];
      firstParamDescriptor: StructTypeDescriptor | null;
      resourceVariable: ScopeVariable;
    }> = [];
    resolved.crumbs.forEach(crumb => {
      const node = store.nodes[crumb.nodeId];
      if (!isDirectory(node)) return;
      (node.entries ?? []).forEach(entry => {
        if (entry.ref.kind !== 'node') return;
        const target = store.nodes[entry.ref.targetId];
        if (!isDirectory(target) || !isExpressionMetadata(target.metadata)) return;
        if (target.metadata.typeName !== 'Pi') return;
        const signature = target.metadata.signature;
        if (!signature || !signature.parameters || signature.parameters.length === 0) return;
        const firstParam = signature.parameters[0];
        if (!isSubtypeOf(primaryScopeType, firstParam.type)) return;
        const descriptor = describeTypeOptional(firstParam.type);
        actions.push({
          nodeId: entry.ref.targetId as ContentId,
          metadata: target.metadata,
          label: signature.label ?? entry.name,
          parameters: signature.parameters,
          firstParamDescriptor: descriptor,
          resourceVariable,
        });
      });
    });
    return actions;
  }, [describeTypeOptional, isSubtypeOf, primaryScopeType, resolved.crumbs, scopeMetadata, store.nodes]);

  const handleCrumbClick = (index: number) => {
    setPath(prev => prev.slice(0, index));
  };

  const handleEntryNavigate = (entryName: string) => {
    setPath(prev => [...prev, entryName]);
  };

  const goToNode = useCallback(
    (nodeId: ContentId) => {
      const targetPath = findPathToNode(store.nodes, store.rootId, nodeId, []);
      if (targetPath) {
        setPath(targetPath);
      }
    },
    [setPath, store.nodes, store.rootId],
  );

  const handleNavigateToVariableScope = useCallback(
    (variable: ScopedVariableInfo | ScopeVariable) => {
      const targetScopeId = variable.valueScopeId ?? variable.scopeId;
      goToNode(targetScopeId);
    },
    [goToNode],
  );

  const handleScopeEvalChange = useCallback(
    (nextFunctionId: ScopeEvalFunctionId) => {
      if (!directoryNode) return;
      setStore(prev => {
        const node = prev.nodes[directoryNode.id];
        if (!isDirectory(node) || !isScopeMetadata(node.metadata)) return prev;
        const currentId = node.metadata.evalFunction ?? DEFAULT_SCOPE_EVAL_FUNCTION;
        if (currentId === nextFunctionId) {
          return prev;
        }
        const metadata = cloneScopeMetadata(node.metadata);
        metadata.evalFunction = nextFunctionId;
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [directoryNode.id]: { ...node, metadata },
          },
        };
      });
    },
    [directoryNode, setStore],
  );

  const addExpressionInCurrentScope = useCallback(
    (
      typeName: string,
      options?: {
        label?: string;
        fields?: ExpressionField[];
        extraMetadata?: Record<string, unknown>;
      },
    ) => {
      if (!directoryNode) return null;
      const entries = directoryNode.entries ?? [];
      const baseLabel = options?.label ?? typeName;
      const uniqueLabel = sanitizeEntryName(entries, baseLabel);
      setStore(prev => ({
        ...prev,
        nodes: addExpressionEntryToScope(prev.nodes, directoryNode.id, uniqueLabel, typeName, {
          fields: options?.fields,
          extraMetadata: options?.extraMetadata,
        }),
      }));
      return uniqueLabel;
    },
    [directoryNode],
  );

  const handleFunctionExecute = useCallback(
    (
      action: {
        nodeId: ContentId;
        metadata: ExpressionMetadata;
        label: string;
        parameters: FunctionParameter[];
        resourceVariable: ScopeVariable;
      },
      parameters: Record<string, string>,
    ) => {
      if (!scopeMetadata) return;
      const signature = action.metadata.signature;
      const resourceVariable = action.resourceVariable;
      if (!resourceVariable.resource) return;
      const amountParam = signature?.parameters?.find(param => param.type === 'Number' && param.role !== 'resource');
      const amountValue = amountParam ? Number(parameters[amountParam.name]) : NaN;
      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        return;
      }
      const actionKind = signature?.action;
      addExpressionInCurrentScope('Pi', {
        label: `${action.label} invocation`,
        extraMetadata: {
          invokedFunction: action.label,
          functionNode: action.nodeId,
          parameters,
          timestamp: new Date().toISOString(),
          scope: scopeMetadata.label,
        },
      });
      setStore(prev => {
        const node = prev.nodes[directoryNode!.id];
        if (!isDirectory(node) || !isScopeMetadata(node.metadata)) return prev;
        const metadata = cloneScopeMetadata(node.metadata);
        const target = metadata.variables.find((variable: ScopeVariable) => variable.id === resourceVariable.id);
        if (!target || !target.resource) return prev;
        const nextResource = { ...target.resource };
        if (actionKind === 'withdraw') {
          if (nextResource.quantity < amountValue) {
            return prev;
          }
          nextResource.quantity -= amountValue;
        } else {
          nextResource.quantity += amountValue;
        }
        target.resource = nextResource;
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [directoryNode!.id]: { ...node, metadata },
          },
        };
      });
        setFunctionActionState(current => ({
          ...current,
          [action.nodeId]: {},
        }));
    },
    [addExpressionInCurrentScope, directoryNode, scopeMetadata, setStore],
  );

  const contextVariables = scopedVariables.filter(variable => variable.scopeId !== directoryNode?.id);

  const computeQueryResults = useCallback(
    (needle: string) => {
      const normalized = needle.trim().toLowerCase();
      if (!normalized) return [];
      const results: Array<{ id: string; label: string; details: string }> = [];
      scopeMetadata?.variables.forEach(variable => {
        const variableType = getVariableAssignedType(variable);
        const summary = formatResourceSummary(variable.resource) ?? variableType;
        if (variableType.toLowerCase().includes(normalized) || summary?.toLowerCase().includes(normalized)) {
          results.push({ id: variable.id, label: variable.name, details: summary });
        }
      });
      directoryNode?.entries.forEach(entry => {
        if (entry.name.toLowerCase().includes(normalized)) {
          results.push({ id: entry.name, label: entry.name, details: entry.ref.kind });
        }
      });
      return results;
    },
    [scopeMetadata?.variables, directoryNode?.entries],
  );

  useEffect(() => {
    if (!activeQueryLabel) {
      setQueryResults([]);
      return;
    }
    setQueryResults(computeQueryResults(activeQueryLabel));
  }, [activeQueryLabel, computeQueryResults]);

  const commitQuerySelection = (label: string) => {
    const normalizedLabel = label.trim();
    if (!normalizedLabel) return;
    const matchesType = allowedTypeOptions.includes(normalizedLabel);
    setQueryText(normalizedLabel);
    setActiveQueryLabel(normalizedLabel);
    setSelectedTypeName(matchesType ? normalizedLabel : '');
    setQueryDropdownOpen(false);
  };

  const activeTypeDescriptor = useMemo(() => {
    if (!selectedTypeName) return null;
    try {
      return describeType(selectedTypeName);
    } catch {
      return null;
    }
  }, [describeType, selectedTypeName]);

  const activeTypeValue = useMemo(() => {
    if (!selectedTypeName) return null;
    const existing = typeDrafts[selectedTypeName];
    if (existing) return existing;
    try {
      return createBlankValue(selectedTypeName);
    } catch {
      return null;
    }
  }, [selectedTypeName, typeDrafts, createBlankValue]);
  const matchingHoles = selectedTypeName ? holes.filter(hole => hole.typeName === selectedTypeName) : holes;
  const activeHole = matchingHoles.find(hole => hole.name === activeHoleName) ?? matchingHoles[0] ?? null;
  const piDescriptor = activeHole?.pi;
  const linearResources = piDescriptor ? getLinearResources(piDescriptor.parameter) : [];
  const availableLinearResources = linearResources.filter(resource => !resource.consumed);

  const missingTypeFields = activeTypeDescriptor
    ? activeTypeDescriptor.fields.filter(field => {
        const resolvedField = resolveType(field.type, activeTypeValue ?? {});
        const current = activeTypeValue?.[field.name];
        if (resolvedField.kind === 'literal') {
          return current !== resolvedField.value;
        }
        if (resolvedField.kind === 'scalar') {
          return typeof current !== 'string' || current.trim().length === 0;
        }
        return false;
      })
    : [];

  const handleTypeValueChange = (fieldName: string, next: unknown) => {
    if (!selectedTypeName) return;
    setTypeDrafts(current => ({
      ...current,
      [selectedTypeName]: normalizeStructValue(selectedTypeName, {
        ...(current[selectedTypeName] ?? createBlankValue(selectedTypeName)),
        [fieldName]: next,
      }),
    }));
  };

  const handleTypeSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedTypeName || !activeHole) {
      setTypeSubmitStatus('Select a type and endpoint before submitting.');
      return;
    }
    const payload = normalizeStructValue(selectedTypeName, typeDrafts[selectedTypeName] ?? {});
    callEndpoint(activeHole.name, payload);
    setTypeSubmitStatus(`Submitted ${activeHole.name} at ${new Date().toLocaleTimeString()}`);
    setTypeDrafts(current => ({
      ...current,
      [selectedTypeName]: createBlankValue(selectedTypeName),
    }));
  };

  const renderTypeConstructorField = (field: FieldDescriptor) => {
    if (!selectedTypeName || !activeTypeDescriptor || !activeTypeValue) return null;
    if (piDescriptor && piDescriptor.viaField === field.name) {
      return (
        <div key={field.name} className="flex flex-col gap-1 text-sm">
          <label className="text-foreground/70" htmlFor={`type-${field.name}`}>
            {field.label ?? field.name} (linear)
          </label>
          <select
            id={`type-${field.name}`}
            value={typeof activeTypeValue[field.name] === 'string' ? (activeTypeValue[field.name] as string) : ''}
            onChange={event => handleTypeValueChange(field.name, event.target.value)}
            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
            disabled={availableLinearResources.length === 0}
          >
            <option value="">Select resource</option>
            {availableLinearResources.map(resource => (
              <option key={resource.identity} value={resource.identity}>
                {resource.identity}
                {resource.fact?.args.scope ? ` · ${String(resource.fact.args.scope)}` : ''}
              </option>
            ))}
          </select>
        </div>
      );
    }
    const resolvedField = resolveType(field.type, activeTypeValue);
    const current = activeTypeValue[field.name];
    const commonProps = {
      id: `type-${field.name}`,
      value: typeof current === 'string' ? current : '',
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        handleTypeValueChange(field.name, event.target.value),
      placeholder: field.label ?? field.name,
      className:
        'w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-foreground/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20',
    };
    if (resolvedField.kind === 'literal') {
      return (
        <div key={field.name} className="flex flex-col gap-1 text-sm">
          <label className="text-foreground/70">{field.label ?? field.name}</label>
          <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-foreground/70">{String(resolvedField.value)}</p>
        </div>
      );
    }
    if (resolvedField.multiline || field.input === 'textarea') {
      return <textarea key={field.name} {...commonProps} rows={3} />;
    }
    return <input key={field.name} {...commonProps} />;
  };

  const addFieldToExpression = useCallback(
    (expressionId: ContentId, name: string) => {
      setStore(prev => {
        const node = prev.nodes[expressionId];
        if (!isDirectory(node) || !isExpressionMetadata(node.metadata)) {
          return prev;
        }
        const metadata: ExpressionMetadata = {
          ...node.metadata,
          fields: [
            ...node.metadata.fields,
            {
              id: `field-${createNodeId()}`,
              name,
              binding: { kind: 'empty' },
            },
          ],
        };
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [expressionId]: { ...node, metadata, entries: gatherExpressionEntries(metadata.fields) },
          },
        };
      });
    },
    [],
  );

  const setFieldBinding = useCallback(
    (expressionId: ContentId, fieldId: string, binding: ExpressionBinding) => {
      setStore(prev => {
        const node = prev.nodes[expressionId];
        if (!isDirectory(node) || !isExpressionMetadata(node.metadata)) {
          return prev;
        }
        const metadata: ExpressionMetadata = {
          ...node.metadata,
          fields: node.metadata.fields.map(field =>
            field.id === fieldId
              ? { ...field, binding: binding.kind === 'expression' ? { kind: 'expression', nodeId: binding.nodeId } : binding }
              : field,
          ),
        };
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [expressionId]: { ...node, metadata, entries: gatherExpressionEntries(metadata.fields) },
          },
        };
      });
    },
    [],
  );

  const spawnFieldExpression = useCallback(
    (expressionId: ContentId, fieldId: string, fieldName: string) => {
      setStore(prev => {
        const node = prev.nodes[expressionId];
        if (!isDirectory(node) || !isExpressionMetadata(node.metadata)) {
          return prev;
        }
        const child = createExpressionNode(`${node.metadata.label}.${fieldName}`, 'Nested');
        const metadata: ExpressionMetadata = {
          ...node.metadata,
          fields: node.metadata.fields.map(field =>
            field.id === fieldId ? { ...field, binding: { kind: 'expression', nodeId: child.id } } : field,
          ),
        };
        return {
          ...prev,
          nodes: {
            ...prev.nodes,
            [expressionId]: { ...node, metadata, entries: gatherExpressionEntries(metadata.fields) },
            [child.id]: child,
          },
        };
      });
    },
    [],
  );

  const handleQuickExpressionCreate = useCallback(() => {
    if (!selectedTypeName) return;
    const fields =
      activeTypeDescriptor?.fields.map(field => ({
        id: `field-${createNodeId()}`,
        name: field.name,
        binding: { kind: 'hole' as const },
      })) ?? [];
    addExpressionInCurrentScope(selectedTypeName, { fields });
  }, [selectedTypeName, activeTypeDescriptor, addExpressionInCurrentScope]);

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 text-white">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">FOS Scope Builder</p>
          <h2 className="text-2xl font-semibold">{resolved.crumbs[resolved.crumbs.length - 1]?.label ?? 'Workspace'}</h2>
        </div>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {resolved.crumbs.map((crumb, index) => (
          <button
            key={crumb.nodeId}
            type="button"
            onClick={() => handleCrumbClick(index)}
            className={`rounded-full px-3 py-1 text-xs ${
              index === resolved.crumbs.length - 1
                ? 'bg-emerald-500/30 text-white'
                : 'bg-white/5 text-foreground/70 hover:bg-white/10'
            }`}
          >
            {crumb.label}
          </button>
        ))}
      </div>

      {resolved.crumbs.length > 1 && contextVariables.length > 0 && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-black/20">
          <button
            type="button"
            onClick={() => setContextCollapsed(value => !value)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-xs uppercase tracking-[0.3em] text-foreground/50"
          >
            Context variables
            <span className="text-white">{contextCollapsed ? '+' : '−'}</span>
          </button>
          {!contextCollapsed && (
            <div className="border-t border-white/10 p-4">
              <div className="flex flex-wrap gap-3 text-sm">
                {contextVariables.map(variable => (
                  <div
                    key={variable.id}
                    onClick={() => handleNavigateToVariableScope(variable)}
                    className="flex flex-1 min-w-[200px] items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2 cursor-pointer transition hover:border-white/40 hover:bg-white/10"
                  >
                    <div>
                      <p className="font-semibold text-white">{variable.name}</p>
                      <p className="text-xs text-foreground/50">
                        {getVariableAssignedType(variable)} · {variable.scopeLabel}
                      </p>
                    </div>
                    <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-foreground/70">
                      {formatResourceSummary(variable.resource) ?? 'Logical'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <aside className="space-y-4 rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">Expression type</p>
              </div>
            </div>
            <div className="relative mt-2">
              <input
                id="fos-query-input"
                value={queryText}
                onChange={event => {
                  const next = event.target.value;
                  setQueryText(next);
                  setQueryDropdownOpen(true);
                  if (!next.trim()) {
                    setSelectedTypeName('');
                    setActiveQueryLabel('');
                  }
                }}
                onFocus={() => setQueryDropdownOpen(true)}
                onBlur={() => window.setTimeout(() => setQueryDropdownOpen(false), 120)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    commitQuerySelection(typeSuggestions[0] ?? event.currentTarget.value);
                  }
                }}
                placeholder="Select a type (Todo, Budget, Time...)"
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-foreground/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
              />
              {queryDropdownOpen && (
                <div className="absolute left-0 right-0 z-10 mt-2 max-h-48 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/95 p-1 shadow-xl shadow-black/40">
                  {typeSuggestions.length === 0 && (
                    <p className="px-3 py-2 text-[10px] uppercase tracking-[0.3em] text-foreground/50">No type matches.</p>
                  )}
                  {typeSuggestions.map(option => (
                    <button
                      key={option}
                      type="button"
                      onMouseDown={event => {
                        event.preventDefault();
                        commitQuerySelection(option);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm ${
                        option === selectedTypeName
                          ? 'bg-emerald-500/20 text-white'
                          : 'text-foreground/80 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span>{option}</span>
                      {option === selectedTypeName && (
                        <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-300">Active</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-3 space-y-3 text-xs text-foreground/70">
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {queryResults.length === 0 && <p>No results yet. Select a type or resource.</p>}
                {queryResults.map(result => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => {
                      setActiveQueryLabel(result.label);
                    }}
                    className="w-full rounded border border-white/10 px-2 py-1 text-left text-white hover:border-white/40"
                  >
                    <p className="font-semibold">{result.label}</p>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/50">{result.details}</p>
                  </button>
                ))}
              </div>
              {!selectedTypeName && (
                <p className="text-[10px] text-foreground/50">Select a type above to enable expression authoring.</p>
              )}
              {selectedTypeName === 'Variable' && directoryNode && (
                <form
                  className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white"
                  onSubmit={event => {
                    event.preventDefault();
                    if (!variableExpressionName.trim()) return;
                    addExpressionInCurrentScope('Variable', {
                      label: variableExpressionName.trim(),
                      extraMetadata: { variableName: variableExpressionName.trim() },
                    });
                    setVariableExpressionName('');
                  }}
                >
                  <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/50">New variable</p>
                  <input
                    value={variableExpressionName}
                    onChange={event => setVariableExpressionName(event.target.value)}
                    placeholder="Variable name"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-foreground/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-emerald-500/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-950 hover:bg-emerald-400"
                  >
                    Define variable
                  </button>
                </form>
              )}
              {selectedTypeName === 'HoTT Equality' && directoryNode && (
                <form
                  className="space-y-2 rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white"
                  onSubmit={event => {
                    event.preventDefault();
                    const leftValue = equalityDraft.left.trim();
                    const rightValue = equalityDraft.right.trim();
                    if (!leftValue || !rightValue) return;
                    const label = `${leftValue} = ${rightValue}`;
                    const fields: ExpressionField[] = [
                      { id: `field-${createNodeId()}`, name: 'constructor', binding: { kind: 'hole' } },
                      { id: `field-${createNodeId()}`, name: 'left', binding: { kind: 'hole' } },
                      { id: `field-${createNodeId()}`, name: 'right', binding: { kind: 'hole' } },
                    ];
                    addExpressionInCurrentScope('HoTT Equality', {
                      label,
                      fields,
                      extraMetadata: {
                        equality: {
                          constructor: equalityDraft.constructor,
                          left: leftValue,
                          right: rightValue,
                        },
                      },
                    });
                    setEqualityDraft(current => ({ ...current, left: '', right: '' }));
                  }}
                >
                  <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/50">HoTT equality</p>
                  <label className="text-[10px] uppercase tracking-[0.3em] text-foreground/50">Constructor</label>
                  <select
                    value={equalityDraft.constructor}
                    onChange={event => setEqualityDraft(current => ({ ...current, constructor: event.target.value as EqualityConstructor }))}
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                  >
                    {HOTT_EQUALITY_CONSTRUCTORS.map(constructor => (
                      <option key={constructor} value={constructor}>
                        {constructor}
                      </option>
                    ))}
                  </select>
                  <input
                    value={equalityDraft.left}
                    onChange={event => setEqualityDraft(current => ({ ...current, left: event.target.value }))}
                    placeholder="Left expression"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-foreground/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                  <input
                    value={equalityDraft.right}
                    onChange={event => setEqualityDraft(current => ({ ...current, right: event.target.value }))}
                    placeholder="Right expression"
                    className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-foreground/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-emerald-500/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-950 hover:bg-emerald-400"
                  >
                    Insert equality
                  </button>
                </form>
              )}
              {selectedTypeName &&
                selectedTypeName !== 'Variable' &&
                selectedTypeName !== 'HoTT Equality' &&
                directoryNode && (
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-white">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/50">New {selectedTypeName}</p>
                    <p className="mt-1 text-foreground/70">Creates a blank {selectedTypeName} expression within this scope.</p>
                    <button
                      type="button"
                      onClick={handleQuickExpressionCreate}
                      className="mt-3 w-full rounded-xl bg-emerald-500/70 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-950 hover:bg-emerald-400"
                    >
                      Add {selectedTypeName}
                    </button>
                  </div>
                )}
            </div>
          </div>

          {selectedTypeName && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/50">Type context</p>
                  <h5 className="text-lg font-semibold text-white">{selectedTypeName}</h5>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                  {scopeExpressionsMatchingType.length}/{expressionEntries.length || 0} entries
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {scopeExpressionsMatchingType.length === 0 && <p className="text-foreground/60">No expressions in this scope.</p>}
                {scopeExpressionsMatchingType.map(({ entry, metadata }) => (
                  <button
                    key={entry.ref.kind === 'node' ? entry.ref.targetId : entry.name}
                    type="button"
                    onClick={() => handleEntryNavigate(entry.name)}
                    className="w-full rounded-xl border border-white/10 px-3 py-2 text-left transition hover:border-white/40 hover:bg-white/10"
                  >
                    <p className="text-sm font-semibold">{metadata.label || entry.name}</p>
                    <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/50">{metadata.typeName}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <div className="space-y-6">
          {scopeMetadata && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">Scope</p>
                  <h3 className="text-xl font-semibold">{scopeMetadata.label}</h3>
                </div>
              </div>
              <div className="mb-6 text-xs text-white">
                <label className="text-[10px] uppercase tracking-[0.3em] text-foreground/50" htmlFor="scope-eval-selector">
                  Eval function
                </label>
                <select
                  id="scope-eval-selector"
                  value={activeScopeEvalFunctionId}
                  onChange={event => handleScopeEvalChange(event.target.value as ScopeEvalFunctionId)}
                  className="mt-2 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                >
                  {SCOPE_EVAL_FUNCTION_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-foreground/60">{activeScopeEvalDescriptor.description}</p>
              </div>

      <section>
        <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">Variables</p>
        <div className="mt-2 space-y-2">
          {filteredScopeVariables.map(variable => (
            <div
              key={variable.id}
              onClick={() => handleNavigateToVariableScope(variable)}
              className="cursor-pointer rounded-xl border border-white/10 bg-white/5 p-3 text-sm transition hover:border-white/40 hover:bg-white/10"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{variable.name}</p>
                  <p className="text-xs text-foreground/50">{getVariableAssignedType(variable)}</p>
                </div>
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-foreground/70">
                  {formatResourceSummary(variable.resource) ?? 'Logical'}
                </span>
              </div>
            </div>
          ))}
          {filteredScopeVariables.length === 0 && (
            <p className="text-xs text-foreground/50">
              {selectedTypeName ? 'No variables of this type in scope.' : 'No user-defined variables yet.'}
            </p>
          )}
        </div>
      </section>

      {scopeFunctionActions.length > 0 && (
        <section className="mt-4">
          <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">Actions</p>
          <div className="mt-2 space-y-3 text-sm">
            {scopeFunctionActions.map(action => {
              const signature = action.metadata.signature;
              const parameterInputs = action.parameters.slice(1);
              const actionState = functionActionState[action.nodeId] ?? {};
              const disabled = parameterInputs.some(param => !actionState[param.name]?.trim());
              return (
                <form
                  key={action.nodeId}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3"
                  onSubmit={event => {
                    event.preventDefault();
                    if (!disabled) {
                      handleFunctionExecute(action, actionState);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-white">{signature?.label ?? action.label}</p>
                      {signature?.description && <p className="text-xs text-foreground/60">{signature.description}</p>}
                    </div>
                    {signature?.action && (
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-foreground/60">
                        {signature.action}
                      </span>
                    )}
                  </div>
                  {action.firstParamDescriptor && (
                    <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-foreground/70">
                      <p className="text-[10px] uppercase tracking-[0.3em] text-foreground/50">Input structure</p>
                      {action.firstParamDescriptor.fields.map(field => {
                        const resolved = resolveType(field.type, {});
                        const typeLabel =
                          resolved.kind === 'scalar'
                            ? resolved.base
                            : resolved.kind === 'literal'
                              ? JSON.stringify(resolved.value)
                              : field.type instanceof Function
                                ? 'Derived'
                                : 'Value';
                        return (
                          <div key={field.name} className="flex items-center justify-between border-b border-white/5 py-1 last:border-b-0">
                            <span>{field.label ?? field.name}</span>
                            <span className="text-foreground/50">{typeLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {parameterInputs.map(param => (
                      <input
                        key={param.name}
                        value={actionState[param.name] ?? ''}
                        onChange={event =>
                          setFunctionActionState(current => ({
                            ...current,
                            [action.nodeId]: {
                              ...current[action.nodeId],
                              [param.name]: event.target.value,
                            },
                          }))
                        }
                        placeholder={`${param.name} (${param.type})`}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-foreground/40 focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                      />
                    ))}
                    {parameterInputs.length === 0 && <p className="text-xs text-foreground/60">No additional inputs required.</p>}
                  </div>
                  <button
                    type="submit"
                    disabled={parameterInputs.length > 0 && disabled}
                    className="mt-3 w-full rounded-xl bg-emerald-500/80 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Execute
                  </button>
                </form>
              );
            })}
          </div>
        </section>
      )}


      <section className="mt-4">
        <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">Entries</p>
        <ul className="mt-2 space-y-2 text-sm">
          {filteredEntries.map(entry => (
            <li
              key={`${directoryNode?.id ?? 'root'}-${entry.name}`}
              onClick={() => handleEntryNavigate(entry.name)}
              className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 px-3 py-2 transition hover:border-white/40 hover:bg-white/5"
            >
              <div>
                <p className="text-white">{entry.name}</p>
                <p className="text-xs text-foreground/50">{entry.ref.kind === 'node' ? 'node' : 'alias'}</p>
              </div>
            </li>
          ))}
          {filteredEntries.length === 0 && (
            <li className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-xs text-foreground/60">
              {selectedTypeName ? 'No entries for this type in scope.' : 'No entries yet.'}
            </li>
          )}
        </ul>
      </section>
            </div>
          )}

          {selectedTypeName && (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-foreground/50">Type constructor</p>
                  <h4 className="text-xl font-semibold text-white">{selectedTypeName}</h4>
                </div>
                {matchingHoles.length > 0 && (
                  <div className="text-xs text-foreground/60">
                    <label className="text-[10px] uppercase tracking-[0.3em]" htmlFor="hole-selector">
                      Endpoint
                    </label>
                    <select
                      id="hole-selector"
                      value={activeHole?.name ?? ''}
                      onChange={event => setActiveHoleName(event.target.value)}
                      className="mt-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-white/40 focus:outline-none focus:ring-2 focus:ring-white/20"
                    >
                      {matchingHoles.map(hole => (
                        <option key={hole.name} value={hole.name}>
                          {hole.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              {!activeTypeDescriptor && <p className="text-sm text-foreground/60">This selection is not a structured FOS type.</p>}
              {activeTypeDescriptor && (
                <form className="space-y-4" onSubmit={handleTypeSubmit}>
                  <div className="grid gap-3 md:grid-cols-2">
                    {activeTypeDescriptor.fields.map(field => renderTypeConstructorField(field))}
                  </div>
                  {missingTypeFields.length > 0 && (
                    <p className="text-xs text-foreground/60">
                      Missing {missingTypeFields.map(field => field.label ?? field.name).join(', ')}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={!activeHole || missingTypeFields.length > 0}
                      className="rounded-xl bg-emerald-500/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {activeHole ? `Submit via ${activeHole.name}` : 'No endpoint available'}
                    </button>
                    {typeSubmitStatus && <p className="text-xs text-emerald-300">{typeSubmitStatus}</p>}
                  </div>
                </form>
              )}
            </div>
          )}

          {expressionMetadata && (
            <ExpressionEditorCard
              metadata={expressionMetadata}
              variables={scopedVariables}
              onAddField={name => addFieldToExpression(directoryNode!.id, name)}
              onSetBinding={(fieldId, binding) => setFieldBinding(directoryNode!.id, fieldId, binding)}
              onSpawnChild={(fieldId, fieldName) => spawnFieldExpression(directoryNode!.id, fieldId, fieldName)}
              onNavigateToChild={fieldName => handleEntryNavigate(fieldName)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default FosScopeBuilder;
