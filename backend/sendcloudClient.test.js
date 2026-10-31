import test from "node:test";
import assert from "node:assert/strict";
import {createSendcloudClient,normalizeShippingMethods,normalizeServicePoints} from "./sendcloudClient.js";
test("Sendcloud never accepts partial credentials",()=>{
  assert.throws(()=>createSendcloudClient({publicKey:"x"}),/Faltan/);
  assert.throws(()=>createSendcloudClient({secretKey:"secret"}),/Faltan/);
});
test("Sendcloud methods are read only and credentials use server-side Basic Auth",async()=>{
  const requests=[];
  const client=createSendcloudClient({publicKey:"public-test",secretKey:"secret-test",fetchImpl:async(url,options)=>{
    requests.push({url,options});
    return {ok:true,status:200,json:async()=>({shipping_methods:[{id:10,name:"Correos domicilio",carrier:"correos"}]})};
  }});
  assert.deepEqual(await client.verify(),{connected:true,methodsCount:1});
  assert.equal((await client.methods())[0].name,"Correos domicilio");
  assert.equal(requests[0].options.method,"GET");
  assert.equal(requests[0].options.headers.Authorization,"Basic "+Buffer.from("public-test:secret-test").toString("base64"));
  assert.ok(!requests[0].url.includes("secret-test"));
});
test("Sendcloud points query is v3 server-side, and never accepts malformed postcodes",async()=>{
  let called;
  const client=createSendcloudClient({publicKey:"p",secretKey:"s",fetchImpl:async(url,options)=>{
    called={url,options};return {ok:true,status:200,json:async()=>({
      data:{results:[{id:11,name:"Punto Correos",carrier:{name:"Correos",code:"correos"},address:{street:"Calle A",house_number:"1",postal_code:"28001",city:"Madrid"},position:{latitude:40,longitude:-3}}]}
    })};
  }});
  await assert.rejects(()=>client.points({postalCode:"../"}),/postal/);
  const points=await client.points({postalCode:"28001"});
  assert.equal(points[0].id,11);
  const url=new URL(called.url);
  assert.equal(url.pathname,"/api/v3/service-points");
  assert.equal(url.searchParams.get("country_code"),"ES");
  assert.equal(url.searchParams.get("use_integration_carriers"),"true");
  assert.equal(points[0].carrier,"Correos");
});
test("Error responses do not reflect API key values",async()=>{
  const client=createSendcloudClient({publicKey:"p",secretKey:"super-secret",fetchImpl:async()=>({ok:false,status:401})});
  await assert.rejects(()=>client.verify(),error=>!error.message.includes("super-secret")&&/rechazó/.test(error.message));
});
test("Ignore unrecognized method and point structures",()=>{
  assert.deepEqual(normalizeShippingMethods([{id:"wrong"}]),[]);
  assert.deepEqual(normalizeServicePoints({data:{results:[{id:null}]}}),[]);
});
