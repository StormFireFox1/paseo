import { describe, expect, it } from "vitest";
import type {
  SidebarStateBucket,
  SidebarWorkspaceEntry,
  SidebarWorkspacePlacement,
} from "@/hooks/use-sidebar-workspaces-list";
import {
  ATTENTION_TIERS,
  buildAttentionQueue,
  getAttentionTier,
  getNextAttentionTarget,
} from "./sidebar-attention-navigation";
import type { SidebarShortcutWorkspaceTarget } from "./sidebar-shortcuts";

function placement(workspaceId: string): SidebarWorkspacePlacement {
  return {
    workspaceKey: `host:${workspaceId}`,
    serverId: "host",
    workspaceId,
    projectViewKey: "project",
    projectName: "Project",
    projectKind: "git",
    workspaceKind: "worktree",
    name: workspaceId,
  };
}

function entry(
  workspaceId: string,
  statusBucket: SidebarStateBucket,
  overrides?: { archivingAt?: string | null },
): SidebarWorkspaceEntry {
  return {
    ...placement(workspaceId),
    workspaceDirectory: "",
    workspaceDirectoryLabel: "",
    statusBucket,
    statusEnteredAt: null,
    title: null,
    currentBranch: null,
    archivingAt: overrides?.archivingAt ?? null,
    diffStat: null,
    prHint: null,
    archiveHasUncommittedChanges: null,
    archiveUnpushedCommitCount: null,
    scripts: [],
    hasRunningScripts: false,
  };
}

function buildQueue(
  entries: readonly SidebarWorkspaceEntry[],
  sections?: readonly { workspaceIds: readonly string[]; collapsed?: boolean }[],
) {
  const statusEntriesByKey = new Map(entries.map((item) => [item.workspaceKey, item]));
  const resolvedSections = sections ?? [{ workspaceIds: entries.map((item) => item.workspaceId) }];
  return buildAttentionQueue({
    sections: resolvedSections.map((section) => {
      const built: { workspaces: SidebarWorkspacePlacement[]; collapsed?: boolean } = {
        workspaces: section.workspaceIds.map(placement),
      };
      if (section.collapsed !== undefined) {
        built.collapsed = section.collapsed;
      }
      return built;
    }),
    statusEntriesByKey,
  });
}

function ids(targets: readonly SidebarShortcutWorkspaceTarget[]) {
  return targets.map((queued) => queued.workspaceId);
}

function target(workspaceId: string): SidebarShortcutWorkspaceTarget {
  return { serverId: "host", workspaceId };
}

describe("getAttentionTier", () => {
  it("classifies every status bucket", () => {
    expect(getAttentionTier("needs_input")).toBe("blocked");
    expect(getAttentionTier("failed")).toBe("blocked");
    expect(getAttentionTier("attention")).toBe("ready");
    expect(getAttentionTier("done")).toBe("idle");
    expect(getAttentionTier("running")).toBeNull();
  });

  it("orders tiers most urgent first", () => {
    expect([...ATTENTION_TIERS]).toEqual(["blocked", "ready", "idle"]);
  });
});

describe("buildAttentionQueue", () => {
  it("groups by tier and keeps sidebar order inside each tier", () => {
    const queue = buildQueue([
      entry("idle-a", "done"),
      entry("ready-a", "attention"),
      entry("blocked-a", "needs_input"),
      entry("idle-b", "done"),
      entry("blocked-b", "failed"),
      entry("ready-b", "attention"),
    ]);

    expect(ids(queue)).toEqual([
      "blocked-a",
      "blocked-b",
      "ready-a",
      "ready-b",
      "idle-a",
      "idle-b",
    ]);
  });

  it("skips running and archiving workspaces", () => {
    const queue = buildQueue([
      entry("working", "running"),
      entry("leaving", "needs_input", { archivingAt: "1970-01-01T00:00:00.000Z" }),
      entry("blocked", "needs_input"),
    ]);

    expect(ids(queue)).toEqual(["blocked"]);
  });

  it("skips collapsed sections", () => {
    const queue = buildQueue(
      [entry("hidden", "needs_input"), entry("visible", "done")],
      [{ workspaceIds: ["hidden"], collapsed: true }, { workspaceIds: ["visible"] }],
    );

    expect(ids(queue)).toEqual(["visible"]);
  });

  it("skips placements without a known status entry", () => {
    const queue = buildAttentionQueue({
      sections: [{ workspaces: [placement("unknown")] }],
      statusEntriesByKey: new Map(),
    });

    expect(queue).toEqual([]);
  });
});

describe("getNextAttentionTarget", () => {
  const queue = [target("a"), target("b"), target("c")];

  it("advances and wraps forward", () => {
    expect(getNextAttentionTarget({ queue, currentTarget: target("a"), delta: 1 })).toEqual(
      target("b"),
    );
    expect(getNextAttentionTarget({ queue, currentTarget: target("c"), delta: 1 })).toEqual(
      target("a"),
    );
  });

  it("advances and wraps backward", () => {
    expect(getNextAttentionTarget({ queue, currentTarget: target("b"), delta: -1 })).toEqual(
      target("a"),
    );
    expect(getNextAttentionTarget({ queue, currentTarget: target("a"), delta: -1 })).toEqual(
      target("c"),
    );
  });

  it("starts at either end when the current workspace is not a candidate", () => {
    expect(getNextAttentionTarget({ queue, currentTarget: null, delta: 1 })).toEqual(target("a"));
    expect(getNextAttentionTarget({ queue, currentTarget: target("zz"), delta: 1 })).toEqual(
      target("a"),
    );
    expect(getNextAttentionTarget({ queue, currentTarget: target("zz"), delta: -1 })).toEqual(
      target("c"),
    );
  });

  it("returns null when there is nowhere to go", () => {
    expect(getNextAttentionTarget({ queue: [], currentTarget: target("a"), delta: 1 })).toBeNull();
    expect(
      getNextAttentionTarget({ queue: [target("a")], currentTarget: target("a"), delta: 1 }),
    ).toBeNull();
    expect(
      getNextAttentionTarget({ queue: [target("a")], currentTarget: target("a"), delta: -1 }),
    ).toBeNull();
  });
});
