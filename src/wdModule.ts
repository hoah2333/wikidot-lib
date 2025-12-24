import { wdMethod } from "./wdMethod";

import type { AjaxResponse, QuickModuleResponse } from "./types";

export const wdModule = (baseUrl: string) => {
  const post = wdMethod(baseUrl);
  const baseSiteName: string = baseUrl.split("//")[1].split(".")[0];

  const pageActionPost = async (params: Record<string, string | number>, event: string): Promise<AjaxResponse> =>
    await post.ajaxPost(Object.assign({ action: "WikiPageAction", event }, params), "Empty");

  /**
   * 使 GraphQL 查询语句可以被 Prettier 格式化
   * @param query GraphQL 查询语句
   * @param substitutions 查询语句中的变量
   * @returns 格式化后的查询语句
   */
  const gql = (query: TemplateStringsArray, ...substitutions: string[]): string => String.raw(query, ...substitutions);

  /**
   * 登录 Wikidot 账号
   * @param username 用户名
   * @param password 密码
   */
  const login = async (username: string, password: string): Promise<void> => await post.login(username, password);

  /**
   * 利用 ListPages 模块获取页面列表
   * @param params ListPages 参数
   * - 详见 https://www.wikidot.com/doc-modules:listpages-module
   * @returns ListPages 返回值
   */
  const getListpages = async (params: Record<string, string | number>): Promise<AjaxResponse> =>
    await post.ajaxPost(params, "list/ListPagesModule");

  /**
   * 获取页面 HTML 源代码
   * @param page 页面名称
   * @param norender 是否不渲染文章内容
   * @returns 页面渲染完毕后的 HTML 源代码
   */
  const getPageSource = async (page: string, norender: boolean = false): Promise<string> =>
    await post.getPageSource(page, norender);

  /**
   * 利用 Crom API 按照 URL 获取页面标签
   * @param page 页面名称
   * @param siteName 站点名称，默认为提供的 baseUrl 的站点名称
   * @returns 页面标签列表
   */
  const getTags = async (page: string, siteName: string = baseSiteName): Promise<string[]> => {
    type GqlResult = { page: { url: string; wikidotInfo: { tags: string[] } | null } };
    const gqlQueryString: string | undefined = gql`
      query tagQuery($url: URL!) {
        page(url: $url) {
          url
          wikidotInfo {
            tags
          }
        }
      }
    `;
    const baseUrl: string = `http://${siteName}.wikidot.com/${page}`;
    const gqlResult = (await post.cromApiRequest(gqlQueryString, { url: baseUrl })) as GqlResult;
    return gqlResult.page.wikidotInfo?.tags ?? [];
  };

  /**
   * 编辑页面标签
   * @param tags 标签列表
   * @param page 页面名称
   */
  const editTags = async (tags: string[], page: string): Promise<AjaxResponse> =>
    await pageActionPost({ tags: tags.join(" "), pageId: await post.getPageId(page) }, "saveTags");

  /**
   * 重命名页面
   * @param page 页面名称
   * @param newPage 新页面名称
   */
  const renamePage = async (page: string, newPage: string): Promise<AjaxResponse> =>
    await pageActionPost({ new_name: newPage, page_id: await post.getPageId(page) }, "renamePage");

  /**
   * 删除页面
   * @param page 页面名称
   */
  const deletePage = async (page: string): Promise<AjaxResponse> =>
    await pageActionPost({ page_id: await post.getPageId(page) }, "deletePage");

  /**
   * 搜索页面
   * @deprecated searchPage 大概率报错 Internal Server Error，使用 `cromSearchPage` 搜索页面
   * @param siteId 站点 ID
   * @param query 搜索关键词
   * @returns 搜索结果
   */
  const searchPage = async (siteId: number, query: string): Promise<QuickModuleResponse["pages"]> => {
    const searchResult: QuickModuleResponse = await post.quickGet({ s: siteId, q: query }, "PageLookupQModule");
    return searchResult.pages;
  };

  /**
   * 利用 Crom API 按照 URL 查询页面是否存在
   * @param siteName 站点名称
   * @param query 搜索关键词
   * @returns 页面是否存在
   */
  const isPageExists = async (siteName: string, query: string): Promise<boolean> => {
    type GqlResult = { page: { url: string; wikidotInfo: { title: string } | null } };
    const gqlQueryString: string | undefined = gql`
      query urlQuery($url: URL!) {
        page(url: $url) {
          url
          wikidotInfo {
            title
          }
        }
      }
    `;
    const baseUrl: string = `http://${siteName}.wikidot.com/${query}`;
    const gqlResult = (await post.cromApiRequest(gqlQueryString, { url: baseUrl })) as GqlResult;
    return gqlResult.page.wikidotInfo !== null;
  };

  /**
   * 利用 ListPages 查询页面是否存在
   * @param fullname 页面名称，包含 category
   * @returns 页面是否存在
   */
  const isPageExistsByListpages = async (name: string, category: string = "_default"): Promise<boolean> => {
    const listpagesResult: AjaxResponse = await getListpages({ category, name, module_body: "%%fullname%%" });
    return listpagesResult.body.includes(name);
  };

  return {
    login,
    getListpages,
    getPageSource,
    getTags,
    editTags,
    renamePage,
    deletePage,
    searchPage,
    isPageExists,
    isPageExistsByListpages,
  };
};
