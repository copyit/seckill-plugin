import moment from "moment";
import * as R from "ramda";
// import "./externals/intercept";
import { buyDirect, cartBuy, coudan } from "./taobao/order";
import {
  getCartList,
  addCart as taobao_add_cart,
  updateCart
} from "./taobao/cart";
import { resolveUrl as taobao_resolve_url, getUserName } from "./taobao/tools";
import { addCart as jd_add_cart } from "./jd/cart";
import {
  getGoodsDetail as jd_getGoodsDetail,
  getGoodsList as taobao_getGoodsList
} from "./taobao/goods";
import {
  checkStatus as taobao_check_status,
  getAddresses,
  getMyCoupons as taobao_getMyCoupons
} from "./taobao/member";
import { checkStatus as jd_check_status } from "./jd/member";
import { handlers as taobao_coupons_handlers } from "./taobao/coupon";
import "./init";
import { taskManager } from "./common/task-manager";
import { config } from "./common/setting";
import { sysTaobaoTime } from "./common/time";
import { resolveUrl as jd_resolve_url } from "./jd/tools";
import { handlers as jd_coupons_handlers } from "./jd/coupon";
import { getGoodsList as jd_getGoodsList } from "./jd/goods";
import { getMyCoupons as jd_getMyCoupons } from "./jd/member";
import { seckillList } from "./taobao/seckill";
import { getBillionList, getBillion } from "./jd/billion";
import { getPlusQuanpin, getPlusQuanpinList } from "./jd/plus";

async function qiangquan({
  data,
  t,
  platform
}: {
  data: string;
  t?: string;
  platform: string;
}) {
  var handlers =
    platform === "jingdong" ? jd_coupons_handlers : taobao_coupons_handlers;
  for (let handler of handlers) {
    if (handler.test(data)) {
      return (handler.page || handler.api)!(data);
    }
  }
  return { url: data };
}

async function buy(args: any, t?: string) {
  if (t) {
    let time = moment(t).valueOf();
    let diff = time - Date.now();
    if (diff > 0) {
      let p = taskManager.registerTask(
        {
          name: "抢单",
          time: t,
          platform: "taobao",
          comment: args._comment
        },
        time
      );
      buyDirect(args, p);
      return;
    }
  }
  return buyDirect(args);
}

async function buy_from_cart(args: any, t?: string) {
  if (t) {
    let time = moment(t).valueOf();
    let diff = time - Date.now();
    if (diff > 0) {
      let p = taskManager.registerTask(
        {
          name: "抢单",
          time: t,
          platform: "taobao",
          comment: args._comment
        },
        time
      );
      cartBuy(args, p);
      return;
    }
  }
  return cartBuy(args);
}

async function getConfig() {
  return R.clone(config);
}

async function setConfig(_config) {
  if (JSON.stringify(_config) === JSON.stringify(config)) {
    return;
  }
  chrome.storage.local.set(_config);
  Object.assign(config, _config);
  if (_config.is_main) {
    jd_check_status();
  }
}

function cartDel(data) {
  return updateCart(data, "deleteSome");
}

function cartUpdateQuantity(data) {
  return updateCart(data, "update");
}

async function getTasks() {
  return R.map(
    (item: any) =>
      Object.assign(item, {
        time: moment(item.time).format(moment.HTML5_FMT.TIME)
      }),
    R.sort(
      (a, b) => moment(a.time).valueOf() - moment(b.time).valueOf(),
      taskManager.items
    )
  );
}

async function cancelTask(id: number) {
  return taskManager.cancelTask(id);
}

const taobao = {
  resolveUrl(url: string, platform: string) {
    if (platform === "jingdong") {
      return jd_resolve_url(url);
    }
    return taobao_resolve_url(url);
  },
  qiangquan,
  buy,
  cartBuy: buy_from_cart,
  getCartList,
  getConfig,
  setConfig,
  cartAdd(args, platform: string) {
    if (platform === "jingdong") {
      return jd_add_cart(args);
    }
    return taobao_add_cart(args);
  },
  async cartList() {
    return {
      items: await getCartList()
    };
  },
  cartDel,
  cartUpdateQuantity,
  async cartToggle() {},
  coudan,
  async checkStatus(platform: string) {
    if (platform === "jingdong") {
      return jd_check_status();
    }
    return taobao_check_status();
  },
  sysTime: sysTaobaoTime,
  goodsList(data, platform: string) {
    if (platform === "taobao") {
      return taobao_getGoodsList(data);
    }
    return jd_getGoodsList(data);
  },
  goodsDetail({ url }, platform: string) {
    if (platform === "taobao") {
      return jd_getGoodsDetail(url);
    }
  },
  getTasks,
  cancelTask,
  getAddresses,
  getMyCoupons(arg, platform: string) {
    if (platform === "taobao") {
      return taobao_getMyCoupons(arg);
    }
    return jd_getMyCoupons();
  },
  getSeckillList(args) {
    return seckillList(args.url);
  },
  getJdMillionList: getBillionList,
  getJdMillion: getBillion,
  getUserName,
  getPlusQuanpinList,
  getPlusQuanpin
};

// @ts-ignore
window.taobao = taobao;

taobao.checkStatus("taobao");
if (config.is_main) {
  taobao.checkStatus("jingdong");
}
