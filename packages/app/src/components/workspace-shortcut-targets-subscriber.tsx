import { useEffect } from "react";
import { useSidebarModel } from "@/components/sidebar/sidebar-model";
import { useKeyboardShortcutsStore } from "@/stores/keyboard-shortcuts-store";

export function WorkspaceShortcutTargetsSubscriber({ enabled }: { enabled: boolean }) {
  const { shortcutModel, attentionQueue } = useSidebarModel();
  const setSidebarShortcutWorkspaceTargets = useKeyboardShortcutsStore(
    (state) => state.setSidebarShortcutWorkspaceTargets,
  );
  const setSidebarAttentionWorkspaceTargets = useKeyboardShortcutsStore(
    (state) => state.setSidebarAttentionWorkspaceTargets,
  );

  useEffect(() => {
    if (!enabled) {
      setSidebarShortcutWorkspaceTargets([]);
      return;
    }

    setSidebarShortcutWorkspaceTargets(shortcutModel.shortcutTargets);
  }, [enabled, setSidebarShortcutWorkspaceTargets, shortcutModel.shortcutTargets]);

  useEffect(() => {
    if (!enabled) {
      setSidebarAttentionWorkspaceTargets([]);
      return;
    }

    setSidebarAttentionWorkspaceTargets(attentionQueue);
  }, [attentionQueue, enabled, setSidebarAttentionWorkspaceTargets]);

  useEffect(() => {
    return () => {
      setSidebarShortcutWorkspaceTargets([]);
      setSidebarAttentionWorkspaceTargets([]);
    };
  }, [setSidebarAttentionWorkspaceTargets, setSidebarShortcutWorkspaceTargets]);

  return null;
}
