// ============================================================
// Contextual visibility for a DialKit panel — as CSS.
//
// DialKit re-registers when its config changes, but prunes values and
// saved versions for controls that are absent, so the config stays
// static. Rows are hidden with generated nth-child rules instead of DOM
// writes: CSS is in effect before DialKit measures a folder for its
// open/close animation, so there is no height jump.
// ============================================================

const FOLDER = '.bt-panel-root .dialkit-folder-root > .dialkit-folder-content > .dialkit-folder-inner > .dialkit-folder';
const ROW = '> .dialkit-folder-content > .dialkit-folder-inner >';

export interface VisibilitySpec {
  hiddenKeys: Iterable<string>;
  hiddenFolders?: Iterable<string>;
  /** Keys whose value differs from the default — marked with a dot. */
  changedKeys?: Iterable<string>;
}

/**
 * Build the stylesheet for `config` (folder → { key: control }), hiding
 * the given flat keys / action names and whole folders. Row order follows
 * config insertion order, which is how DialKit renders them.
 */
export function buildVisibilityCss(
  config: Record<string, Record<string, unknown>>,
  spec: VisibilitySpec,
): string {
  const hidden = new Set(spec.hiddenKeys);
  const hiddenFolders = new Set(spec.hiddenFolders ?? []);
  const changed = new Set(spec.changedKeys ?? []);
  const rules: string[] = [];
  Object.entries(config).forEach(([folder, controls], fi) => {
    const folderSel = `${FOLDER}:nth-child(${fi + 1})`;
    if (hiddenFolders.has(folder)) { rules.push(`${folderSel}{display:none}`); return; }
    let row = 0;
    for (const key of Object.keys(controls)) {
      if (key === '_collapsed') continue;
      row++;
      if (hidden.has(key)) rules.push(`${folderSel} ${ROW} :nth-child(${row}){display:none}`);
      else if (changed.has(key)) rules.push(`${folderSel} ${ROW} :nth-child(${row}){position:relative}\n${folderSel} ${ROW} :nth-child(${row})::after{content:'';position:absolute;top:-3px;right:-3px;width:6px;height:6px;border-radius:50%;background:#0d99ff;box-shadow:0 0 0 2px #2c2c2c;pointer-events:none;z-index:1}`);
    }
  });
  return rules.join('\n');
}
