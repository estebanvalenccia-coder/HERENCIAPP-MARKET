import { previewApiPolicy,isNeuralPreviewService } from "./previewAccess.js";
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT || 3000);
const root = fileURLToPath(new URL("./dist/", import.meta.url));
const backendOrigin = (process.env.BACKEND_ORIGIN || "https://herenciapp-market-production.up.railway.app").replace(/\/$/, "");
const buildId = process.env.RAILWAY_GIT_COMMIT_SHA || "local";

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function proxy(req, res) {
  const pathname=new URL(req.url||"/","http://localhost").pathname;
  const previewPolicy=previewApiPolicy(req.method,pathname);
  if(previewPolicy==="blocked"){
    res.writeHead(403,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-herencia-preview":"read-only"});
    return res.end(JSON.stringify({error:"Vista previa de solo lectura. Esta versión no puede acceder a cuentas ni modificar datos reales."}));
  }
  if(previewPolicy==="session"||previewPolicy==="auth-config"||previewPolicy==="mode"){
    const json=previewPolicy==="session"?{authenticated:false}:
      previewPolicy==="auth-config"?{totpRequired:false}:
      {enabled:true,readOnly:true,productionAccess:false};
    res.writeHead(200,{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-herencia-preview":"read-only"});
    return res.end(JSON.stringify(json));
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const headers = { ...req.headers };
  delete headers.host;
  delete headers["content-length"];
  if(previewPolicy==="public"){
    // No production credentials or session cookies leave the preview service.
    delete headers.cookie;
    delete headers.authorization;
    delete headers.origin;
    delete headers.referer;
    delete headers["x-forwarded-host"];
  }
  headers["x-forwarded-host"] = req.headers.host || "";
  headers["x-forwarded-proto"] = "https";

  try {
    const response = await fetch(`${backendOrigin}${req.url}`, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method || "GET") ? undefined : Buffer.concat(chunks),
      redirect: "manual",
    });
    const responseHeaders = Object.fromEntries(response.headers.entries());
    if(previewPolicy==="public"){
      delete responseHeaders["set-cookie"];
      delete responseHeaders["access-control-allow-origin"];
      delete responseHeaders["access-control-allow-credentials"];
      responseHeaders["cache-control"]="no-store";
      responseHeaders["x-herencia-preview"]="read-only";
    }
    res.writeHead(response.status, responseHeaders);
    if (response.body) {
      for await (const chunk of response.body) res.write(chunk);
    }
    res.end();
  } catch (error) {
    console.error("[frontend-proxy]", error);
    res.writeHead(502, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify({ error: "Backend no disponible", detail: error?.message || String(error) }));
  }
}

function safeFile(pathname) {
  const decoded = decodeURIComponent(pathname.split("?")[0]);
  const rel = normalize(decoded).replace(/^([/\\])+/, "");
  const candidate = join(root, rel);
  if (!candidate.startsWith(root)) return null;
  return candidate;
}

function serveFile(file, res, { cachePolicy = "revalidate" } = {}) {
  const type = mime[extname(file).toLowerCase()] || "application/octet-stream";
  const cacheControl =
    cachePolicy === "immutable"
      ? "public, max-age=31536000, immutable"
      : cachePolicy === "no-store"
        ? "no-store, no-cache, must-revalidate"
        : "public, max-age=0, must-revalidate";

  const headers = {
    "content-type": type,
    "cache-control": cacheControl,
    "x-herencia-build": buildId,
  };

  if (file.endsWith("/sw.js") || file.endsWith("\\sw.js")) {
    headers["service-worker-allowed"] = "/";
  }

  res.writeHead(200, headers);
  createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://localhost");
  if(url.pathname.startsWith("/api/"))return proxy(req,res);
  if (!["GET", "HEAD"].includes(req.method || "GET")) {
    res.writeHead(405, { Allow: "GET, HEAD" });
    return res.end();
  }

  const file = safeFile(url.pathname === "/" ? "index.html" : url.pathname);
  if (file && existsSync(file) && statSync(file).isFile()) {
    const cachePolicy =
      url.pathname === "/" || extname(file) === ".html" || url.pathname === "/sw.js"
        ? "no-store"
        : url.pathname.startsWith("/assets/")
          ? "immutable"
          : "revalidate";
    return serveFile(file, res, { cachePolicy });
  }

  const index = join(root, "index.html");
  if (existsSync(index)) return serveFile(index, res, { cachePolicy: "no-store" });

  res.writeHead(503, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
  res.end("Frontend build no disponible");
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Herencia frontend listening on ${port}; build=${buildId}; API proxy -> ${backendOrigin}`);
});
