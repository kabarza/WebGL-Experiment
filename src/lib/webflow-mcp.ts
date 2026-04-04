// ============================================================
// Webflow MCP Tool Wrappers
// Orchestrates style/element/component creation via MCP tools
// ============================================================

/**
 * MCP tool call abstraction — these map to Webflow MCP tool calls
 * that would be executed by Claude when connected to Webflow Designer.
 *
 * This module defines the structure; actual MCP calls are made by the
 * AI assistant at export time.
 */

export interface WebflowExportPlan {
  styles: WebflowStyleDef[];
  elements: WebflowElementDef[];
  componentName?: string;
}

export interface WebflowStyleDef {
  name: string;
  properties: Record<string, string>;
}

export interface WebflowElementDef {
  tag: string;
  style?: string;
  attributes?: Record<string, string>;
  children?: WebflowElementDef[];
}

/**
 * Generate a Webflow MCP export plan for an experiment.
 */
export function buildExportPlan(
  slug: string,
  bundleUrl: string,
): WebflowExportPlan {
  return {
    styles: [
      {
        name: 'tempo-experiment-wrapper',
        properties: {
          position: 'relative',
          width: '100%',
          height: '100%',
        },
      },
      {
        name: 'tempo-experiment-canvas',
        properties: {
          display: 'block',
          width: '100%',
          height: '100%',
        },
      },
    ],
    elements: [
      {
        tag: 'div',
        style: 'tempo-experiment-wrapper',
        children: [
          {
            tag: 'canvas',
            style: 'tempo-experiment-canvas',
            attributes: {
              'data-tempo-experiment': slug,
            },
          },
          {
            tag: 'script',
            attributes: {
              src: bundleUrl,
            },
          },
        ],
      },
    ],
    componentName: `Tempo: ${slug.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')}`,
  };
}

/**
 * Generate MCP tool call instructions (for AI-assisted export).
 * Returns a human-readable description of the MCP calls to make.
 */
export function generateMCPInstructions(plan: WebflowExportPlan): string {
  const steps: string[] = [];

  steps.push('## Step 1: Create Styles');
  for (const style of plan.styles) {
    const props = Object.entries(style.properties)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    steps.push(`  style_tool: "${style.name}" → ${props}`);
  }

  steps.push('\n## Step 2: Build Element Tree');
  function describeElement(el: WebflowElementDef, indent = '  '): void {
    const attrs = el.attributes
      ? Object.entries(el.attributes)
          .map(([k, v]) => `${k}="${v}"`)
          .join(' ')
      : '';
    steps.push(
      `${indent}${el.tag}${el.style ? ` (style: ${el.style})` : ''}${attrs ? ` [${attrs}]` : ''}`,
    );
    if (el.children) {
      for (const child of el.children) {
        describeElement(child, indent + '  ');
      }
    }
  }
  for (const el of plan.elements) {
    describeElement(el);
  }

  if (plan.componentName) {
    steps.push(`\n## Step 3: Create Component`);
    steps.push(`  de_component_tool: name="${plan.componentName}"`);
  }

  return steps.join('\n');
}
