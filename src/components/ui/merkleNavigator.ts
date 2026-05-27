export type ContentId = `cid:${string}`;
export type AliasId = `alias:${string}`;

interface DirectoryEntryNodeRef {
  kind: 'node';
  targetId: ContentId;
}

interface DirectoryEntryAliasRef {
  kind: 'alias';
  aliasId: AliasId;
}

export type DirectoryEntryRef = DirectoryEntryNodeRef | DirectoryEntryAliasRef;

export interface DirectoryEntry {
  name: string;
  ref: DirectoryEntryRef;
}

export interface DirectoryNode {
  kind: 'directory';
  id: ContentId;
  entries: ReadonlyArray<DirectoryEntry>;
  metadata?: Record<string, unknown>;
}

export interface SymlinkLeaf {
  kind: 'symlink';
  id: ContentId;
  targetUri: string;
  metadata?: Record<string, unknown>;
}

export type MerkleNode = DirectoryNode | SymlinkLeaf;

export interface MutableAlias {
  aliasId: AliasId;
  targetId: ContentId;
  description?: string;
}

export interface MerkleStore {
  rootId: ContentId;
  nodes: Record<ContentId, MerkleNode>;
  aliases?: Record<AliasId, MutableAlias>;
}

export interface BreadcrumbParentOption {
  parentId: ContentId;
  entryName: string;
  viaAlias?: AliasId;
}

export interface Breadcrumb {
  label: string;
  nodeId: ContentId;
  parentOptions: ReadonlyArray<BreadcrumbParentOption>;
}

export interface DirectoryListingEntry {
  name: string;
  targetId: ContentId;
  targetKind: MerkleNode['kind'];
  viaAlias?: AliasId;
}

export interface ResolvedDirectory {
  crumbs: ReadonlyArray<Breadcrumb>;
  entries: ReadonlyArray<DirectoryListingEntry>;
  activeNode: MerkleNode;
}

const canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nestedValue]) => `${JSON.stringify(key)}:${canonicalJson(nestedValue)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const generateRandomString = (): string => {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const simpleHash = (input: string): string => {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const deriveContentId = (payload: unknown): ContentId => {
  const canonicalPayload = canonicalJson(payload);
  const digest = simpleHash(canonicalPayload + generateRandomString());
  return `cid:${digest}`;
};

const normalizeDirectoryEntries = (entries: DirectoryEntry[]): DirectoryEntry[] =>
  [...entries].sort((a, b) => {
    const nameCompare = a.name.localeCompare(b.name);
    if (nameCompare !== 0) {
      return nameCompare;
    }

    if (a.ref.kind === 'node' && b.ref.kind === 'node') {
      return a.ref.targetId.localeCompare(b.ref.targetId);
    }

    if (a.ref.kind === 'alias' && b.ref.kind === 'alias') {
      return a.ref.aliasId.localeCompare(b.ref.aliasId);
    }

    return a.ref.kind === 'node' ? -1 : 1;
  });

export const createSymlinkLeaf = (params: {
  targetUri: string;
  metadata?: Record<string, unknown>;
}): SymlinkLeaf => {
  const payload = { kind: 'symlink', targetUri: params.targetUri, metadata: params.metadata ?? {} };
  return {
    kind: 'symlink',
    targetUri: params.targetUri,
    metadata: params.metadata,
    id: deriveContentId(payload),
  };
};

export const createDirectoryNode = (params: {
  entries: DirectoryEntry[];
  metadata?: Record<string, unknown>;
}): DirectoryNode => {
  const normalizedEntries = normalizeDirectoryEntries(params.entries);
  const payload = {
    kind: 'directory',
    metadata: params.metadata ?? {},
    entries: normalizedEntries.map(entry => ({
      name: entry.name,
      ref: entry.ref.kind === 'node'
        ? { kind: 'node', targetId: entry.ref.targetId }
        : { kind: 'alias', aliasId: entry.ref.aliasId },
    })),
  };

  return {
    kind: 'directory',
    metadata: params.metadata,
    entries: normalizedEntries,
    id: deriveContentId(payload),
  };
};

export const createAlias = (targetId: ContentId, description?: string, aliasId?: AliasId): MutableAlias => ({
  aliasId: aliasId ?? (`alias:${generateRandomString()}` as AliasId),
  targetId,
  description,
});

const followRef = (
  ref: DirectoryEntryRef,
  aliases: ReadonlyMap<AliasId, MutableAlias>,
): { nodeId: ContentId; viaAlias?: AliasId } => {
  if (ref.kind === 'node') {
    return { nodeId: ref.targetId };
  }

  const alias = aliases.get(ref.aliasId);
  if (!alias) {
    throw new Error(`Alias ${ref.aliasId} does not exist`);
  }

  return { nodeId: alias.targetId, viaAlias: alias.aliasId };
};

export class MerkleNavigator {
  private readonly nodes = new Map<ContentId, MerkleNode>();
  private readonly aliases = new Map<AliasId, MutableAlias>();
  private readonly parentIndex = new Map<ContentId, BreadcrumbParentOption[]>();

  constructor(private readonly store: MerkleStore) {
    Object.entries(store.nodes).forEach(([id, node]) => this.nodes.set(id as ContentId, node));
    Object.entries(store.aliases ?? {}).forEach(([aliasId, alias]) =>
      this.aliases.set(aliasId as AliasId, alias),
    );

    if (!this.nodes.has(store.rootId)) {
      throw new Error(`Unknown root id ${store.rootId}`);
    }

    this.buildParentIndex();
    this.assertAcyclic();
  }

  public resolvePath(segments: string[] = []): ResolvedDirectory {
    const crumbs: Breadcrumb[] = [];
    let currentId = this.store.rootId;

    crumbs.push(this.createBreadcrumb('root', currentId));

    for (const segment of segments) {
      const directory = this.expectDirectory(currentId, segment);
      const entry = directory.entries.find(child => child.name === segment);
      if (!entry) {
        throw new Error(`Missing entry "${segment}" under ${currentId}`);
      }

      const { nodeId } = followRef(entry.ref, this.aliases);
      const node = this.expectNode(nodeId);
      crumbs.push(this.createBreadcrumb(segment, node.id));

      if (node.kind === 'directory') {
        currentId = node.id;
        continue;
      }

      // Stop navigation for leaf nodes; breadcrumbs should still include the leaf.
      currentId = node.id;
      break;
    }

    const activeNode = this.expectNode(currentId);
    const entries =
      activeNode.kind === 'directory'
        ? activeNode.entries.map(child => {
            const { nodeId, viaAlias } = followRef(child.ref, this.aliases);
            const node = this.expectNode(nodeId);
            return {
              name: child.name,
              targetId: node.id,
              targetKind: node.kind,
              viaAlias,
            };
          })
        : [];

    return { crumbs, entries, activeNode };
  }

  private expectNode(id: ContentId): MerkleNode {
    const node = this.nodes.get(id);
    if (!node) {
      throw new Error(`Unknown node ${id}`);
    }

    return node;
  }

  private expectDirectory(id: ContentId, segment: string): DirectoryNode {
    const node = this.expectNode(id);
    if (node.kind !== 'directory') {
      throw new Error(`Cannot enter "${segment}" because ${id} is not a directory`);
    }

    return node;
  }

  private createBreadcrumb(label: string, nodeId: ContentId): Breadcrumb {
    const parentOptions = this.parentIndex.get(nodeId) ?? [];
    return { label, nodeId, parentOptions };
  }

  private buildParentIndex(): void {
    for (const node of this.nodes.values()) {
      if (node.kind !== 'directory') {
        continue;
      }

      node.entries.forEach(entry => {
        const { nodeId, viaAlias } = followRef(entry.ref, this.aliases);
        const list = this.parentIndex.get(nodeId) ?? [];
        list.push({ parentId: node.id, entryName: entry.name, viaAlias });
        this.parentIndex.set(nodeId, list);
      });
    }
  }

  private assertAcyclic(): void {
    const visiting = new Set<ContentId>();
    const visited = new Set<ContentId>();

    const visit = (nodeId: ContentId) => {
      if (visiting.has(nodeId)) {
        throw new Error(`Cycle detected at ${nodeId}`);
      }

      if (visited.has(nodeId)) {
        return;
      }

      visiting.add(nodeId);
      const node = this.nodes.get(nodeId);
      if (node?.kind === 'directory') {
        node.entries.forEach(entry => {
          if (entry.ref.kind === 'node') {
            visit(entry.ref.targetId);
          }
        });
      }

      visiting.delete(nodeId);
      visited.add(nodeId);
    };

    visit(this.store.rootId);
  }
}
