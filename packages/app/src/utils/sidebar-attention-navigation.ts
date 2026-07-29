import type {
  SidebarStateBucket,
  SidebarWorkspaceEntry,
} from "@/hooks/use-sidebar-workspaces-list";
import type {
  SidebarShortcutSection,
  SidebarShortcutWorkspaceTarget,
} from "@/utils/sidebar-shortcuts";

/** Attention tiers, most urgent first. Order in this tuple IS the priority. */
export const ATTENTION_TIERS = ["blocked", "ready", "idle"] as const;
export type AttentionTier = (typeof ATTENTION_TIERS)[number];

/**
 * Exhaustive on purpose: a new protocol status bucket must be classified here
 * explicitly (compile error) instead of silently dropping out of the queue.
 * `null` means "not a candidate" — we never jump to a workspace that is working.
 */
const ATTENTION_TIER_BY_BUCKET: Record<SidebarStateBucket, AttentionTier | null> = {
  needs_input: "blocked",
  failed: "blocked",
  attention: "ready",
  running: null,
  done: "idle",
};

export function getAttentionTier(bucket: SidebarStateBucket): AttentionTier | null {
  return ATTENTION_TIER_BY_BUCKET[bucket] ?? null;
}

/**
 * Candidate workspaces in attention order: all blocked, then all ready to
 * review, then all idle. Sidebar visual order is preserved inside each tier.
 *
 * Collapsed sections are skipped so the queue matches what the user can see,
 * mirroring the Alt+1-9 shortcut targets — but without their 9-item cap.
 */
export function buildAttentionQueue(input: {
  sections: readonly SidebarShortcutSection[];
  statusEntriesByKey: ReadonlyMap<string, SidebarWorkspaceEntry>;
}): SidebarShortcutWorkspaceTarget[] {
  const bins = new Map<AttentionTier, SidebarShortcutWorkspaceTarget[]>();

  for (const section of input.sections) {
    if (section.collapsed) {
      continue;
    }

    for (const workspace of section.workspaces) {
      const entry = input.statusEntriesByKey.get(workspace.workspaceKey);
      if (!entry) continue;
      if (entry.archivingAt) continue;

      const tier = getAttentionTier(entry.statusBucket);
      if (!tier) continue;

      const bin = bins.get(tier);
      const target = { serverId: workspace.serverId, workspaceId: workspace.workspaceId };
      if (bin) {
        bin.push(target);
      } else {
        bins.set(tier, [target]);
      }
    }
  }

  return ATTENTION_TIERS.flatMap((tier) => bins.get(tier) ?? []);
}

function isSameTarget(
  left: SidebarShortcutWorkspaceTarget,
  right: SidebarShortcutWorkspaceTarget,
): boolean {
  return left.serverId === right.serverId && left.workspaceId === right.workspaceId;
}

/**
 * Next/previous attention target, wrapping at the ends of the queue.
 *
 * Returns null when there is nowhere to go: an empty queue, or a queue whose
 * only candidate is the workspace the user is already looking at. Callers
 * surface that as "no workspaces need attention".
 */
export function getNextAttentionTarget(input: {
  queue: readonly SidebarShortcutWorkspaceTarget[];
  currentTarget: SidebarShortcutWorkspaceTarget | null;
  delta: 1 | -1;
}): SidebarShortcutWorkspaceTarget | null {
  if (input.queue.length === 0) {
    return null;
  }

  const fallback = input.queue[input.delta > 0 ? 0 : input.queue.length - 1] ?? null;
  const currentTarget = input.currentTarget;
  if (!currentTarget) {
    return fallback;
  }

  const currentIndex = input.queue.findIndex((target) => isSameTarget(target, currentTarget));
  if (currentIndex < 0) {
    return fallback;
  }

  const nextIndex = (currentIndex + input.delta + input.queue.length) % input.queue.length;
  const next = input.queue[nextIndex] ?? null;
  if (!next || isSameTarget(next, currentTarget)) {
    return null;
  }
  return next;
}
