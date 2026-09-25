import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { CalendarDays } from "lucide-react";
import { backendStorage } from "../lib/backendStorage";

export function CampaignPage(){
  const {slug}=useParams();
  const [campaign,setCampaign]=useState<any>(null);
  useEffect(()=>{try{const d=JSON.parse(backendStorage.getItem("marketingContent")||"{}");const c=(d.campaigns||[]).find((x:any)=>x.slug===slug);if(!c||!c.active)return setCampaign(null);const now=Date.now();if(c.startAt&&new Date(c.startAt).getTime()>now)return setCampaign(null);if(c.endAt&&new Date(c.endAt).getTime()<now)return setCampaign(null);setCampaign(c);}catch{setCampaign(null);}},[slug]);
  if(!campaign)return <div className="min-h-[65vh] grid place-items-center px-4"><div className="text-center"><CalendarDays className="mx-auto h-10 w-10 text-primary"/><h1 className="mt-4 text-3xl font-black">Campaña no disponible</h1><Link to="/productos" className="mt-4 inline-block text-primary font-semibold">Ver catálogo</Link></div></div>;
  return <div className="min-h-[75vh] relative grid place-items-center overflow-hidden bg-[#294c35] px-5 py-16 text-white">{campaign.imageUrl&&<img src={campaign.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover"/>}<div className="absolute inset-0 bg-black/50"/><div className="relative z-10 max-w-3xl text-center"><p className="font-bold uppercase tracking-[.25em]">{campaign.eyebrow||"HERENCIA"}</p><h1 className="mt-4 text-5xl font-black md:text-7xl">{campaign.title}</h1><p className="mx-auto mt-5 max-w-2xl text-lg text-white/85">{campaign.description}</p><Link to={campaign.buttonHref||"/productos"} className="mt-8 inline-flex rounded-xl bg-white px-6 py-3 font-bold text-[#294c35]">{campaign.buttonLabel||"Ver productos"}</Link></div></div>;
}
