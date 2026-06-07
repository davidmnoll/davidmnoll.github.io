import { useState, useCallback, DragEvent } from 'react';

// ============ Types ============

// A step in a derivation (always pow/exponentiation for now)
interface DerivationStep {
  left: number;
  right: number;
  result: number;
}

// A captured value with its derivation tree
interface ContextEntry {
  id: string;
  value: number;
  labels: string[];
  derivation: DerivationStep[];
  expanded: boolean;
}

// A node being constructed (always uses pow/exponentiation)
interface WorkingNode {
  id: string;
  left: number | null;
  right: number | null;
}

// Draggable term data
interface DragData {
  type: 'term';
  value: number;
}

// ============ Helpers ============

const genId = () => Math.random().toString(36).slice(2, 9);

// Compute pow result
const computeResult = (left: number, right: number): number | null => {
  try {
    const result = BigInt(left) ** BigInt(right);
    if (result <= BigInt(Number.MAX_SAFE_INTEGER)) {
      return Number(result);
    }
    return null;
  } catch {
    return null;
  }
};

// ============ Drag & Drop ============

const setDragData = (e: DragEvent, data: DragData) => {
  e.dataTransfer.setData('application/json', JSON.stringify(data));
  e.dataTransfer.effectAllowed = 'copy';
};

const getDragData = (e: DragEvent): DragData | null => {
  try {
    return JSON.parse(e.dataTransfer.getData('application/json'));
  } catch {
    return null;
  }
};

// ============ Components ============

// Draggable number chip
function NumberChip({ value }: { value: number }) {
  const dragData: DragData = { type: 'term', value };

  return (
    <span
      draggable
      onDragStart={(e) => setDragData(e, dragData)}
      className="bg-purple-600 px-2 py-1 rounded text-sm font-mono cursor-grab active:cursor-grabbing select-none hover:brightness-110 transition-all"
    >
      {value}
    </span>
  );
}

// Draggable alias chip (points to a number)
function AliasChip({ label, value, onRemove }: { label: string; value: number; onRemove: () => void }) {
  const dragData: DragData = { type: 'term', value };

  return (
    <span
      draggable
      onDragStart={(e) => setDragData(e, dragData)}
      className="group relative bg-cyan-600 px-2 py-1 rounded text-sm font-mono cursor-grab active:cursor-grabbing select-none hover:brightness-110 transition-all"
    >
      {label}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-400 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ×
      </button>
    </span>
  );
}

// Drop zone for a value slot
function ValueSlot({ value, onChange, availableValues, placeholder }: {
  value: number | null;
  onChange: (value: number | null) => void;
  availableValues: number[];
  placeholder: string;
}) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsOver(true);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const data = getDragData(e);
    if (data && availableValues.includes(data.value)) {
      onChange(data.value);
    }
  };

  if (value === null) {
    return (
      <div
        onDragOver={handleDragOver}
        onDragLeave={() => setIsOver(false)}
        onDrop={handleDrop}
        className={`inline-flex items-center justify-center min-w-[3rem] h-8 border-2 border-dashed rounded px-2 transition-colors ${
          isOver ? 'border-purple-400 bg-purple-900/30' : 'border-gray-600 bg-gray-900/50'
        }`}
      >
        <span className="text-gray-500 text-sm">{placeholder}</span>
      </div>
    );
  }

  const isValid = availableValues.includes(value);

  return (
    <div className={`group relative inline-flex items-center ${isValid ? 'bg-purple-700' : 'bg-red-700'} rounded px-2 py-1`}>
      <span className="text-white font-mono text-sm">{value}</span>
      <button
        onClick={() => onChange(null)}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-400 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
      >
        ×
      </button>
    </div>
  );
}

