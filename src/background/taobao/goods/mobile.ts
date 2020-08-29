import { getItemId } from ".";
import { requestData } from "../tools";

export async function getGoodsDetailFromMobile(url: string) {
  var itemId = getItemId(url);
  /* 
    ttid: "2017@taobao_h5_6.6.0",
    AntiCreep: "true",
   */
  var { apiStack, item, skuBase: p_skuBase } = await requestData(
    "mtop.taobao.detail.getdetail",
    {
      data: { itemNumId: itemId },
      version: "6.0",
    }
  );
  let { skuBase, skuCore } = JSON.parse(apiStack[0].value);
  let sku_ret;
  let quantity = 0;
  let price: string = "0";
  if (!skuBase) {
    skuBase = p_skuBase;
  }
  if (skuBase) {
    let { props, skus } = skuBase;
    let sortOrders = props
      .map(({ values }, index) => ({
        sortOrder: +values[0].sortOrder,
        index,
      }))
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ index }) => index);
    function f(i, vids: string[]) {
      var parent = {
        pid: props[i].pid,
        name: props[i].name,
        children: props[i].values
          .map((item) => {
            var data: any = {
              value: item.vid,
              label: item.name,
            };
            vids[i] = props[i].pid + ":" + item.vid;
            if (i < props.length - 1) {
              Object.assign(data, f(i + 1, vids));
            } else {
              let vid_str = sortOrders.map((i) => vids[i]).join(";");
              let sku = skus.find((item) => item.propPath === vid_str);
              if (!sku) {
                return;
              }
              let { skuId } = sku;
              let { quantity, price } = skuCore.sku2info[skuId];
              // if (+quantity === 0) {
              //   return;
              // }
              data.children = [
                {
                  label: `￥${price.priceText}, ${quantity}`,
                  value: skuId,
                },
              ];
            }
            return data;
          })
          .filter(Boolean),
      };
      return parent;
    }
    sku_ret = f(0, []);
  }
  if (skuCore && skuCore.sku2info) {
    if (skuCore.sku2info[0]) {
      quantity = +skuCore.sku2info[0].quantity;
      price = skuCore.sku2info[0].price.priceText;
    }
  }
  return { skus: sku_ret, item, title: item.title, quantity, price };
}

export async function getGoodsInfoFromMobile(url: string, skuId?: string) {
  var itemId = getItemId(url);
  var data = await requestData("mtop.taobao.detail.getdetail", {
    data: { itemNumId: itemId },
    version: "6.0",
  });
  return transformMobileGoodsInfo(data, skuId);
}

function transformMobileGoodsInfo({ apiStack, item }, skuId?: string) {
  let { delivery, trade, skuBase, skuCore, price } = JSON.parse(
    apiStack[0].value
  );
  let buyEnable = trade.buyEnable === "true";
  let cartEnable = trade.cartEnable === "true";
  let msg: string | undefined;
  let cuxiao: any;
  let quantity = 0;
  if (!buyEnable) {
    if (trade.hintBanner) {
      msg = trade.hintBanner.text;
    } else {
      msg = trade.reason;
    }
  }
  if (!skuId) {
    skuId = "0";
  }
  /* if (skuBase && skuBase.props) {
    if (skus) {
      let propPath = skuBase.props
        .map(
          ({ pid, values }, i) =>
            `${pid}:${
              values[((skus[i] || 0) + values.length) % values.length].vid
            }`
        )
        .join(";");
      let skuItem = skuBase.skus.find(item => item.propPath === propPath);
      if (!skuItem) {
        throwError("指定商品型号不存在");
      } else {
        skuId = skuItem.skuId;
      }
    }
  } */
  if (skuCore) {
    if (skuId === "0") {
      let min = Infinity;
      for (let key of Object.keys(skuCore.sku2info)) {
        if (key === "0") {
          continue;
        }
        let { price, quantity } = skuCore.sku2info[key];
        if (price.priceText.includes("-") || !(Number(quantity) > 0)) {
          continue;
        }
        let p = Number(price.priceText);
        if (p < min) {
          min = p;
          skuId = key;
        }
      }
    }
    let item = skuCore.sku2info[skuId];
    if (item) {
      quantity = Number(item.quantity);
      price = item;
    }
  }
  if (price.shopProm) {
    cuxiao = price.shopProm.map(
      (p: { type: number; content: string[]; title: string }) => {
        var quota = 0;
        var discount = 1;
        var amount = 1;
        if (p.type === 3) {
          // 满多少件打折
          let arr = /满(\d+)件,打(\d+)折/.exec(p.content[0])!;
          amount = +arr[1];
          discount = +arr[2] / 10;
        } else if (p.type === 5) {
          // 送积分
          discount = Number(/(\d+)/.exec(p.content[0]![1]));
        }
        return {
          type: p.type,
          title: p.title,
          quota,
          discount,
          amount,
        };
      }
    );
  }
  return {
    itemId: item.itemId,
    title: item.title,
    quantity,
    buyEnable,
    cartEnable,
    msg,
    skuId,
    delivery,
    price: +price.price.priceText,
    cuxiao,
  };
}