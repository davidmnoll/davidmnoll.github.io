
import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import FosScopeBuilder from './scopeBuilder';
import type {
  Primitive,
  Modality,
  TypeFlavor,
  TypeResolver,
  FieldDescriptor,
  StructTypeDescriptor,
  HoleDescriptor,
  ProgramDefinition,
  LinearResourceState,
  ConsumptionRequest,
  CallEndpointOptions,
  Fact,
} from './types';
import { resolveType, literal, scalar } from './types';
export { literal, scalar } from './types';

type FosEvent =
  | { kind: 'fact-asserted'; fact: Fact; timestamp: number }
  | { kind: 'hole-filled'; holeName: string; value: Record<string, unknown>; timestamp: number }
  | { kind: 'linear-consumed'; typeName: string; identity: string; timestamp: number };

interface EventStorage {
  load(): FosEvent[];
  append(event: FosEvent): void;
}

interface QueryPattern {
  predicate: string;
  args?: Record<string, PatternValue>;
}

interface QueryResult {
  fact: Fact;
  bindings: Record<string, unknown>;
}

interface VarPattern {
  kind: 'var';
  name: string;
}

interface PatternObject {
  [key: string]: PatternValue;
}

type PatternValue = Primitive | VarPattern | PatternObject;

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

type FosAstComponent<P> = React.FC<P> & { fosKind: 'program' | 'type' | 'field' | 'hole' };

interface ProgramProps {
  name: string;
  children: React.ReactNode;
}

interface TypeProps {
  name: string;
  label?: string;
  predicate?: string;
  identity?: string;
  observes?: string;
  sourceField?: string;
  targetField?: string;
  modality?: Modality;
  form?: Exclude<TypeFlavor, 'observation'>;
  children: React.ReactNode;
}

interface FieldProps {
  name: string;
  label?: string;
  type: TypeResolver;
  optional?: boolean;
  input?: 'text' | 'textarea';
}

interface HoleProps {
  name: string;
  type: string;
  description?: string;
  fact?: string;
  pi?: {
    parameter: string;
    viaField?: string;
    modality?: Modality;
  };
}

function createAstComponent<P>(kind: 'program' | 'type' | 'field' | 'hole') {
  const Component = ((props: P & { children?: ReactNode }) => <>{props.children}</>) as FosAstComponent<P>;
  Component.fosKind = kind;
  return Component;
}

export const ProgramNode = createAstComponent<ProgramProps>('program');
export const TypeNode = createAstComponent<TypeProps>('type');
export const FieldNode = createAstComponent<FieldProps>('field');
export const HoleNode = createAstComponent<HoleProps>('hole');

const finalizeTypeGraph = (types: Record<string, StructTypeDescriptor>) => {
  const memo = new Map<string, number>();
  const visiting = new Set<string>();

  const visit = (name: string): number => {
    if (memo.has(name)) return memo.get(name)!;
    const descriptor = types[name];
    if (!descriptor) {
      throw new Error(`Unknown type referenced: ${name}`);
    }

    if (!descriptor.observes) {
      descriptor.dimension = 0;
      memo.set(name, 0);
      return 0;
    }

    if (!types[descriptor.observes]) {
      throw new Error(`Type "${descriptor.name}" observes missing type "${descriptor.observes}".`);
    }

    if (visiting.has(name)) {
      throw new Error(`Circular observation detected at "${name}".`);
    }

    visiting.add(name);
    const baseDimension = visit(descriptor.observes);
    visiting.delete(name);

    const dimension = baseDimension + 1;
    descriptor.dimension = dimension;
    memo.set(name, dimension);
    return dimension;
  };

  Object.keys(types).forEach(visit);
};

