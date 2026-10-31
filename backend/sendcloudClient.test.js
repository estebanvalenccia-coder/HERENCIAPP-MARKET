import test from "node:test";
import assert from "node:assert/strict";
import {createSendcloudClient, normalizeShippingOptions, normalizeServicePoints} from "./sendcloudClient.js";

test("Sendcloud requires both backend credentials",()=>{
  assert.throws(()=>createSendcloudClient({publicKey:"x"}),/Faltan/);
  assert.throws(()=>createSendcloudClient({secretKey:"secret"}),/Faltan/);
});
test("Sendcloud v3 organization verifies account without leaking secrets",async()=>{
  const calls=[];
  const client=createSendcloudClient({publicKey:"pub",secretKey:"sec",fetchImpl:async(url,options)=>{
    calls.push({url,options});return {ok:true,status:200,json:async()=>({data:{id:12345,name:"Tropical"}})};
  }});
  assert.deepEqual(await client.verify(),{connected:true,organizationVerified:true});
  assert.equal(new URL(calls[0].url).pathname,"/api/v3/organization");
  assert.equal(calls[0].options.method,"GET");
  assert.equal(calls[0].options.headers.Authorization,"Basic "+Buffer.from("pub:sec").toString("base64"));
  assert.ok(!JSON.stringify(await client.verify()).includes("sec"));
});
test("Sendcloud v3 quotes require real parcel dimensions and use calculate_quotes",async()=>{
  let called;
  const client=createSendcloudClient({publicKey:"pub",secretKey:"sec",fetchImpl:async(url,options)=>{
    called={url,options};return {ok:true,status:200,json:async()=>({data:[
      {code:"carrier:home",carrier:{name:"Correos"},product:{name:"Domicilio"},
        quote:{total_price:{value:"4.49",currency:"EUR"}}},
      {code:"carrier:point",carrier:{name:"Correos"},product:{name:"Punto"}},
    ]})};
  }});
  const quotes=await client.quotes({fromZip:"08032",toZip:"28001",parcel:{length:20,width:15,height:10,weight:0.5}});
  assert.equal(quotes[0].price,4.49);
  assert.equal(quotes[1].price,null);
  assert.equal(new URL(called.url).pathname,"/api/v3/shipping-options");
  assert.equal(called.options.method,"POST");
  assert.deepEqual(JSON.parse(called.options.body).parcels,[{dimensions:{length:"20",width:"15",height:"10",unit:"cm"},weight:{value:"0.5",unit:"kg"}}]);
  assert.equal(JSON.parse(called.options.body).calculate_quotes,true);
  await assert.rejects(()=>client.quotes({fromZip:"abc",toZip:"28001",parcel:{length:20,width:15,height:10,weight:0.5}}),/postal/);
});
test("Sendcloud points use current API, reject invalid input",async()=>{
  let called;
  const client=createSendcloudClient({publicKey:"p",secretKey:"s",fetchImpl:async(url,options)=>{
    called={url,options};return {ok:true,status:200,json:async()=>({
      data:{results:[{id:11,name:"Punto Correos",carrier:{name:"Correos",code:"correos"},address:{street:"Calle A",house_number:"1",postal_code:"28001",city:"Madrid"},position:{latitude:40,longitude:-3}}]}
    })};
  }});
  await assert.rejects(()=>client.points({postalCode:"../"}),/postal/);
  const points=await client.points({postalCode:"28001"});
  assert.equal(points[0].id,11);
  assert.equal(new URL(called.url).pathname,"/api/v3/service-points");
  assert.equal(new URL(called.url).searchParams.get("country_code"),"ES");
  assert.equal(points[0].carrier,"Correos");
});
test("Sendcloud rejects authorization errors without reflecting secrets",async()=>{
  const client=createSendcloudClient({publicKey:"p",secretKey:"super-secret",fetchImpl:async()=>({ok:false,status:401})});
  await assert.rejects(()=>client.verify(),error=>!error.message.includes("super-secret")&&/rechazó/.test(error.message));
});
test("Unpriced options are never mistaken for real prices",()=>{
  assert.deepEqual(normalizeShippingOptions({data:[{code:"a"},{code:"b",quote:{total_price:{value:"99",currency:"USD"}}}]}).map(x=>x.price),[null,null]);
  assert.deepEqual(normalizeServicePoints({data:{results:[{id:null}]}}),[]);
});
