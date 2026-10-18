import test from "node:test";
import assert from "node:assert/strict";
import {extractAliExpressProduct} from "./aliexpressConnector.js";
import {makeAliExpressUnpublishedDraft} from "./aliexpressDraftImporter.js";

const fixture={aliexpress_ds_product_get_response:{rsp_code:200,rsp_msg:"Call succeeds",result:{
  ae_item_base_info_dto:{product_id:1005009876543210,subject:"Lámpara de diseño",currency_code:"EUR",product_status_type:"onSelling"},
  ae_multimedia_info_dto:{image_urls:"http://g01.a.alicdn.com/kf/photo1.jpg;https://ae01.alicdn.com/kf/photo2.jpg"},
  ae_item_sku_info_dtos:{ae_item_sku_info_d_t_o:[{
    id:"14:193;200000124:100010480",sku_code:"LAMP-S",sku_stock:true,sku_price:"12.30",sku_available_stock:15,
    ae_sku_property_dtos:{ae_sku_property_d_t_o:[{sku_property_name:"Color",sku_property_value:"Azul",sku_image:"https://ae01.alicdn.com/kf/color.jpg"},{sku_property_name:"Tamaño",sku_property_value:"S"}]}
  },{
    id:"14:175;200000124:100010481",sku_code:"LAMP-L",sku_stock:true,sku_price:"15.60",sku_available_stock:5,
    ae_sku_property_dtos:{ae_sku_property_d_t_o:[{sku_property_name:"Color",sku_property_value:"Verde"}]}
  }]}
}}};
test("Official AliExpress product API is imported with images, variant SKUs and exact SKU attr identity",()=>{
  const item=extractAliExpressProduct(fixture,"1005009876543210");
  assert.equal(item.variants.length,2);
  assert.equal(item.variants[0].variantId,"14:193;200000124:100010480");
  assert.equal(item.variants[0].properties[0].value,"Azul");
  assert.equal(item.variants[0].stock,15);
  assert.ok(item.images.every(url=>url.startsWith("https://")));
  const draft=makeAliExpressUnpublishedDraft(item);
  assert.equal(draft.metadata.supplierConnectionKey,"aliexpress");
  assert.equal(draft.metadata.providerOrderProductId,"1005009876543210");
  assert.equal(draft.variants[0].supplierVariantId,item.variants[0].variantId);
  assert.equal(draft.status,"draft");
  assert.equal(draft.metadata.orderAutomationEnabled,false);
});
test("Provider error and invalid product must not create storefront drafts",()=>{
  assert.throws(()=>extractAliExpressProduct({aliexpress_ds_product_get_response:{rsp_code:403,rsp_msg:"Denied"}},"1005009876543210"));
  assert.throws(()=>makeAliExpressUnpublishedDraft({productId:"1005009876543210",name:"Test",variants:[]}));
});