const interpretProgram = (ast: React.ReactElement): ProgramDefinition => {
  if (!React.isValidElement(ast) || (ast.type as FosAstComponent<ProgramProps>).fosKind !== 'program') {
    throw new Error('Fos program must start with <ProgramNode>.');
  }

  const programProps = ast.props as ProgramProps;
  const types: Record<string, StructTypeDescriptor> = {};
  const holes: HoleDescriptor[] = [];

  React.Children.forEach(programProps.children, child => {
    if (!React.isValidElement(child)) return;
    const meta = child.type as FosAstComponent<unknown>;

    if (meta.fosKind === 'type') {
      const typeProps = child.props as TypeProps;
      const fields: FieldDescriptor[] = [];

      React.Children.forEach(typeProps.children, fieldChild => {
        if (!React.isValidElement(fieldChild)) return;
        const fieldMeta = fieldChild.type as FosAstComponent<FieldProps>;
        if (fieldMeta.fosKind !== 'field') return;

        fields.push(fieldChild.props as FieldDescriptor);
      });

      const flavor: TypeFlavor = typeProps.observes ? 'observation' : typeProps.form ?? 'struct';

      const descriptor: StructTypeDescriptor = {
        name: typeProps.name,
        label: typeProps.label ?? typeProps.name,
        predicate: typeProps.predicate ?? typeProps.name.toLowerCase(),
        fields,
        identityField: typeProps.identity,
        kind: flavor,
        observes: typeProps.observes,
        dimension: 0,
        sourceField: typeProps.observes ? typeProps.sourceField ?? 'from' : undefined,
        targetField: typeProps.observes ? typeProps.targetField ?? 'to' : undefined,
        modality: typeProps.modality ?? 'cartesian',
      };

      types[typeProps.name] = descriptor;
    }

    if (meta.fosKind === 'hole') {
      const holeProps = child.props as HoleProps;
      holes.push({
        name: holeProps.name,
        typeName: holeProps.type,
        description: holeProps.description,
        factPredicate: holeProps.fact,
        pi: holeProps.pi
          ? {
              parameter: holeProps.pi.parameter,
              viaField: holeProps.pi.viaField,
              modality: holeProps.pi.modality ?? 'cartesian',
            }
          : undefined,
      });
    }
  });

  finalizeTypeGraph(types);

  const predicateToType: Record<string, string> = {};
  Object.values(types).forEach(type => {
    predicateToType[type.predicate] = type.name;
  });

  return {
    name: programProps.name,
    types,
    holes,
    predicateToType,
  };
};

class EventStream {
  private listeners = new Set<(event: FosEvent) => void>();

  emit(event: FosEvent) {
    this.listeners.forEach(listener => listener(event));
  }

  subscribe(listener: (event: FosEvent) => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export class MemoryEventStorage implements EventStorage {
  private events: FosEvent[];

  constructor(initialEvents: FosEvent[] = []) {
    this.events = [...initialEvents];
  }

  load() {
    return [...this.events];
  }

  append(event: FosEvent) {
    this.events.push(event);
  }
}

export class LocalStorageEventStorage implements EventStorage {
  private cache: FosEvent[] | null = null;

  constructor(private key: string, private fallback: EventStorage = new MemoryEventStorage()) {}

  private get store() {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  }

  load() {
    if (this.cache) return [...this.cache];
    const store = this.store;
    if (!store) return this.fallback.load();
    const raw = store.getItem(this.key);
    if (!raw) {
      this.cache = [];
      return [];
    }
    try {
      this.cache = JSON.parse(raw);
    } catch (error) {
      console.warn('Failed to parse fos event log, resetting.', error);
      this.cache = [];
      store.removeItem(this.key);
    }
    return this.cache ? [...this.cache] : [];
  }

  append(event: FosEvent) {
    const store = this.store;
    if (!store) {
      this.fallback.append(event);
      return;
    }
    const events = this.load();
    events.push(event);
    this.cache = events;
    store.setItem(this.key, JSON.stringify(events));
  }
}

interface NodeFs {
  readFileSync(path: string, encoding: BufferEncoding): string;
  writeFileSync(path: string, data: string): void;
  existsSync(path: string): boolean;
}

export class FileEventStorage implements EventStorage {
  constructor(private path: string, private fs: NodeFs | null) {}

  private ensureFs() {
    if (!this.fs) throw new Error('File system adapter missing. Pass an fs implementation from the CLI environment.');
    return this.fs;
  }

  load() {
    const fs = this.fs;
    if (!fs) return [];
    if (!fs.existsSync(this.path)) return [];
    const raw = fs.readFileSync(this.path, 'utf-8');
    return raw ? (JSON.parse(raw) as FosEvent[]) : [];
  }

  append(event: FosEvent) {
    const fs = this.ensureFs();
    const events = this.load();
    events.push(event);
    fs.writeFileSync(this.path, JSON.stringify(events, null, 2));
  }
}

const tryNormalizePrimitive = (value: unknown): Primitive => {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value === null || value === undefined) return '';
  return String(value);
};

export const FosVar = (name: string): VarPattern => ({ kind: 'var', name });

const isVarPattern = (value: PatternValue): value is VarPattern =>
  typeof value === 'object' && value !== null && (value as VarPattern).kind === 'var';

const unify = (
  pattern: PatternValue,
  candidate: unknown,
  bindings: Record<string, unknown>
): Record<string, unknown> | null => {
  if (isVarPattern(pattern)) {
    const existing = bindings[pattern.name];
    if (existing === undefined) {
      bindings[pattern.name] = candidate;
      return bindings;
    }
    return JSON.stringify(existing) === JSON.stringify(candidate) ? bindings : null;
  }

  if (isObject(pattern)) {
    if (!isObject(candidate)) return null;
    for (const key of Object.keys(pattern)) {
      const nextBindings = unify(pattern[key]!, candidate[key], bindings);
      if (!nextBindings) return null;
      bindings = nextBindings;
    }
    return bindings;
  }

  return Object.is(pattern, candidate) ? bindings : null;
};

class UnionFind {
  private parent = new Map<string, string>();
  private rank = new Map<string, number>();

