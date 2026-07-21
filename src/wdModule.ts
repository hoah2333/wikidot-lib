import { load as cheerioLoad } from "cheerio";
import { match } from "ts-pattern";
import { NoRetryError, wdMethod } from "./wdMethod";

import type { CheerioAPI } from "cheerio";
import type { AjaxResponse, Application, MailList, MailMessage, QuickModuleResponse, UserInfo } from "./types";

export const wdModule = (baseUrl: string = "https://www.wikidot.com") => {
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
   * 登出 Wikidot 账号
   */
  const logout = (): void => post.logout();

  /**
   * 检查是否已登录
   * @returns 是否已登录
   */
  const isLoggedIn = (): boolean => post.isLoggedIn();

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
    if (gqlResult.page.wikidotInfo !== null) {
      return gqlResult.page.wikidotInfo.tags;
    } else if (!isLoggedIn()) {
      throw new NoRetryError("用户未登录");
    } else {
      const pageTag: AjaxResponse = await post.ajaxPost(
        { pageId: await post.getPageId(page) },
        "pagetags/PageTagsModule",
      );
      if (pageTag.status === "no_page") {
        throw new NoRetryError("页面不存在");
      }
      const tagDom: CheerioAPI = cheerioLoad(pageTag.body);
      const tagValue: string = tagDom("input#page-tags-input").attr("value") || "";
      return tagValue.split(" ").filter((tag: string): boolean => tag.length > 0);
    }
  };

  /**
   * 利用 Crom API 按照 URL 获取页面源代码
   * @param page 页面名称
   * @param siteName 站点名称，默认为提供的 baseUrl 的站点名称
   * @returns 页面源代码
   */
  const getSource = async (page: string, siteName: string = baseSiteName): Promise<string> => {
    type GqlResult = { page: { url: string; wikidotInfo: { source: string } | null } };
    const gqlQueryString: string | undefined = gql`
      query tagQuery($url: URL!) {
        page(url: $url) {
          url
          wikidotInfo {
            source
          }
        }
      }
    `;
    const baseUrl: string = `http://${siteName}.wikidot.com/${page}`;
    const gqlResult = (await post.cromApiRequest(gqlQueryString, { url: baseUrl })) as GqlResult;
    if (gqlResult.page.wikidotInfo !== null) {
      return gqlResult.page.wikidotInfo.source.replace(/\u00A0/g, " ");
    } else {
      const pageTag: AjaxResponse = await post.ajaxPost(
        { pageId: await post.getPageId(page) },
        "viewsource/ViewSourceModule",
      );
      if (pageTag.status === "no_page") {
        throw new NoRetryError("页面不存在");
      }
      const tagDom: CheerioAPI = cheerioLoad(pageTag.body);
      const tagValue: string = tagDom("div.page-source").text() || "";
      return tagValue.replace(/\u00A0/g, " ");
    }
  };

  /**
   * 编辑页面标签
   * @param tags 标签列表
   * @param page 页面名称
   */
  const editTags = async (tags: string[], page: string): Promise<AjaxResponse> => {
    if (!isLoggedIn()) {
      throw new NoRetryError("用户未登录");
    }
    return await pageActionPost({ tags: tags.join(" "), pageId: await post.getPageId(page) }, "saveTags");
  };

  /**
   * 重命名页面
   * @param page 页面名称
   * @param newPage 新页面名称
   */
  const renamePage = async (page: string, newPage: string): Promise<AjaxResponse> => {
    if (!isLoggedIn()) {
      throw new NoRetryError("用户未登录");
    }
    return await pageActionPost({ new_name: newPage, page_id: await post.getPageId(page) }, "renamePage");
  };

  /**
   * 删除页面
   * @param page 页面名称
   */
  const deletePage = async (page: string): Promise<AjaxResponse> => {
    if (!isLoggedIn()) {
      throw new NoRetryError("用户未登录");
    }
    return await pageActionPost({ page_id: await post.getPageId(page) }, "deletePage");
  };

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

  /**
   * 获取申请书列表
   * @returns 申请书列表
   */
  const getApplicationList = async (): Promise<Application[]> => {
    if (!isLoggedIn()) {
      throw new NoRetryError("用户未登录");
    }

    const appList: AjaxResponse = await post.ajaxPost({}, "managesite/ManageSiteMembersApplicationsModule");
    if (/\/common--images\/404_homer\.png/.test(appList.body)) {
      throw new NoRetryError("用户未登录或不是本维基的管理员");
    }

    const appListDom: CheerioAPI = cheerioLoad(appList.body);
    const userList: { userId: number; userName: string }[] = appListDom(".page-header ~ h3")
      .map((_, element) => {
        const userLink = appListDom(element).find(".printuser a:nth-of-type(2)");
        return {
          userId: Number(userLink.attr("onclick")?.match(/WIKIDOT\.page\.listeners\.userInfo\((\d+)\)/)?.[1]),
          userName: userLink.text(),
        };
      })
      .toArray();

    const appContentList: { content: string }[] = appListDom(".page-header ~ .form tr:nth-of-type(1) td:nth-of-type(2)")
      .map((_, element) => ({ content: appListDom(element).text().trim() }))
      .toArray();

    return userList.map((user, index: number) => Object.assign(user, appContentList[index]));
  };

  /**
   * 处理申请书
   * @param userId 用户 ID
   * @param type "accept" 接受申请，"decline" 拒绝申请
   * @returns
   */
  const handleApplication = async (userId: number, type: "accept" | "decline"): Promise<AjaxResponse> => {
    if (!isLoggedIn()) {
      throw new NoRetryError("用户未登录");
    }
    return await post.ajaxPost(
      { action: "ManageSiteMembershipAction", event: "acceptApplication", user_id: userId, text: "", type },
      "Empty",
    );
  };

  /**
   * 获取邮件列表
   * @param page 页面当前页数
   */
  const getMailList = async (page: number): Promise<MailList[]> => {
    if (!isLoggedIn()) {
      throw new NoRetryError("用户未登录");
    }
    const response = await post.ajaxPost({ page }, "dashboard/messages/DMInboxModule");
    if (response?.status !== "ok") {
      throw new NoRetryError("获取邮件列表失败：" + response.body);
    }
    const mailListDom = cheerioLoad(response.body);
    const mailList = mailListDom("table#messages-list")
      .find("tr.message")
      .map((_, element) => {
        const mailItemDom = mailListDom(element);
        const id = mailItemDom.attr("data-href")?.match(/#\/inbox\/(\d+)/)?.[1];
        const sender = mailItemDom.find("td:nth-of-type(2) .from .printuser").text().trim();
        const title = mailItemDom.find("td:nth-of-type(3) .subject").text().trim();
        const preview = mailItemDom.find("td:nth-of-type(3) .preview").text().trim();
        const time = mailItemDom
          .find("td:nth-of-type(4) .date .odate")
          .attr("class")
          ?.match(/time_(\d+)/)?.[1];
        return { id: Number(id), sender, title, preview, time: new Date(Number(time) * 1000) };
      })
      .toArray();
    return mailList;
  };

  /**
   * 获取邮件内容
   * @param messageId 邮件 ID
   * @returns
   */
  const getMailMessage = async (messageId: number): Promise<MailMessage> => {
    if (!isLoggedIn()) {
      throw new NoRetryError("用户未登录");
    }
    const response = await post.ajaxPost({ item: messageId }, "dashboard/messages/DMViewMessageModule");
    if (response?.status !== "ok") {
      throw new NoRetryError("获取邮件失败：" + response.body);
    }
    const mailDom = cheerioLoad(response.body);
    const sender = mailDom(".pmessage > .header > div:nth-of-type(1) > .printuser:nth-of-type(1)").text().trim();
    const title = mailDom(".pmessage > .header > div:nth-of-type(1) > .subject").text().trim();
    mailDom(".pmessage > .body > .message-actions").remove();
    const body = mailDom(".pmessage > .body").html() || "";
    const time = mailDom(".pmessage > .header > div:nth-of-type(2) > .odate")
      .attr("class")
      ?.match(/time_(\d+)/)?.[1];
    return { sender, title, body, time: new Date(Number(time) * 1000), fullResponse: response.body };
  };

  /**
   * 获取用户信息
   * @param userId 用户 ID
   * @returns 用户信息
   */
  const getUserInfo = async (userId: number): Promise<UserInfo> => {
    const response = await post.ajaxPost({ user_id: userId }, "users/UserInfoWinModule");
    const userInfoDom = cheerioLoad(response.body);
    const userName = userInfoDom(".owindow > .content > h1").text().trim();
    const userAvatar = userInfoDom(".owindow > .content > img").attr("src") || "";
    const tableTrs = userInfoDom(".owindow > .content > table.table tr")
      .map((_, element) => {
        const key = userInfoDom(element).find("td:nth-of-type(1)").text().trim();
        const value = userInfoDom(element)
          .find("td:nth-of-type(2)")
          .text()
          .replace(/\(这是什么？\)|\(what is this\?\)/g, "")
          .trim();
        return { key, value };
      })
      .toArray();
    const accountType =
      tableTrs.find((tr) => tr.key.includes("Account type") || tr.key.includes("账户类型"))?.value || "";
    const accountKarmaString = tableTrs.find((tr) => tr.key.includes("Karma"))?.value || "";
    const accountKarma = match(accountKarmaString)
      .with("low", "低", () => 1)
      .with("medium", "中等", () => 2)
      .with("high", "高", () => 3)
      .with("very high", "非常高", () => 4)
      .with("guru", "上师", () => 5)
      .otherwise(() => 0);
    return { userId, userName, userAvatar, accountType, accountKarma };
  };

  return {
    login,
    logout,
    isLoggedIn,
    getListpages,
    getPageSource,
    getTags,
    getSource,
    editTags,
    renamePage,
    deletePage,
    searchPage,
    isPageExists,
    isPageExistsByListpages,
    getApplicationList,
    handleApplication,
    getMailList,
    getMailMessage,
    getUserInfo,
  };
};
