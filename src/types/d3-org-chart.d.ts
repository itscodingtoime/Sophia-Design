declare module 'd3-org-chart' {
  export class OrgChart<T = any> {
    container(container: HTMLElement | string): this;
    data(data: T[]): this;
    render(): this;
    clear(): this;

    nodeWidth(fn: (d: any) => number): this;
    nodeHeight(fn: (d: any) => number): this;
    nodeContent(fn: (d: any) => string): this;
    childrenMargin(fn: (d: any) => number): this;
    compactMarginBetween(fn: (d: any) => number): this;
    compactMarginPair(fn: (d: any) => number): this;
  }
}