  private ensure(value: string) {
    if (!this.parent.has(value)) {
      this.parent.set(value, value);
      this.rank.set(value, 0);
    }
  }

  find(value: string): string {
    this.ensure(value);
    const parent = this.parent.get(value)!;
    if (parent !== value) {
      const root = this.find(parent);
      this.parent.set(value, root);
      return root;
    }
    return parent;
  }

  union(a: string, b: string) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return;
    const rankA = this.rank.get(rootA)!;
    const rankB = this.rank.get(rootB)!;
    if (rankA < rankB) {
      this.parent.set(rootA, rootB);
    } else if (rankA > rankB) {
      this.parent.set(rootB, rootA);
    } else {
      this.parent.set(rootB, rootA);
      this.rank.set(rootA, rankA + 1);
    }
  }

  touch(value: string) {
    this.ensure(value);
  }

  groups(): string[][] {
    const clusters = new Map<string, Set<string>>();
    for (const value of this.parent.keys()) {
      const root = this.find(value);
      if (!clusters.has(root)) {
        clusters.set(root, new Set());
      }
      clusters.get(root)!.add(value);
    }
    return Array.from(clusters.values()).map(group => Array.from(group));
  }
}

type HoleHandler = (value: Record<string, unknown>, runtime: FosRuntime) => void;

export class FosRuntime {
  private facts: Fact[] = [];
  private eventStream = new EventStream();
  private holeHandlers = new Map<string, HoleHandler>();
  private storage: EventStorage;
  private homotopies = new Map<string, UnionFind>();
  private predicateToType: Record<string, string>;
  private linearResources = new Map<string, Map<string, LinearResourceState>>();

  constructor(private definition: ProgramDefinition, storage?: EventStorage) {
    this.storage = storage ?? new MemoryEventStorage();
    this.predicateToType = definition.predicateToType;
    const existing = this.storage.load();
    existing.forEach(event => this.applyEvent(event));
  }

  subscribe(listener: (event: FosEvent) => void) {
    return this.eventStream.subscribe(listener);
  }

  describeType(name: string) {
    const type = this.definition.types[name];
    if (!type) throw new Error(`Unknown type ${name}`);
    return type;
  }

  getProgramName() {
    return this.definition.name;
  }

  getTypeDimension(name: string) {
    return this.describeType(name).dimension;
  }

  getHoles() {
    return [...this.definition.holes];
  }

  registerHoleHandler(holeName: string, handler: HoleHandler) {
    this.holeHandlers.set(holeName, handler);
  }

  callEndpoint(holeName: string, value: Record<string, unknown>, options?: CallEndpointOptions) {
    const descriptor = this.definition.holes.find(h => h.name === holeName);
    if (!descriptor) throw new Error(`Unknown hole ${holeName}`);
    const normalized = this.normalizeStructValue(descriptor.typeName, value);
    this.validateStructValue(descriptor.typeName, normalized);

    const consumptionRecords: ConsumptionRequest[] = [...(options?.consumeLinear ?? [])];
    if (descriptor.pi?.modality === 'linear' && descriptor.pi.viaField) {
      const identityValue = normalized[descriptor.pi.viaField];
      if (identityValue !== undefined && identityValue !== null) {
        consumptionRecords.push({
          typeName: descriptor.pi.parameter,
          identity: String(identityValue),
        });
      }
    }
    this.verifyLinearRequests(consumptionRecords);

    const event: FosEvent = { kind: 'hole-filled', holeName, value: normalized, timestamp: Date.now() };
    this.persistEvent(event);
    const factPredicate = descriptor.factPredicate ?? this.describeType(descriptor.typeName).predicate;
    this.assertFact(factPredicate, normalized);
    this.consumeLinearRequests(consumptionRecords);
    const handler = this.holeHandlers.get(holeName);
    if (handler) handler(normalized, this);
  }

