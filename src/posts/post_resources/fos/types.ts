export type Primitive = string | number | boolean;
export type ScalarBase = 'String' | 'Number' | 'Boolean';
export type Modality = 'cartesian' | 'linear';
export type TypeFlavor = 'struct' | 'sigma' | 'pi' | 'observation';

export interface ScalarType {
  kind: 'scalar';
  base: ScalarBase;
  multiline?: boolean;
}

export interface LiteralType {
  kind: 'literal';
  value: Primitive;
}

export type FosTypeDescriptor = ScalarType | LiteralType;
export type TypeResolver = FosTypeDescriptor | ((ctx: Record<string, unknown>) => FosTypeDescriptor);

export interface FieldDescriptor {
  name: string;
  label?: string;
  type: TypeResolver;
  optional?: boolean;
  input?: 'text' | 'textarea';
}

export interface StructTypeDescriptor {
  name: string;
  label?: string;
  predicate: string;
  fields: FieldDescriptor[];
  identityField?: string;
  kind: TypeFlavor;
  observes?: string;
  dimension: number;
  sourceField?: string;
  targetField?: string;
  modality: Modality;
}

export interface HoleDescriptor {
  name: string;
  typeName: string;
  description?: string;
  factPredicate?: string;
  pi?: {
    parameter: string;
    viaField?: string;
    modality: Modality;
  };
}

export interface ProgramDefinition {
  name: string;
  types: Record<string, StructTypeDescriptor>;
  holes: HoleDescriptor[];
  predicateToType: Record<string, string>;
}

export interface Fact {
  predicate: string;
  args: Record<string, unknown>;
  timestamp: number;
}

export interface LinearResourceState {
  identity: string;
  consumed: boolean;
  fact?: Fact;
}

export interface ConsumptionRequest {
  typeName: string;
  identity: string;
}

export interface CallEndpointOptions {
  consumeLinear?: ConsumptionRequest[];
}

export const resolveType = (resolver: TypeResolver, ctx: Record<string, unknown>): FosTypeDescriptor =>
  typeof resolver === 'function' ? resolver(ctx) : resolver;

export const literal = (value: Primitive): LiteralType => ({ kind: 'literal', value });

export const scalar = (base: ScalarBase, multiline = false): ScalarType => ({ kind: 'scalar', base, multiline });
