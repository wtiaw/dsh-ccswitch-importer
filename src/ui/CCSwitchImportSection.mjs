import React, { useEffect, useSyncExternalStore } from "react";
import { saveCollapse, withPanelToggled } from "./collapse-state.mjs";

const h = React.createElement;

function isSelectable(profile) {
  return profile.status !== 'blocked' && profile.credential === 'found';
}

function statusLabel(status) {
  if (status === 'new') return '待导入';
  if (status === 'update') return '将更新';
  if (status === 'unchanged') return '无需更新';
  if (status === 'blocked') return '已阻止';
  return status ?? '';
}

function badgeClass(status) {
  const safe = status === 'new' || status === 'update' || status === 'unchanged' || status === 'blocked' ? status : 'unchanged';
  return `dsh-ccswitch-import__badge dsh-ccswitch-import__badge--${safe}`;
}

export function CCSwitchImportSection({ controller, collapse, setCollapse }) {
  if (!controller) return null;
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => {
    if (snapshot.phase === 'idle') void controller.scan().catch(() => {});
  }, [controller, snapshot.phase]);
  const busy = snapshot.phase === "loading" || snapshot.phase === "importing";
  const selected = new Set(snapshot.selectedIds);
  const profiles = Array.isArray(snapshot.profiles) ? snapshot.profiles : [];
  const collapsed = collapse?.importPanel === true;
  const toggleCollapsed = () => {
    if (typeof setCollapse !== "function") return;
    setCollapse((current) => {
      const next = withPanelToggled(current, "importPanel");
      saveCollapse(next);
      return next;
    });
  };
  return h("section", { className: "dsh-ccswitch-import" + (collapsed ? " dsh-ccswitch-import--collapsed" : ""), "aria-labelledby": "dsh-ccswitch-import-title" },
    h("div", { className: "dsh-ccswitch-import__header" },
      h("div", null,
        h("h2", { id: "dsh-ccswitch-import-title", className: "dsh-ccswitch-import__title" }, "CCSwitch 导入"),
        h("p", { className: "dsh-ccswitch-import__hint" }, collapsed ? "点击展开 CCSwitch 导入设置" : "从本机 CCSwitch 读取 provider 配置。"),
      ),
      h("div", { className: "dsh-ccswitch-import__header-actions" },
        h("button", {
          type: "button",
          className: "dsh-ccswitch-collapse",
          "aria-expanded": !collapsed,
          "aria-controls": "dsh-ccswitch-import-body",
          onClick: toggleCollapsed,
        }, h("span", { "aria-hidden": "true" }, collapsed ? "⌄" : "⌃")),
        !collapsed && h("div", { className: "dsh-ccswitch-import__actions" },
          h("button", { className: "dsh-ccswitch-import__secondary", type: "button", disabled: busy, onClick: () => { void controller.scan().catch(() => {}); } }, busy ? "处理中..." : "扫描"),
          h("button", { className: "dsh-ccswitch-import__primary", type: "button", disabled: busy || selected.size === 0, onClick: () => { void controller.importSelected().catch(() => {}); } }, "导入选中"),
        ),
      ),
    ),
    h("div", { id: "dsh-ccswitch-import-body", className: "dsh-ccswitch-import__body", hidden: collapsed },
      snapshot.error && h("p", { role: "alert", className: "dsh-ccswitch-import__error" }, snapshot.error),
      profiles.length === 0 && snapshot.phase !== "loading"
        ? h("p", { className: "dsh-ccswitch-import__empty" }, "没有可读取的 CCSwitch provider。")
        : h("div", { className: "dsh-ccswitch-import__list" },
          ...profiles.map((profile) => {
            const selectable = isSelectable(profile);
            return h("label", {
              key: profile.profileId,
              className: "dsh-ccswitch-import__row" + (selectable ? "" : " dsh-ccswitch-import__row--blocked"),
            },
              h("input", {
                type: "checkbox",
                checked: selected.has(profile.profileId),
                disabled: !selectable || busy,
                onChange: () => controller.toggleSelected(profile.profileId),
              }),
              h("span", { className: "dsh-ccswitch-import__content" },
                h("span", { className: "dsh-ccswitch-import__primary-line" },
                  h("strong", null, profile.profileName || profile.profileId),
                  profile.baseURL ? h("code", null, profile.baseURL) : null,
                ),
                h("span", { className: "dsh-ccswitch-import__meta-line" },
                  h("code", { className: "dsh-ccswitch-import__provider-key" }, profile.providerKey || "待生成 provider key"),
                  h("span", null, `${profile.credential === "found" ? "凭据已找到" : "缺少凭据"} · ${(profile.modelIds ?? []).join(", ") || "无模型"}`),
                  Array.isArray(profile.warnings) && profile.warnings.length > 0
                    ? h("span", { className: "dsh-ccswitch-import__warnings" }, profile.warnings.join("；"))
                    : null,
                ),
              ),
              h("span", { className: badgeClass(profile.status) }, statusLabel(profile.status)),
            );
          }),
        ),
      snapshot.results.length > 0 && h("ul", { className: "dsh-ccswitch-import__results" },
        ...snapshot.results.map((result) => h("li", { key: `${result.profileId}-${result.status}` },
          `${result.profileId}: ${result.status === "failed" ? result.error : statusLabel(result.status)}`
        )),
      ),
    ),
  );
}
