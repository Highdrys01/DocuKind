export type ToolCategory = "Organize" | "Convert" | "Edit" | "Sign" | "Optimize";

export type OptionValue = string | number | boolean;
export type ToolOptions = Record<string, OptionValue>;

export type OptionField =
  | {
      name: string;
      label: string;
      type: "text" | "textarea" | "color";
      defaultValue: string;
      placeholder?: string;
      help?: string;
      showWhen?: (options: ToolOptions) => boolean;
    }
  | {
      name: string;
      label: string;
      type: "number" | "range";
      defaultValue: number;
      min?: number;
      max?: number;
      step?: number;
      help?: string;
      showWhen?: (options: ToolOptions) => boolean;
    }
  | {
      name: string;
      label: string;
      type: "checkbox";
      defaultValue: boolean;
      help?: string;
      showWhen?: (options: ToolOptions) => boolean;
    }
  | {
      name: string;
      label: string;
      type: "select";
      defaultValue: string;
      choices: Array<{ label: string; value: string }>;
      help?: string;
      showWhen?: (options: ToolOptions) => boolean;
    };

export type ToolResult = {
  filename: string;
  blob: Blob;
  summary?: string;
};

export type ToolRunContext = {
  onProgress?: (message: string) => void;
};

export type ToolProcessor = (files: File[], options: ToolOptions, context?: ToolRunContext) => Promise<ToolResult[]>;

export type ToolDefinition = {
  id: string;
  title: string;
  category: ToolCategory;
  tagline: string;
  icon: string;
  accepts: string;
  multiple: boolean;
  minFiles: number;
  options: OptionField[];
  processor: () => Promise<ToolProcessor>;
};
