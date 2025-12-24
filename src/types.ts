export interface AjaxResponse {
  status: string;
  CURRENT_TIMESTAMP: number;
  body: string;
  jsInclude: string[];
  cssInclude: string[];
  callbackIndex: string;
}

export interface QuickModuleResponse {
  pages: { unix_name: string; title: string }[];
}
