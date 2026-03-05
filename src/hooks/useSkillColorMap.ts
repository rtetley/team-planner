/**
 * useSkillColorMap
 *
 * Fetches the skill tree once and returns two lookup Maps:
 *   byId    — node.id     → effective colour hex string
 *   byLabel — node.label (lowercased) → effective colour hex string
 *
 * The effective colour mirrors the logic in the three tree viewers:
 *   node.color (if set in the JSON) ?? PALETTE[colorKey].stroke
 *
 * These maps are used outside the tree viewers (Team, UserProfile, …) to
 * colour skill chips / badges consistently with the tree.
 */

import { useState, useEffect } from 'react';
import { skillTreeApi } from '../api';
import type { SkillTreeNode } from '../types';

// ── Palette — must stay in sync with Skills / UserSkills / ProjectSkillTree ──
type PKey = 'root' | 'development' | 'research' | 'communication' | 'organisation' | 'default';

const PALETTE: Record<PKey, string> = {
  root:          '#e2b714',
  development:   '#38bdf8',
  research:      '#a78bfa',
  communication: '#fb923c',
  organisation:  '#4ade80',
  default:       '#94a3b8',
};

const CAT_KEYS: Record<string, PKey> = {
  root:          'root',
  development:   'development',
  research:      'research',
  communication: 'communication',
  organisation:  'organisation',
};

// ── Tree walker ───────────────────────────────────────────────────────────────
function walk(
  node:     SkillTreeNode,
  depth:    number,
  colorKey: PKey,
  byId:     Map<string, string>,
  byLabel:  Map<string, string>,
): void {
  const ck: PKey =
    depth === 0 ? 'root'
    : depth === 1 ? ((CAT_KEYS[node.id] ?? 'default') as PKey)
    : colorKey;

  const color = node.color ?? PALETTE[ck];
  byId.set(node.id, color);
  byLabel.set(node.label.toLowerCase(), color);

  for (const child of node.children ?? []) {
    walk(child, depth + 1, ck, byId, byLabel);
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export interface SkillColorMap {
  /** Look up by node id (e.g. 'react', 'typescript') */
  byId: Map<string, string>;
  /** Look up by lowercased node label (e.g. 'react', 'typescript') */
  byLabel: Map<string, string>;
}

let _cache: SkillColorMap | null = null;

export function useSkillColorMap(): SkillColorMap {
  const [map, setMap] = useState<SkillColorMap>(_cache ?? { byId: new Map(), byLabel: new Map() });

  useEffect(() => {
    if (_cache) return; // already fetched in a previous mount
    skillTreeApi.get().then(tree => {
      const byId:    Map<string, string> = new Map();
      const byLabel: Map<string, string> = new Map();
      walk(tree.root, 0, 'default', byId, byLabel);
      _cache = { byId, byLabel };
      setMap(_cache);
    }).catch(() => { /* fail silently — chips just won't be coloured */ });
  }, []);

  return map;
}
