import { requestData } from "../tools";
import { getGoodsInfo } from "../goods";
import setting from "../setting";
import { CartItem, addCart, updateCart, ParamsOfAddCart } from "../cart";
import { VendorInfo } from "../cart";

const spm = "a222m.7628550.0.0";
export async function getRawCartListFromMobile() {
  return requestData("mtop.trade.querybag", {
    data: {
      exParams: JSON.stringify({
        mergeCombo: "true",
        version: "1.0.0",
        globalSell: "1",
        spm,
        cartfrom: "detail",
      }),
      isPage: "false",
      extStatus: "0",
      spm,
      cartfrom: "detail",
    },
    version: "5.0",
  });
}

const pattern = /\$\{(.*)\}/;
export async function getCartListFromMobile() {
  var resData = await getRawCartListFromMobile();
  var { hierarchy, data, controlParas } = resData;

  var structure: Record<string, string[]> = hierarchy.structure;

  function getPatternUrl(data: any) {
    var url = data.url;
    if (url.startsWith("$")) {
      url = (<string>controlParas[pattern.exec(data.url)![1]]).replace(
        pattern,
        (_, key) => data[key]
      );
    }
    if (url.startsWith("//")) {
      url = "https:" + url;
    }
    return url;
  }

  function mapper(key: string) {
    var { id, fields } = data[key];
    var {
      title,
      valid,
      settlement,
      quantity: { quantity },
      sellerId,
      cartId,
      shopId,
      itemId,
      sku: { skuId },
      pay: { now },
      pic,
      checked,
    } = fields;
    return <CartItem>{
      id,
      title,
      valid,
      settlement,
      quantity,
      sellerId,
      cartId,
      shopId,
      itemId,
      skuId,
      price: now / 100,
      img: pic.startsWith("//") ? "https:" + pic : pic,
      url: getPatternUrl(fields),
      checked,
    };
  }

  var ret: VendorInfo[] = [];
  function findData(name: string) {
    if (!structure[name]) {
      return;
    }
    var items = structure[name];
    if (items[0].startsWith("shop")) {
      let { id, fields } = data[items[0]];
      // let groups = items.filter(item => item.startsWith("group_"));
      let children: any[] = [];
      items.slice(1).forEach((key) => {
        if (!structure[key]) {
          return;
        }
        structure[key].map((_item) => {
          children.push(mapper(_item));
        });
      });
      ret.push({
        id,
        title: fields.title,
        sellerId: fields.sellerId,
        shopId: fields.shopId,
        valid: fields.valid,
        url: getPatternUrl(fields),
        items: children,
      });
    } else {
      if (name === "bundlev2_invalid") {
        let items_jhs = items
          .filter((key) => data[key].fields.titleInCheckBox === "预热")
          .map(mapper);
        if (items_jhs.length > 0) {
          ret.unshift({
            id: "",
            title: "聚划算未开团",
            sellerId: "",
            shopId: "",
            valid: false,
            url: "",
            items: items_jhs,
          });
        }
        let items_invalid = items
          .filter((key) => data[key].fields.titleInCheckBox !== "预热")
          .map(mapper);
        if (items_invalid.length > 0) {
          ret.push({
            id: name,
            title: "失效宝贝",
            sellerId: "",
            shopId: "",
            valid: false,
            url: "",
            items: items_invalid,
          });
        }
        return;
      }
      structure[name].forEach((key) => findData(key));
    }
  }

  findData(hierarchy.root);
  return ret;
}

export async function addCartFromMobile(args: ParamsOfAddCart) {
  var itemId;
  var skuId;
  if (/skuId=(\d+)/.test(args.url)) {
    skuId = RegExp.$1;
    itemId = /id=(\d+)/.exec(args.url)![1];
  } else {
    var res = await getGoodsInfo(args.url, args.skuId);
    if (res.quantity === 0) {
      throw new Error("无库存了");
    }
    skuId = res.skuId;
    itemId = res.itemId;
  }
  var { cartId } = await requestData("mtop.trade.addbag", {
    data: {
      itemId,
      quantity: args.quantity,
      exParams: JSON.stringify({
        addressId: "9607477385",
        etm: "",
        buyNow: "true",
        _input_charset: "utf-8",
        areaId: "320583",
        divisionId: "320583",
      }),
      skuId,
    },
    method: "post",
    version: "3.1",
  });
  return cartId;
}

export async function updateCartFromMobile(
  {
    items,
  }: {
    items: any[];
  },
  action: string
) {
  var { cartId, quantity } = items[0];
  var { hierarchy, data }: any = await getRawCartListFromMobile();
  var updateKey = Object.keys(data).find(
    (key) => data[key].fields.cartId === cartId
  )!;
  var key = Object.keys(hierarchy.structure).find((key) =>
    hierarchy.structure[key].includes(updateKey)
  )!;
  var cdata = hierarchy.structure[key].reduce((state, key) => {
    var { fields } = data[key];
    state[key] = {
      fields: {
        bundleId: fields.bundleId,
        cartId: fields.cartId,
        checked: fields.checked,
        itemId: fields.itemId,
        quantity: fields.quantity.quantity,
        shopId: fields.shopId,
        valid: fields.valid,
      },
    };
    return state;
  }, {});
  cdata[updateKey].fields.quantity = quantity;
  var { cartId } = await requestData("mtop.trade.updatebag", {
    data: {
      p: JSON.stringify({
        data: cdata,
        operate: { [action]: [updateKey] },
        hierarchy,
      }),
      extStatus: "0",
      feature: '{"gzip":false}',
      exParams: JSON.stringify({
        mergeCombo: "true",
        version: "1.0.0",
        globalSell: "1",
        spm: setting.spm,
        cartfrom: "detail",
      }),
      spm: setting.spm,
      cartfrom: "detail",
    },
    method: "post",
  });
  return cartId;
}