  assertFact(predicate: string, args: Record<string, unknown>) {
    const fact: Fact = { predicate, args: clone(args), timestamp: Date.now() };
    const event: FosEvent = { kind: 'fact-asserted', fact, timestamp: fact.timestamp };
    this.persistEvent(event);
  }

  private persistEvent(event: FosEvent) {
    this.applyEvent(event);
    this.storage.append(event);
    this.eventStream.emit(event);
  }

  private applyEvent(event: FosEvent) {
    if (event.kind === 'fact-asserted') {
      this.applyFact(event.fact);
      return;
    }

    if (event.kind === 'hole-filled') {
      return;
    }

    if (event.kind === 'linear-consumed') {
      this.markLinearConsumed(event.typeName, event.identity);
      return;
    }
  }

  private findTypeByPredicate(predicate: string) {
    const typeName = this.predicateToType[predicate];
    return typeName ? this.definition.types[typeName] : undefined;
  }

  private applyFact(fact: Fact) {
    this.facts.push(fact);
    const descriptor = this.findTypeByPredicate(fact.predicate);
    if (!descriptor) return;
    if (descriptor.kind === 'struct' || descriptor.kind === 'sigma' || descriptor.kind === 'pi') {
      this.registerIdentityValue(descriptor, fact.args, fact);
    } else if (descriptor.kind === 'observation') {
      this.applyObservationFact(descriptor, fact);
    }
  }

  private getUnionFind(typeName: string) {
    if (!this.homotopies.has(typeName)) {
      this.homotopies.set(typeName, new UnionFind());
    }
    return this.homotopies.get(typeName)!;
  }

  private registerIdentityValue(descriptor: StructTypeDescriptor, value: Record<string, unknown>, fact: Fact) {
    const identityField = descriptor.identityField;
    if (!identityField) return;
    const identity = value[identityField];
    if (identity === undefined || identity === null) return;
    const identityStr = String(identity);
    this.getUnionFind(descriptor.name).touch(identityStr);
    if (descriptor.modality === 'linear') {
      const resources = this.ensureLinearTable(descriptor.name);
      const existing = resources.get(identityStr);
      if (!existing) {
        resources.set(identityStr, { identity: identityStr, consumed: false, fact });
      } else if (!existing.fact) {
        existing.fact = fact;
      }
    }
  }

  private applyObservationFact(descriptor: StructTypeDescriptor, fact: Fact) {
    if (!descriptor.observes) return;
    const observedDescriptor = this.describeType(descriptor.observes);
    const identityField = observedDescriptor.identityField;
    if (!identityField) return;
    const sourceField = descriptor.sourceField ?? 'from';
    const targetField = descriptor.targetField ?? 'to';
    const source = fact.args[sourceField];
    const target = fact.args[targetField];
    if (source === undefined || target === undefined) return;
    this.getUnionFind(observedDescriptor.name).union(String(source), String(target));
  }

  getEquivalenceClasses(typeName: string) {
    const uf = this.homotopies.get(typeName);
    if (!uf) return [];
    return uf.groups();
  }

  getLinearResources(typeName: string) {
    const table = this.linearResources.get(typeName);
    if (!table) return [];
    return Array.from(table.values());
  }

  private verifyLinearRequests(records: ConsumptionRequest[]) {
    records.forEach(record => {
      const table = this.linearResources.get(record.typeName);
      if (!table || !table.has(record.identity)) {
        throw new Error(`Linear resource ${record.identity} of type ${record.typeName} is not available.`);
      }
      const state = table.get(record.identity)!;
      if (state.consumed) {
        throw new Error(`Linear resource ${record.identity} of type ${record.typeName} has already been consumed.`);
      }
    });
  }

  private consumeLinearRequests(records: ConsumptionRequest[]) {
    records.forEach(record => {
      const event: FosEvent = {
        kind: 'linear-consumed',
        typeName: record.typeName,
        identity: record.identity,
        timestamp: Date.now(),
      };
      this.persistEvent(event);
    });
  }

