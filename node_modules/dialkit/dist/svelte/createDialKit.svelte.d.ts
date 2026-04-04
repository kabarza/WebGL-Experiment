import type { DialConfig, ResolvedValues } from 'dialkit/store';
export interface CreateDialOptions {
    onAction?: (action: string) => void;
}
export type DialKitValues<T> = T;
export declare function createDialKit<T extends DialConfig>(name: string, config: T, options?: CreateDialOptions): DialKitValues<ResolvedValues<T>>;
//# sourceMappingURL=createDialKit.svelte.d.ts.map