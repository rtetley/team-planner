/**
 * updateSkillTree.ts
 *
 * Reads research_engineer.json from the project root, converts the flat node
 * list into a nested skill tree, and writes it to the database under
 * KEYS.skillTree so the Skills tab can serve it via the API.
 *
 * Usage:
 *   yarn update-skill-tree              (from the server/ directory)
 *   VALKEY_URL=redis://... tsx src/updateSkillTree.ts
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import path from 'path';
import { db, KEYS } from './db.js';

// ── Raw shapes from the JSON ──────────────────────────────────────────────────

interface RawNode {
  id: string;
  label: string;
  parentId: string | null;
  color?: string;
  position?: { x: number; y: number };
}

interface RawTree {
  treeId: string;
  version: number;
  nodes: RawNode[];
}

// ── Stored shape (returned by /api/skill-tree) ────────────────────────────────

export interface SkillTreeNode {
  id: string;
  label: string;
  color?: string;
  position?: { x: number; y: number };
  children?: SkillTreeNode[];
}

export interface SkillTreeDoc {
  treeId: string;
  version: number;
  root: SkillTreeNode;
}

// ── Tree builder ──────────────────────────────────────────────────────────────

function buildTree(nodes: RawNode[]): SkillTreeNode {
  // Map id → mutable node with a temporary _children accumulator
  const map = new Map<string, SkillTreeNode & { _children: (SkillTreeNode & { _children: unknown[] })[] }>();

  for (const n of nodes) {
    map.set(n.id, {
      id: n.id,
      label: n.label,
      ...(n.color    ? { color: n.color }       : {}),
      ...(n.position ? { position: n.position } : {}),
      _children: [],
    });
  }

  let rootEntry: (SkillTreeNode & { _children: (SkillTreeNode & { _children: unknown[] })[] }) | undefined;

  for (const n of nodes) {
    if (n.parentId === null) {
      rootEntry = map.get(n.id);
    } else {
      const parent = map.get(n.parentId);
      const child  = map.get(n.id);
      if (parent && child) parent._children.push(child);
      else if (!parent)    console.warn(`[UpdateSkillTree] Unknown parentId "${n.parentId}" for node "${n.id}"`);
    }
  }

  if (!rootEntry) throw new Error('No root node found (parentId === null)');

  // Recursively strip _children and promote to children
  function finalize(node: SkillTreeNode & { _children: unknown[] }): SkillTreeNode {
    const { _children, ...rest } = node as SkillTreeNode & { _children: (SkillTreeNode & { _children: unknown[] })[] };
    if (_children.length > 0) {
      return { ...rest, children: _children.map(finalize) };
    }
    return rest;
  }

  return finalize(rootEntry);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function updateSkillTree() {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  // research_engineer.json sits at the project root (two levels up from src/)
  const jsonPath = path.resolve(__dirname, '../../research_engineer.json');

  console.log(`[UpdateSkillTree] Reading ${jsonPath}…`);
  const raw = JSON.parse(await readFile(jsonPath, 'utf-8')) as RawTree;
  console.log(`[UpdateSkillTree] Parsed ${raw.nodes.length} nodes  (treeId: ${raw.treeId}, v${raw.version})`);

  const root = buildTree(raw.nodes);

  const doc: SkillTreeDoc = { treeId: raw.treeId, version: raw.version, root };

  const existing = await db.get(KEYS.skillTree);
  if (existing) {
    const prev = JSON.parse(existing) as SkillTreeDoc;
    if (prev.treeId === doc.treeId && prev.version === doc.version) {
      console.log('[UpdateSkillTree] Same treeId + version already in DB — use FORCE=1 to overwrite.');
      if (process.env.FORCE !== '1') { await db.quit(); return; }
    }
    console.log(`[UpdateSkillTree] Replacing existing tree (was v${prev.version})…`);
  }

  await db.set(KEYS.skillTree, JSON.stringify(doc));
  console.log(`[UpdateSkillTree] Done — skill tree stored under "${KEYS.skillTree}".`);

  await db.quit();
}

updateSkillTree().catch((err) => { console.error(err); process.exit(1); });
