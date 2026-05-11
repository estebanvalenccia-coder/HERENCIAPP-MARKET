import { AlertTriangle, Boxes, Flower2, PackageCheck, TrendingDown } from "lucide-react";
import { useMemo } from "react";

const STOCK_KEY = 'herencia_stock'

function money(value:number){
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value||0)
}

export function AdminStockControl(){
  const stock = useMemo(()=>{
    return JSON.parse(localStorage.getItem(STOCK_KEY)||'[]')
  },[])

  const metrics = useMemo(()=>{
    const totalProducts = stock.length

    const lowStock = stock.filter((p:any)=>Number(p.stock||0)<=5)

    const noStock = stock.filter((p:any)=>Number(p.stock||0)<=0)

    const inventoryValue = stock.reduce((sum:number,p:any)=>{
      return sum + (Number(p.stock||0) * Number(p.price||0))
    },0)

    return {
      totalProducts,
      lowStock,
      noStock,
      inventoryValue,
    }
  },[stock])

  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <Card
          icon={<Boxes className='h-6 w-6 text-emerald-700' />}
          title='Productos'
          value={String(metrics.totalProducts)}
        />

        <Card
          icon={<AlertTriangle className='h-6 w-6 text-amber-600' />}
          title='Stock bajo'
          value={String(metrics.lowStock.length)}
        />

        <Card
          icon={<TrendingDown className='h-6 w-6 text-rose-600' />}
          title='Agotados'
          value={String(metrics.noStock.length)}
        />

        <Card
          icon={<PackageCheck className='h-6 w-6 text-emerald-700' />}
          title='Valor inventario'
          value={money(metrics.inventoryValue)}
        />
      </div>

      <section className='rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl backdrop-blur-xl'>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h2 className='text-3xl font-black text-zinc-900'>Alertas de stock</h2>
            <p className='text-sm font-semibold text-zinc-500'>Conectado automáticamente al TPV</p>
          </div>

          <div className='rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700'>LIVE</div>
        </div>

        <div className='space-y-3'>
          {metrics.lowStock.map((product:any)=>(
            <div key={product.id} className='flex items-center justify-between rounded-3xl border border-amber-100 bg-amber-50/60 p-5'>
              <div className='flex items-center gap-4'>
                <div className='grid h-14 w-14 place-items-center rounded-3xl bg-white text-2xl'>
                  🌿
                </div>

                <div>
                  <h3 className='font-black text-zinc-900'>{product.name}</h3>
                  <p className='text-sm font-semibold text-zinc-500'>SKU: {product.sku || 'N/A'}</p>
                </div>
              </div>

              <div className='text-right'>
                <p className='text-sm font-bold text-zinc-500'>Stock restante</p>
                <h3 className='text-3xl font-black text-amber-700'>{product.stock}</h3>
              </div>
            </div>
          ))}

          {!metrics.lowStock.length && (
            <div className='rounded-3xl border border-dashed border-emerald-200 p-10 text-center'>
              <Flower2 className='mx-auto mb-4 h-14 w-14 text-emerald-400' />
              <h3 className='text-2xl font-black text-zinc-900'>Todo el stock está correcto</h3>
              <p className='mt-2 font-semibold text-zinc-500'>No hay alertas activas en este momento.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Card({icon,title,value}:{icon:any,title:string,value:string}){
  return(
    <div className='rounded-[1.8rem] border border-emerald-100 bg-white/90 p-5 shadow-xl backdrop-blur-xl'>
      <div className='mb-4 flex items-center justify-between'>
        <div className='grid h-14 w-14 place-items-center rounded-3xl bg-emerald-50'>
          {icon}
        </div>
      </div>

      <p className='text-sm font-bold text-zinc-500'>{title}</p>
      <h3 className='mt-2 text-4xl font-black tracking-tight text-zinc-950'>{value}</h3>
    </div>
  )
}
