import test from "node:test";
import assert from "node:assert/strict";
import {createPacklinkClient,validParcel,cleanServices} from "./packlinkProClient.js";
test("rejects missing credentials and invalid parcel inputs",()=>{
  assert.throws(()=>createPacklinkClient({}),/PACKLINK_API_KEY/);
  assert.throws(()=>validParcel({weightKg:0,widthCm:10,lengthCm:10,heightCm:10}),/Peso/);
  assert.throws(()=>validParcel({weightKg:1,widthCm:0,lengthCm:10,heightCm:10}),/Anchura/);
});
test("quotes use documented Packlink parameters and never expose key", async()=>{
  let called;
  const client=createPacklinkClient({apiKey:"my-secret",fetchImpl:async(url,options)=>{
    called={url,options};return {ok:true,status:200,json:async()=>[{
      id:42,carrier_name:"Correos",name:"Punto de recogida",currency:"EUR",
      delivery_to_parcelshop:true,price:{total_price:3.69}
    }]};
  }});
  const rates=await client.rates({fromZip:"08032",toZip:"28001",parcel:{weightKg:0.5,widthCm:12,lengthCm:20,heightCm:6}});
  assert.equal(rates[0].price,3.69);assert.equal(rates[0].destinationPickup,true);
  const query=new URL(called.url).searchParams;
  assert.equal(query.get("packages[0][weight]"),"0.5");
  assert.equal(query.get("from[zip]"),"08032");
  assert.equal(query.get("to[zip]"),"28001");
  assert.equal(called.options.headers.Authorization,"my-secret");
  assert.ok(!JSON.stringify(rates).includes("my-secret"));
});
test("credentials rejection is sanitized",async()=>{
  const client=createPacklinkClient({apiKey:"secret",fetchImpl:async()=>({ok:false,status:401})});
  await assert.rejects(()=>client.verify(),/rechazado/);
});
test("dropoffs validate ID and return normalized addresses",async()=>{
  const client=createPacklinkClient({apiKey:"x",fetchImpl:async()=>({ok:true,status:200,json:async()=>[{id:"p1",commerce_name:"Tienda",address:"Calle X",city:"Madrid",zip:"28001"}]})});
  assert.equal((await client.dropoffs({serviceId:"42",postalCode:"28001"}))[0].name,"Tienda");
  await assert.rejects(()=>client.dropoffs({serviceId:"../x",postalCode:"28001"}),/inválido/);
});
test("never silently accept missing or invalid prices",()=>{
  assert.deepEqual(cleanServices([{id:"x",price:{}},{id:"y",price:{total_price:3},currency:"USD"}]),[]);
});
