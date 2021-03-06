import { delay } from "./common/tool";

export class ChromePage {
  private pending = true;
  private listeners_map: Record<string, Function[]> = {};
  constructor(
    public tab: chrome.tabs.Tab,
    public win?: chrome.windows.Window,
    public is_default = false
  ) {}
  t = 0;
  resetTimer() {
    clearTimeout(this.t);
    // @ts-ignore
    this.t = setTimeout(() => {
      this.close();
    }, 1000 * 60 * 10);
  }
  set url(url: string) {
    chrome.tabs.update(this.id, {
      url,
    });
    this.resetTimer();
  }
  get id() {
    return this.tab.id!;
  }

  on(name: string, listener: Function, ...args: any[]) {
    var arr = name.split(".");
    chrome[arr[0]][arr[1]].addListener(listener, ...args);
    if (this.listeners_map[name]) {
      this.listeners_map[name].push(listener);
    } else {
      this.listeners_map[name] = [];
    }
  }

  off(name: string, listener?: Function) {
    if (this.listeners_map[name]) {
      if (!listener) {
        delete this.listeners_map[name];
      } else {
        this.listeners_map[name].splice(
          this.listeners_map[name].indexOf(listener),
          1
        );
      }
    }
  }

  once(name: string, listener: Function, ...args: any[]) {
    var _listener = (...args: any[]) => {
      this.off(name, _listener);
      listener(...args);
    };
    this.on(name, _listener, ...args);
  }

  goto(url: string) {
    this.url = url;
    return this.waitForNavigation();
  }

  evaluate(fn: string | Function, ...args: any[]) {
    var args_str = args.map((arg) => JSON.stringify(arg)).join(",");
    var code = typeof fn !== "string" ? `(${fn.toString()})(${args_str})` : fn;
    console.log(code);
    return this.executeScript(code);
  }

  waitForResponse(filter: (url: string) => boolean) {
    return new Promise((resolve) => {
      var listener = (details: chrome.webRequest.WebResponseCacheDetails) => {
        if (filter(details.url)) {
          resolve();
          this.off("webRequest.onCompleted", listener);
        }
      };
      this.on("webRequest.onCompleted", listener, {
        urls: ["*://*/*"],
        tabId: this.tab.id,
      });
    });
  }
  waitForNavigation() {
    return new Promise<void>((resolve) => {
      this.once("webNavigation.onCompleted", resolve);
    });
  }
  waitForResponseBody(filter: (url: string) => boolean) {
    return new Promise((resolve) => {
      chrome.debugger.attach(
        {
          tabId: this.id,
        },
        "1.0",
        () => {
          chrome.debugger.sendCommand(
            {
              //first enable the Network
              tabId: this.id,
            },
            "Network.enable"
          );
          chrome.debugger.onEvent.addListener(
            (debuggee, message, params: any) => {
              if (message === "Network.responseReceived") {
                if (!filter(params.response.url)) {
                  return;
                }
                chrome.debugger.sendCommand(
                  {
                    tabId: this.id,
                  },
                  "Network.getResponseBody",
                  {
                    requestId: params.requestId,
                  },
                  ({ base64Encoded, body }: any) => {
                    resolve(body);
                    chrome.debugger.detach(debuggee);
                  }
                );
              }
            }
          );
        }
      );

      // var listener = async (
      //   details: chrome.webRequest.WebResponseCacheDetails
      // ) => {
      //   if (filter(details.url)) {
      //     resolve();
      //     chrome.webRequest.onCompleted.removeListener(listener);
      //   }
      // };
      // chrome.webRequest.onCompleted.addListener(listener, {
      //   urls: ["*://*/*"],
      //   tabId: this.tabId
      // });
    });
  }

  executeScript(code: string) {
    return new Promise<any>((resolve) => {
      chrome.tabs.executeScript(
        this.id,
        {
          code,
        },
        ([data]) => {
          resolve(data);
        }
      );
    });
  }
  close() {
    clearTimeout(this.t);
    if (this.is_default) {
      this.pending = false;
      return;
    }
    return new Promise((resolve) => chrome.tabs.remove(this.id, resolve));
  }

  private static default_page?: ChromePage;
  private static events_inited = false;
  private static initEvents() {
    if (ChromePage.events_inited) {
      return;
    }
    ChromePage.events_inited = true;
    chrome.tabs.onRemoved.addListener((tabId) => {
      if (ChromePage.default_page) {
        if (tabId === ChromePage.default_page.id) {
          ChromePage.default_page.close();
          ChromePage.default_page = undefined;
        }
      }
    });
  }
  static async create() {
    ChromePage.initEvents();
    if (ChromePage.default_page) {
      if (!ChromePage.default_page.pending) {
        ChromePage.default_page.pending = true;
        return ChromePage.default_page;
      }
    } else {
      let tab = await ChromePage.createTab();
      let page = new ChromePage(tab, undefined, true);
      ChromePage.default_page = page;
      return page;
    }
    let win = await ChromePage.createWindow();
    let tab = await ChromePage.createTab(win.id);
    return new ChromePage(tab, win);
  }
  static createTab(windowId?: number) {
    return new Promise<chrome.tabs.Tab>((resolve) => {
      chrome.tabs.create(
        {
          windowId,
          active: false,
        },
        resolve
      );
    });
  }
  static createWindow() {
    return new Promise<chrome.windows.Window>((resolve) => {
      chrome.windows.create(
        {
          left: -300,
          top: 1000,
          width: 300,
          height: 100,
          type: "popup",
        },
        (window) => {
          window!.alwaysOnTop = false;
          resolve(window);
        }
      );
    });
  }
}

export async function excutePageAction<T = any>(
  url: string,
  {
    code,
    autoclose = true,
    close_delay = 1000,
    run_delay = 0,
  }: {
    code: string;
    autoclose?: boolean;
    close_delay?: number;
    run_delay?: number;
  }
) {
  var page = await ChromePage.create();
  await page.goto(url);
  await delay(800 + run_delay);
  var data = await page.executeScript(code);
  if (autoclose) {
    setTimeout(() => {
      page.close();
    }, close_delay);
  }
  return data;
}

export async function excuteRequestAction<T = any>(
  url: string,
  {
    code,
    test,
    urls,
    autoclose = true,
  }: {
    code: string;
    test: (url: string) => boolean;
    urls: string[];
    autoclose?: boolean;
  }
) {
  var page = await ChromePage.create();
  var getted = false;
  return new Promise<T>((resolve) => {
    var listener = async (
      details: chrome.webRequest.WebResponseCacheDetails
    ) => {
      if (test(details.url)) {
        if (getted) {
          return;
        }
        getted = true;
        page.off("webRequest.onCompleted", listener);
        await delay(800);
        let data = page.executeScript(code);
        resolve(data);
        if (autoclose) {
          setTimeout(() => {
            page.close();
          }, 1000);
        }
      }
    };
    page.on("webRequest.onCompleted", listener, {
      urls,
      tabId: page.id,
    });
    page.url = url;
  });
}

export function newPage() {
  return ChromePage.create();
}

// @ts-ignore
window.newPage = newPage;

/* newPage().then(async page => {
  await page.goto("https://www.baidu.com");
  page.waitForResponseBody(url => url.startsWith("https://dss3.bdstatic.com/"));
}); */
