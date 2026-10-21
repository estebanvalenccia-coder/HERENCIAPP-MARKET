/**
 * Read-only Neon catalog export to Shopify draft CSV.
 * On a trusted server:
 * DATABASE_URL=... node scripts/exportShopifyCatalog.mjs --out=/private/herencia-shopify-drafts.csv
 * Never commit the resulting CSV or report to a public repository.
 */
import {writeFile, mkdir} from "node:fs/promises";
import {dirname} from "node:path";
import pg from "pg";
import {buildShopifyDraftCatalog, renderShopifyCsv} from "../backend/shopifyMigration.js";

const path = process.argv.find((arg) => arg.startsWith("--out="))?.slice(6);
if (!path || !path.endsWith(".csv")) throw new Error("Indica --out=/ruta/privada/catalog.csv");
if (!process.env.DATABASE_URL) throw new Error("Falta DATABASE_URL");
const pool=new pg.Pool({
  connectionString:process.env.DATABASE_URL,max:1,
  ssl:process.env.DATABASE_URL.includes("sslmode=") ? undefined : {rejectUnauthorized:false}
});
let client, committed=false;
try {
  client=await pool.connect();
  await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
  const queries=[
    "SELECT id,slug,name,type,description,status,price,compare_at_price,sku,track_inventory,stock,seo_title,seo_description FROM commerce_products ORDER BY id",
    "SELECT product_id,id,name,sku,price,compare_at_price,stock FROM commerce_product_variants ORDER BY product_id,position,id",
    "SELECT product_id,url,alt_text,position FROM commerce_product_images ORDER BY product_id,position,id",
    "SELECT product_id,collection_id FROM commerce_product_collections ORDER BY product_id,position",
  ];
  const [products,variants,images,relations]=await Promise.all(queries.map((sql)=>client.query(sql)));
  await client.query("COMMIT"); committed=true;
  const result=buildShopifyDraftCatalog({
    products:products.rows,variants:variants.rows,images:images.rows,relations:relations.rows
  });
  await mkdir(dirname(path),{recursive:true});
  await writeFile(path,renderShopifyCsv(result.rows),{mode:0o600,flag:"wx"});
  const reportPath=path.replace(/\.csv$/,".report.json");
  await writeFile(reportPath,JSON.stringify(result.report,null,2)+"\n",{mode:0o600,flag:"wx"});
  console.log(JSON.stringify({
    products:result.report.productCount,variantRows:result.report.variantCount,
    issues:result.report.issueCount,output:path,report:reportPath
  }));
} catch(error) {
  if (client && !committed) await client.query("ROLLBACK").catch(()=>{});
  throw error;
} finally {
  client?.release();
  await pool.end();
}
