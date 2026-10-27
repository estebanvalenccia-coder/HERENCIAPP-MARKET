import test from "node:test";
import assert from "node:assert/strict";
import { campaignMonth } from "../src/app/lib/campaignCalendar.mjs";

test("October calendar has 31 days and starts with its first date", () => {
  const days = campaignMonth("2026-10",[]);
  assert.equal(days.length,31);
  assert.equal(days[0].date,"2026-10-01");
  assert.equal(days.at(-1).date,"2026-10-31");
});
test("Madrid time includes DST-switching days correctly", () => {
  const result=campaignMonth("2026-10",[{
    id:"halloween", title:"Halloween", enabled:true,
    schedule:{startAt:"2026-10-24T22:00:00Z",endAt:"2026-10-27T23:00:00Z"}
  }]);
  assert.deepEqual(result.filter(day=>day.campaigns.length).map(day=>day.date),["2026-10-25","2026-10-26","2026-10-27"]);
});
test("a midnight end is excluded and an invalid window is not displayed", () => {
  const result=campaignMonth("2026-10",[{
    id:"one",title:"Ofertas",enabled:false,
    schedule:{startAt:"2026-10-04T22:00:00Z",endAt:"2026-10-06T22:00:00Z"}
  },{
    id:"invalid",title:"Inválida",schedule:{startAt:"oops"}
  }]);
  assert.deepEqual(result.filter(day=>day.campaigns.length).map(day=>day.date),["2026-10-05","2026-10-06"]);
  assert.equal(result[4].campaigns[0].enabled,false);
});
test("no schedule does not fill the calendar automatically",()=>{
  assert.equal(campaignMonth("2026-11",[{id:"a",title:"Sin fecha"}]).every(x=>x.campaigns.length===0),true);
});
