declare module 'mermaid' {
  export interface MermaidConfig {
    startOnLoad?: boolean;
    maxTextSize?: number;
    theme?: string;
    themeVariables?: Record<string, string>;
    flowchart?: {
      curve?: string;
      padding?: number;
      nodeSpacing?: number;
      rankSpacing?: number;
      htmlLabels?: boolean;
    };
    sequence?: {
      actorMargin?: number;
      boxMargin?: number;
      boxTextMargin?: number;
      noteMargin?: number;
      messageMargin?: number;
    };
    fontFamily?: string;
    fontSize?: number;
    suppressErrorRendering?: boolean;
  }

  interface RenderResult {
    svg: string;
    bindFunctions?: (element: Element) => void;
  }

  const mermaid: {
    initialize: (config: MermaidConfig) => void;
    parseError?: (err: unknown) => void;
    render: (id: string, text: string) => Promise<RenderResult>;
  };

  export default mermaid;
}
