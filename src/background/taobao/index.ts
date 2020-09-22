import { getCommentList, comment } from "./comment";
import { resolveUrl, getUserName } from "./tools";
import { handlers } from "./coupon";
import {
  buyDirect,
  cartBuy,
  coudan,
  getOrderRecords,
  deleteOrderRecords,
  relayOrderRecords,
} from "./order";
import {
  getGoodsSkus,
  getGoodsPromotions,
  applyCoupon,
  getGoodsInfo,
} from "./goods";
import { getCartList, addCart, updateCart } from "./cart";
import {
  deleteCoupon,
  getMyCoupons,
  getAddresses,
  checkStatus,
  logout,
} from "./member";
import { getGoodsList } from "./search";
import { seckillList } from "./seckill";
import { getSysTime } from "../common/time";

export default {
  resolveUrl,
  getCommentList,
  couponHandlers: handlers,
  buyDirect,
  comment,
  getGoodsList,
  getGoodsSkus,
  getGoodsInfo,
  cartBuy,
  coudan,
  getCartList,
  addCart,
  cartToggle() {},
  cartDel(args) {
    return updateCart(args, "deleteSome");
  },
  cartUpdateQuantity(args) {
    return updateCart(args, "update");
  },
  cartUpdateSku(args) {
    return updateCart(args, "updateItemSku");
  },
  getUserName,
  checkStatus,
  getAddresses,
  getMyCoupons,
  deleteCoupon,
  logout,
  seckillList({ url }) {
    return seckillList(url);
  },
  sysTime: getSysTime(
    "https://api.m.taobao.com/rest/api3.do?api=mtop.common.getTimestamp",
    ({ data: { t } }) => t
  ),
  getGoodsPromotions,
  applyCoupon,
  getOrderRecords,
  deleteOrderRecords,
  relayOrderRecords,
};
