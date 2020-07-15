import { request } from "../../common/request";
import { flatten } from "ramda";
import { formatUrl } from "@/background/common/tool";

export async function getCartListFromPc() {
  var html: string = await request.get(`https://cart.taobao.com/cart.htm`, {
    qs: {
      spm: "a231o.7712113/g.1997525049.1.3e004608MXPqWt",
      prepvid: `200_11.21.9.212_38091_${Date.now()}`,
      extra: "",
      from: "mini",
      ad_id: "",
      am_id: "",
      cm_id: "",
      pm_id: "1501036000a02c5c3739",
      // pid: "mm_121093092_20166288_69356911",
      clk1: "",
      unid: "",
      source_id: "",
      app_pvid: `200_11.21.9.212_38091_${Date.now()}`,
    },
  });
  var text = /var firstData = (.*);}catch \(e\)/.exec(html)![1];
  var { list } = JSON.parse(text);
  var ret = list.map((item: any) => {
    var vendor = {
      title: item.title,
      id: item.sellerId,
      shopId: item.shopId,
      url: item.url,
      items: flatten(
        item.bundles.map((bundle) =>
          bundle.orders.map((subitem: any) => ({
            id: subitem.id,
            cartId: subitem.cartId,
            quantity: subitem.amount.now,
            isValid: subitem.isValid,
            sellerId: subitem.sellerId,
            shopId: subitem.shopId,
            skuId: subitem.skuId,
            itemId: subitem.itemId,
            url: formatUrl(subitem.url),
            img: formatUrl(subitem.pic),
            title: subitem.title,
            price: subitem.price.now / 100,
            attr: subitem.attr,
            checked: subitem.checked,
            createTime: subitem.createTime,
            toBuy: subitem.toBuy,
          }))
        )
      ),
    };
    return vendor;
  });
  return ret;
}
