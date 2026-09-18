import type { BrandTool } from './types.ts';
import { coral1Tool } from '../experiments/coral-1/experiment.ts';

export const brandTools: BrandTool[] = [coral1Tool];

export function findBrandTool(slug: string | undefined): BrandTool | undefined {
  if (!slug) return brandTools[0];
  return brandTools.find((t) => t.slug === slug);
}

export function isBrandToolSlug(slug: string | undefined): boolean {
  return !!slug && brandTools.some((t) => t.slug === slug);
}