  private markLinearConsumed(typeName: string, identity: string) {
    const table = this.linearResources.get(typeName);
    if (!table || !table.has(identity)) return;
    table.get(identity)!.consumed = true;
  }

  private ensureLinearTable(typeName: string) {
    if (!this.linearResources.has(typeName)) {
      this.linearResources.set(typeName, new Map());
    }
    return this.linearResources.get(typeName)!;
  }

  queryFacts(pattern: QueryPattern): QueryResult[] {
    const relevant = this.facts.filter(fact => fact.predicate === pattern.predicate);
    return relevant
      .map(fact => {
        const initialBindings: Record<string, unknown> = {};
        const argsPattern = pattern.args;
        if (!argsPattern) {
          return {
            fact,
            bindings: {},
          };
        }
        const unified = unify(argsPattern as PatternValue, fact.args, initialBindings);
        if (!unified) return null;
        return {
          fact,
          bindings: unified,
        };
      })
      .filter((result): result is QueryResult => result !== null);
  }

  createBlankValue(typeName: string) {
    const descriptor = this.describeType(typeName);
    const accumulator: Record<string, unknown> = {};
    descriptor.fields.forEach(field => {
      const context = { ...accumulator };
      const resolved = resolveType(field.type, context);
      if (resolved.kind === 'literal') {
        accumulator[field.name] = resolved.value;
      } else if (resolved.kind === 'scalar') {
        accumulator[field.name] = '';
      }
    });
    return accumulator;
  }

  normalizeStructValue(typeName: string, draft: Record<string, unknown>) {
    const descriptor = this.describeType(typeName);
    const normalized: Record<string, unknown> = {};
    descriptor.fields.forEach(field => {
      const context = { ...draft, ...normalized };
      const resolved = resolveType(field.type, context);
      if (resolved.kind === 'literal') {
        normalized[field.name] = resolved.value;
      } else if (resolved.kind === 'scalar') {
        normalized[field.name] = tryNormalizePrimitive(draft[field.name]);
      }
    });
    return normalized;
  }

  validateStructValue(typeName: string, value: Record<string, unknown>) {
    const descriptor = this.describeType(typeName);
    descriptor.fields.forEach(field => {
      if (!field.optional && !(field.name in value)) {
        throw new Error(`Missing value for ${field.name}`);
      }
      const resolved = resolveType(field.type, value);
      const current = value[field.name];
      if (resolved.kind === 'literal' && current !== resolved.value) {
        throw new Error(`Field ${field.name} must equal ${resolved.value}`);
      }
      if (resolved.kind === 'scalar') {
        if (resolved.base === 'String' && typeof current !== 'string') {
          throw new Error(`Field ${field.name} must be a string`);
        }
      }
    });
  }
}

export interface FosCliTransport {
  write(message: string): void;
  onLine(listener: (line: string) => void): void;
}

// eslint-disable-next-line react-refresh/only-export-components
export const attachCliServer = (runtime: FosRuntime, transport: FosCliTransport) => {
  const helpText = [
    'Commands:',
    '- add <description> : fills the Todo hole using the provided description',
    '- ticket <id> [scope] : mints a linear ticket identified by <id>',
    '- list               : prints all todo facts',
    '- query <term>       : prints todos whose description matches the provided term',
    '- help               : prints this message',
  ];

  transport.write(`Fos runtime ${runtime.getProgramName()} ready.\n`);
  transport.write(helpText.join('\n') + '\n');

  transport.onLine(line => {
    const [command, ...rest] = line.trim().split(' ');
    if (!command) return;
    if (command === 'help') {
      transport.write(helpText.join('\n') + '\n');
      return;
    }
    if (command === 'add') {
      const description = rest.join(' ');
      if (!description) {
        transport.write('Description required.\n');
        return;
      }
      runtime.callEndpoint('createTodo', { description });
      transport.write('Added todo via hole endpoint.\n');
      return;
    }
    if (command === 'ticket') {
      if (rest.length === 0) {
        transport.write('Usage: ticket <id> [scope]\n');
        return;
      }
      const [ticketId, ...scopeParts] = rest;
      const scope = scopeParts.join(' ') || 'cli';
      runtime.callEndpoint('issueTicket', {
        ticketId,
        scope,
        issued: new Date().toISOString(),
      });
      transport.write(`Issued ticket ${ticketId} scoped to "${scope}".\n`);
      return;
    }
    if (command === 'list') {
      const results = runtime.queryFacts({ predicate: 'todo' });
      transport.write(JSON.stringify(results.map(result => result.fact.args), null, 2) + '\n');
      return;
    }
    if (command === 'query') {
      const needle = rest.join(' ');
      const results = runtime.queryFacts({
        predicate: 'todo',
        args: {
          description: needle || FosVar('description'),
        },
      });
      transport.write(JSON.stringify(results.map(result => result.fact.args), null, 2) + '\n');
      return;
    }
    transport.write('Unknown command. Type "help" for options.\n');
  });
};

