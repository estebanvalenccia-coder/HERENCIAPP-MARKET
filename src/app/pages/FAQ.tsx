import { useEffect, useState } from "react";
import { HelpCircle } from "lucide-react";
import { backendStorage } from "../lib/backendStorage";

export function FAQ(){
  const [faqs,setFaqs]=useState<any[]>([]);
  useEffect(()=>{try{const d=JSON.parse(backendStorage.getItem("marketingContent")||"{}");setFaqs(Array.isArray(d.faqs)?d.faqs:[]);}catch{setFaqs([]);}},[]);
  return <div className="mx-auto max-w-4xl px-4 py-12"><div className="text-center"><HelpCircle className="mx-auto h-10 w-10 text-primary"/><h1 className="mt-4 text-4xl font-black">Preguntas frecuentes</h1><p className="mt-3 text-muted-foreground">Información práctica sobre pedidos, entregas y productos de Herencia.</p></div><div className="mt-10 space-y-3">{faqs.length===0?<p className="text-center text-muted-foreground">Estamos preparando esta sección.</p>:faqs.map((faq:any)=><details key={faq.id} className="group rounded-2xl border border-border bg-card p-5"><summary className="cursor-pointer list-none font-bold">{faq.question}</summary><p className="mt-3 leading-relaxed text-muted-foreground">{faq.answer}</p></details>)}</div></div>;
}
