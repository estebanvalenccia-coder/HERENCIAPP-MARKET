// The Neural code preview runs a GitHub branch that has NOT been reviewed.
// Never let that branch authenticate as a production administrator or mutate
// the production backend. It is a visual, read-only rehearsal.
export function isNeuralPreviewService(env=process.env){
 const name=String(env.RAILWAY_SERVICE_NAME||"");
 const branch=String(env.RAILWAY_GIT_BRANCH||"");
 return /^neural-preview-[a-f0-9]{32}$/i.test(name)&&branch.startsWith("neural/");
}
const PUBLIC_GET_PATHS=new Set([
 "/api/storage",
 "/api/commerce/products",
 "/api/commerce/collections",
 "/api/settings/public",
 "/api/shipping/availability",
 "/api/commerce/categories",
]);
const PUBLIC_STORAGE_KEYS=new Set([
 "siteContent","marketExperience","adminProducts","herenciaSettings","customTheme",
 "menuIcons","shippingSettings","heroBanner","ctaBanner","marketingContent",
 "communityContent","storefrontPosts","internationalDeliverySettings",
]);
export function previewApiPolicy(method,pathname,env=process.env){
 if(!isNeuralPreviewService(env))return "normal";
 const action=String(method||"GET").toUpperCase();
 if(action==="GET"&&pathname==="/api/preview/mode")return "mode";
 if(action==="GET"&&pathname==="/api/admin/session")return "session";
 if(action==="GET"&&pathname==="/api/admin/auth-config")return "auth-config";
 if(action!=="GET"&&action!=="HEAD")return "blocked";
 if(PUBLIC_GET_PATHS.has(pathname))return "public";
 if(pathname.startsWith("/api/storage/")){
  const key=decodeURIComponent(pathname.slice("/api/storage/".length));
  if(PUBLIC_STORAGE_KEYS.has(key))return "public";
 }
 return "blocked";
}