// Add alias button/input
function AddAliasButton({ onAdd }: { onAdd: (label: string) => void }) {
  const [adding, setAdding] = useState(false);
  const [inputValue, setInputValue] = useState('');

  if (adding) {
    return (
      <input
        autoFocus
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={() => {
          if (inputValue.trim()) onAdd(inputValue.trim());
          setAdding(false);
          setInputValue('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && inputValue.trim()) {
            onAdd(inputValue.trim());
            setAdding(false);
            setInputValue('');
          } else if (e.key === 'Escape') {
            setAdding(false);
            setInputValue('');
          }
        }}
        placeholder="alias"
        className="w-20 bg-gray-800 text-cyan-400 font-mono px-2 py-1 rounded border border-cyan-600 focus:outline-none text-sm"
      />
    );
  }

  return (
    <button
      onClick={() => setAdding(true)}
      className="text-gray-500 hover:text-gray-300 text-sm px-2 py-1 border border-dashed border-gray-600 rounded hover:border-gray-400 transition-colors"
    >
      +alias
    </button>
  );
}

// Derivation tree display (collapsible)
function DerivationTree({ derivation, expanded, onToggle }: {
  derivation: DerivationStep[];
  expanded: boolean;
  onToggle: () => void;
}) {
  if (derivation.length === 0) {
    return <span className="text-gray-500 text-xs">(primitive)</span>;
  }

  return (
    <div>
      <button
        onClick={onToggle}
        className="text-gray-400 hover:text-gray-200 text-xs flex items-center gap-1"
      >
        <span className={`transition-transform ${expanded ? 'rotate-90' : ''}`}>▶</span>
        {derivation.length} step{derivation.length > 1 ? 's' : ''}
      </button>
      {expanded && (
        <div className="ml-4 mt-1 space-y-1 border-l border-gray-700 pl-2">
          {derivation.map((step, i) => (
            <div key={i} className="text-xs font-mono text-gray-400">
              {step.left}^{step.right} = <span className="text-green-400">{step.result}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ Main Component ============

export function CoinductiveLangDemo() {
  // Context: captured values with derivations
  const [context, setContext] = useState<ContextEntry[]>([
    { id: genId(), value: 0, labels: [], derivation: [], expanded: false }  // Start with 0 (primitive)
  ]);

  // Working nodes being constructed
  const [workingNodes, setWorkingNodes] = useState<WorkingNode[]>([
    { id: genId(), left: null, right: null }
  ]);

  // Get available values: from context + from complete working nodes
  const contextValues = context.map(e => e.value);

  // Check if a node is complete (all required operands filled)
  const isNodeComplete = (node: WorkingNode): boolean => {
    return node.left !== null && node.right !== null;
  };

  // Compute working node results and build available values including intermediate results
  const getWorkingResults = (): Map<string, number> => {
    const results = new Map<string, number>();
    const available = new Set(contextValues);

    for (const node of workingNodes) {
      if (isNodeComplete(node) &&
          available.has(node.left!) && available.has(node.right!)) {
        const result = computeResult(node.left!, node.right!);
        if (result !== null) {
          results.set(node.id, result);
          available.add(result);
        }
      }
    }
    return results;
  };

  const workingResults = getWorkingResults();

  // Available values = context + working results
  const availableValues = [...new Set([...contextValues, ...workingResults.values()])];

  // Get complete derivation steps from working nodes
  const getDerivationSteps = (): DerivationStep[] => {
    const steps: DerivationStep[] = [];
    for (const node of workingNodes) {
      const result = workingResults.get(node.id);
      if (result !== undefined && isNodeComplete(node)) {
        steps.push({ left: node.left!, right: node.right!, result });
      }
    }
    return steps;
  };

  // Get final result (sum of all step results)
  const derivationSteps = getDerivationSteps();
  const finalResult = derivationSteps.length > 0
    ? derivationSteps.reduce((sum, step) => sum + step.result, 0)
    : null;

  // Check if we have any complete nodes to capture
  const hasCompleteNodes = derivationSteps.length > 0;

  // Get used (left, right) pairs in working nodes
  const getUsedPairs = (nodes: WorkingNode[]): Set<string> => {
    const used = new Set<string>();
    for (const node of nodes) {
      if (isNodeComplete(node)) {
        used.add(`${node.left},${node.right}`);
      }
    }
    return used;
  };

  // Check if there are any unused pairs available
  const hasUnusedPairs = (nodes: WorkingNode[], available: number[]): boolean => {
    const used = getUsedPairs(nodes);

    for (const left of available) {
      for (const right of available) {
        if (!used.has(`${left},${right}`)) {
          return true;
        }
      }
    }

    return false;
  };

  // Check if a node is empty (no operands filled)
  const isNodeEmpty = (node: WorkingNode): boolean => {
    return node.left === null && node.right === null;
  };

  // Ensure there's an empty row at the end only if there are unused pairs
  // NOTE: We use CONTEXT values only for determining if new rows should appear
  const ensureEmptyRow = useCallback((nodes: WorkingNode[]): WorkingNode[] => {
    const lastNode = nodes[nodes.length - 1];
    const lastIsComplete = lastNode && isNodeComplete(lastNode);
    const lastIsEmpty = lastNode && isNodeEmpty(lastNode);

    // Check unused pairs against CONTEXT values only
    const hasUnused = hasUnusedPairs(nodes, contextValues);

    // If last node is complete and there are unused pairs, add empty row
    if (lastIsComplete && hasUnused) {
      return [...nodes, { id: genId(), left: null, right: null }];
    }

    // If last node is empty but no unused pairs, remove it
    if (lastIsEmpty && !hasUnusedPairs(nodes.slice(0, -1), contextValues)) {
      return nodes.slice(0, -1);
    }

    return nodes;
  }, [contextValues]);

  // Capture all working nodes into context
  const captureNodes = useCallback(() => {
    if (!hasCompleteNodes || finalResult === null) return;

    // Check if the final value already exists
    const existing = context.find(e => e.value === finalResult);
    if (!existing) {
      setContext(prev => [...prev, {
        id: genId(),
        value: finalResult,
        labels: [],
        derivation: derivationSteps,
        expanded: false
      }]);
    }

    // Reset working nodes
    setWorkingNodes([{ id: genId(), left: null, right: null }]);
  }, [hasCompleteNodes, finalResult, derivationSteps, context]);

  // Update a working node (with duplicate check)
  const updateNode = useCallback((nodeId: string, field: 'left' | 'right', value: number | null) => {
    setWorkingNodes(prev => {
      const updated = prev.map(n => {
        if (n.id !== nodeId) return n;
        const newNode = { ...n, [field]: value };

        // Check if this would create a duplicate pair
        if (isNodeComplete(newNode)) {
          const pairKey = `${newNode.left},${newNode.right}`;
          const existingPairs = getUsedPairs(prev.filter(p => p.id !== nodeId));
          if (existingPairs.has(pairKey)) {
            return n; // Reject the update
          }
        }

        return newNode;
      });

      return ensureEmptyRow(updated);
    });
  }, [ensureEmptyRow]);

  // Clear a working node
  const clearNode = useCallback((nodeId: string) => {
    setWorkingNodes(prev => {
      const filtered = prev.filter(n => n.id !== nodeId);
      if (filtered.length === 0) {
        return [{ id: genId(), left: null, right: null }];
      }
      return ensureEmptyRow(filtered);
    });
  }, [ensureEmptyRow]);

  // Clear all working nodes
  const clearAllNodes = useCallback(() => {
    setWorkingNodes([{ id: genId(), left: null, right: null }]);
  }, []);

  // Toggle derivation expansion
  const toggleExpanded = useCallback((id: string) => {
    setContext(prev => prev.map(e => e.id === id ? { ...e, expanded: !e.expanded } : e));
  }, []);

  // Update labels
  const updateLabels = useCallback((id: string, labels: string[]) => {
    setContext(prev => prev.map(e => e.id === id ? { ...e, labels } : e));
  }, []);

  // Remove entry (except 0)
  const removeEntry = useCallback((id: string) => {
    setContext(prev => prev.filter(e => e.id !== id || e.value === 0));
  }, []);

  // Compute environment encoding
  const encoding = context.reduce((sum, e) => sum + BigInt(e.value), BigInt(0));

  return (
    <div className="space-y-6">
      {/* Context */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3 text-white">Context</h3>

        <div className="space-y-2">
          {context.map(entry => (
            <div key={entry.id} className="group/entry p-2 bg-gray-900 rounded">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Draggable number */}
                <NumberChip value={entry.value} />

                {/* Draggable aliases */}
                {entry.labels.map(label => (
                  <AliasChip
                    key={label}
                    label={label}
                    value={entry.value}
                    onRemove={() => updateLabels(entry.id, entry.labels.filter(l => l !== label))}
                  />
                ))}

                {/* Add alias */}
                <AddAliasButton
                  onAdd={(label) => {
                    if (!entry.labels.includes(label)) {
                      updateLabels(entry.id, [...entry.labels, label]);
                    }
                  }}
                />

                {/* Remove entry */}
                {entry.value !== 0 && (
                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="text-red-400 hover:text-red-300 text-sm ml-auto opacity-0 group-hover/entry:opacity-100 transition-opacity"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Derivation tree */}
              <div className="mt-1">
                <DerivationTree
                  derivation={entry.derivation}
                  expanded={entry.expanded}
                  onToggle={() => toggleExpanded(entry.id)}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-700">
          <span className="text-gray-400 text-sm">Environment sum: </span>
          <span className="text-green-400 font-mono">{encoding.toString()}</span>
        </div>
      </div>

      {/* Node Builder */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-semibold mb-3 text-white">Build Node</h3>

        <div className="space-y-2">
          {workingNodes.map(node => {
            const result = workingResults.get(node.id);
            const isComplete = node.left !== null && node.right !== null;
            const isValid = isComplete &&
              availableValues.includes(node.left!) &&
              availableValues.includes(node.right!);

            return (
              <div key={node.id} className="p-3 bg-gray-900 rounded flex items-center gap-3 flex-wrap">
                <ValueSlot
                  value={node.left}
                  onChange={(v) => updateNode(node.id, 'left', v)}
                  availableValues={availableValues}
                  placeholder="base"
                />

                <span className="text-gray-400 text-lg">^</span>

                <ValueSlot
                  value={node.right}
                  onChange={(v) => updateNode(node.id, 'right', v)}
                  availableValues={availableValues}
                  placeholder="exp"
                />

                {isValid && result !== undefined && (
                  <>
                    <span className="text-gray-400">=</span>
                    <span className="text-green-400 font-mono text-lg">{result}</span>
                  </>
                )}

                {(node.left !== null || node.right !== null) && (
                  <button
                    onClick={() => clearNode(node.id)}
                    className="text-gray-400 hover:text-gray-300 text-sm ml-auto"
                  >
                    Clear
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Capture controls */}
        <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-3">
          <button
            onClick={captureNodes}
            disabled={!hasCompleteNodes}
            className={`px-4 py-2 rounded font-semibold transition-colors ${
              hasCompleteNodes
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }`}
          >
            Capture
          </button>

          {finalResult !== null && (
            <span className="text-gray-400 text-sm">
              Sum: {derivationSteps.map((s, i) => (
                <span key={i}>
                  {i > 0 && ' + '}
                  <span className="text-purple-400">{s.result}</span>
                </span>
              ))} = <span className="text-green-400 font-mono">{finalResult}</span>
              {context.some(e => e.value === finalResult) && (
                <span className="text-yellow-400 ml-2">(already in context)</span>
              )}
            </span>
          )}

          {hasCompleteNodes && (
            <button
              onClick={clearAllNodes}
              className="text-gray-400 hover:text-gray-300 text-sm"
            >
              Clear All
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
