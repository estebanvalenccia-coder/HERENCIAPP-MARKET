import { ArrowDownRight, ArrowUpRight, ChartNoAxesCombined, Package, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import { getDashboardMetrics, getFinanceMovements, getSales } from "../../lib/tpvFinanceEngine";

function money(value:number){
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value||0)
}

export function AdminFinanceDashboard(){
  const metrics = getDashboardMetrics()
  const finance = getFinanceMovements()
  const sales = getSales()

  const expenses = finance
    .filter(f=>f.type==='expense')
    .reduce((sum,f)=>sum+f.amount,0)

  const estimatedProfit = metrics.income - expenses - metrics.totalIVA

  const topProductsMap = new Map<string,{qty:number,total:number}>()

  sales.forEach(sale=>{
    sale.items.forEach(item=>{
      const current = topProductsMap.get(item.name) || {qty:0,total:0}

      topProductsMap.set(item.name,{
        qty: current.qty + item.qty,
        total: current.total + item.price * item.qty,
      })
    })
  })

  const topProducts = [...topProductsMap.entries()]
    .sort((a,b)=>b[1].qty-a[1].qty)
    .slice(0,5)

  return (
    <div className='space-y-6'>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <MetricCard
          title='Ventas hoy'
          value={money(metrics.totalSales)}
          icon={<TrendingUp className='h-6 w-6 text-emerald-700' />}
          badge='TPV sincronizado'
        />

        <MetricCard
          title='IVA generado'
          value={money(metrics.totalIVA)}
          icon={<Wallet className='h-6 w-6 text-emerald-700' />}
          badge='Automático'
        />

        <MetricCard
          title='Beneficio estimado'
          value={money(estimatedProfit)}
          icon={<PiggyBank className='h-6 w-6 text-emerald-700' />}
          badge='Finanzas'
        />

        <MetricCard
          title='Transacciones'
          value={String(metrics.transactions)}
          icon={<ChartNoAxesCombined className='h-6 w-6 text-emerald-700' />}
          badge='Tiempo real'
        />
      </div>

      <div className='grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_.7fr]'>
        <section className='rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl backdrop-blur-xl'>
          <div className='mb-6 flex items-center justify-between'>
            <div>
              <h2 className='text-3xl font-black text-zinc-900'>Resumen financiero</h2>
              <p className='text-sm font-semibold text-zinc-500'>Ventas, beneficios y gastos sincronizados</p>
            </div>
            <div className='rounded-2xl bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700'>LIVE</div>
          </div>

          <div className='space-y-4'>
            <FinanceRow
              title='Ingresos'
              value={money(metrics.income)}
              icon={<ArrowUpRight className='h-5 w-5 text-emerald-700' />}
              positive
            />

            <FinanceRow
              title='Gastos'
              value={money(expenses)}
              icon={<ArrowDownRight className='h-5 w-5 text-rose-600' />}
            />

            <FinanceRow
              title='IVA pendiente'
              value={money(metrics.totalIVA)}
              icon={<Wallet className='h-5 w-5 text-amber-600' />}
            />

            <FinanceRow
              title='Beneficio estimado'
              value={money(estimatedProfit)}
              icon={<TrendingUp className='h-5 w-5 text-emerald-700' />}
              positive
            />
          </div>
        </section>

        <section className='rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl backdrop-blur-xl'>
          <div className='mb-6 flex items-center justify-between'>
            <div>
              <h2 className='text-2xl font-black text-zinc-900'>Productos TOP</h2>
              <p className='text-sm font-semibold text-zinc-500'>Más vendidos</p>
            </div>
            <Package className='h-6 w-6 text-emerald-700' />
          </div>

          <div className='space-y-3'>
            {topProducts.map(([name,data],index)=>(
              <div key={name} className='rounded-2xl border border-emerald-50 bg-emerald-50/40 p-4'>
                <div className='flex items-center justify-between'>
                  <div>
                    <p className='font-black text-zinc-900'>#{index+1} {name}</p>
                    <p className='text-sm font-semibold text-zinc-500'>{data.qty} unidades</p>
                  </div>
                  <div className='text-right'>
                    <p className='text-lg font-black text-emerald-700'>{money(data.total)}</p>
                  </div>
                </div>
              </div>
            ))}

            {!topProducts.length && (
              <div className='rounded-2xl border border-dashed border-emerald-200 p-8 text-center text-zinc-400'>
                Aún no hay ventas registradas.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function MetricCard({title,value,icon,badge}:{title:string,value:string,icon:any,badge:string}){
  return(
    <div className='rounded-[1.8rem] border border-emerald-100 bg-white/90 p-5 shadow-xl backdrop-blur-xl'>
      <div className='mb-4 flex items-center justify-between'>
        <div className='grid h-14 w-14 place-items-center rounded-3xl bg-emerald-50'>
          {icon}
        </div>
        <div className='rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700'>
          {badge}
        </div>
      </div>

      <p className='text-sm font-bold text-zinc-500'>{title}</p>
      <h3 className='mt-2 text-4xl font-black tracking-tight text-zinc-950'>{value}</h3>
    </div>
  )
}

function FinanceRow({title,value,icon,positive}:{title:string,value:string,icon:any,positive?:boolean}){
  return(
    <div className='flex items-center justify-between rounded-2xl border border-zinc-100 bg-zinc-50/70 p-4'>
      <div className='flex items-center gap-3'>
        <div className='grid h-12 w-12 place-items-center rounded-2xl bg-white'>
          {icon}
        </div>
        <div>
          <p className='font-black text-zinc-900'>{title}</p>
          <p className='text-sm text-zinc-500'>Sincronización automática</p>
        </div>
      </div>

      <div className={`text-2xl font-black ${positive ? 'text-emerald-700':'text-zinc-900'}`}>
        {value}
      </div>
    </div>
  )
}
