import {list,write} from "./previewSandboxStorage.js";
export const demoProducts=[
 {id:"demo-plant-1",name:"Pothos (ejemplo)",price:12.9,stock:10,image:"https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=640",category:"plantas",active:true},
 {id:"demo-plant-2",name:"Sansevieria (ejemplo)",price:19.5,stock:8,image:"https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=640",category:"plantas",active:true}
];
export const demoCollections=[{id:"plantas",name:"Plantas de prueba",status:"active"}];
export async function getDemoProducts(ns){return list(ns,"adminProducts",demoProducts)}
export async function getDemoCollections(ns){return list(ns,"previewCollections",demoCollections)}
export async function saveDemoProducts(ns,rows){await write(ns,"adminProducts",JSON.stringify(rows))}
