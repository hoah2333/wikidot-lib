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

export interface Application {
  userId: number;
  userName: string;
  content: string;
}

export interface MailList {
  id: number;
  sender: string;
  title: string;
  preview: string;
  time: Date;
}

export interface MailMessage {
  sender: string;
  title: string;
  body: string;
  time: Date;
}