const useFosRuntime = (definition: ProgramDefinition) => {
  const storage = useMemo(() => new LocalStorageEventStorage(`fos.events.${definition.name}`), [definition.name]);
  const runtime = useMemo(() => new FosRuntime(definition, storage), [definition, storage]);
  const [, setTick] = useState(0);

  useEffect(() => runtime.subscribe(() => setTick(tick => tick + 1)), [runtime]);

  return runtime;
};

export const FosWrapperComponent: React.FC = () => {
  const programAst = useMemo(
    () => (
      <ProgramNode name="TodoRuntime">
        <TypeNode name="TodoTicket" label="Todo Ticket" predicate="todoTicket" identity="ticketId" modality="linear" form="sigma">
          <FieldNode name="ticketId" label="Ticket ID" type={scalar('String')} />
          <FieldNode name="scope" label="Scope" type={scalar('String')} />
          <FieldNode
            name="issued"
            label="Issued At"
            type={() => literal(new Date().toISOString())}
          />
        </TypeNode>
        <TypeNode name="Todo" label="Todo Item" predicate="todo" identity="slug">
          <FieldNode name="description" label="Task description" type={scalar('String', true)} />
          <FieldNode
            name="slug"
            label="Slug"
            type={(ctx: Record<string, unknown>) => literal(slugify((ctx.description as string) ?? ''))}
          />
          <FieldNode name="ticketId" label="Ticket" type={scalar('String')} />
        </TypeNode>
        <TypeNode
          name="TodoPath"
          label="Todo Homotopy"
          predicate="todoPath"
          observes="Todo"
          sourceField="fromSlug"
          targetField="toSlug"
        >
          <FieldNode name="fromSlug" label="From Todo" type={scalar('String')} />
          <FieldNode name="toSlug" label="To Todo" type={scalar('String')} />
          <FieldNode name="witness" label="Witness" type={scalar('String', true)} input="textarea" />
        </TypeNode>
        <TypeNode name="Budget" label="Budget" predicate="budget" identity="id" form="sigma" modality="cartesian">
          <FieldNode name="id" label="Budget ID" type={scalar('String')} />
          <FieldNode name="label" label="Label" type={scalar('String')} />
          <FieldNode name="balance" label="Balance" type={scalar('Number')} />
        </TypeNode>
        <TypeNode name="Time" label="Calendar" predicate="calendar" identity="id" form="sigma" modality="cartesian">
          <FieldNode name="id" label="Calendar ID" type={scalar('String')} />
          <FieldNode name="label" label="Label" type={scalar('String')} />
          <FieldNode name="hours" label="Available Hours" type={scalar('Number')} />
        </TypeNode>
        <HoleNode
          name="createTodo"
          description="Captures new todo tasks when the dependent hole is filled."
          type="Todo"
          fact="todo"
          pi={{ parameter: 'TodoTicket', viaField: 'ticketId', modality: 'linear' }}
        />
        <HoleNode
          name="issueTicket"
          description="Mints a linear Todo ticket (Sigma type) that must be spent once."
          type="TodoTicket"
          fact="todoTicket"
        />
        <HoleNode
          name="linkTodos"
          description="Registers a higher observational path between two todos."
          type="TodoPath"
          fact="todoPath"
        />
      </ProgramNode>
    ),
    []
  );

  const programDefinition = useMemo(() => interpretProgram(programAst), [programAst]);
  const runtime = useFosRuntime(programDefinition);

  return (
    <div className="flex flex-col gap-10">
      <FosScopeBuilder
        holes={runtime.getHoles()}
        createBlankValue={typeName => runtime.createBlankValue(typeName)}
        normalizeStructValue={(typeName, value) => runtime.normalizeStructValue(typeName, value)}
        describeType={typeName => runtime.describeType(typeName)}
        callEndpoint={(holeName, value) => runtime.callEndpoint(holeName, value)}
        getLinearResources={typeName => runtime.getLinearResources(typeName)}
      />
    </div>
  );
};
