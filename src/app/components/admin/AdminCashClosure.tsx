import { useMemo, useState } from "react";
import { Banknote, CreditCard, Receipt, Wallet } from "lucide-react";
import { getFinanceMovements, getSales } from "../../lib/tpvFinanceEngine";

function money(value:number){
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value||0)
}

export function AdminCashClosure(){
  const [realCash,setRealCash]=useState(0)

  const metrics = useMemo(()=>{
    const sales = getSales()
    const finance = getFinanceMovements()

    const today = new Date().toISOString().slice(0,10)

    const todaySales = sales.filter(s=>s.createdAt.startsWith(today))

    const cash = todaySales
      .filter(s=>s.paymentMethod === 'Efectivo')
      .reduce((sum,s)=>sum+s.total,0)

    const card = todaySales
      .filter(s=>s.paymentMethod === 'Tarjeta')
      .reduce((sum,s)=>sum+s.total,0)

    const bizum = todaySales
      .filter(s=>s.paymentMethod === 'Bizum')
      .reduce((sum,s)=>sum+s.total,0)

    const income = finance
      .filter(f=>f.type==='income')
      .reduce((sum,f)=>sum+f.amount,0)

    return {
      cash,
      card,
      bizum,
      income,
      total: cash+card+bizum,
      difference: realCash-cash,
      transactions: todaySales.length,
    }
  },[realCash])

  return (
    <div className='rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl backdrop-blur-xl'>
      <div className='mb-6 flex items-center gap-3'>
        <div className='grid h-14 w-14 place-items-center rounded-3xl bg-emerald-100 text-2xl'>💰</div>
        <div>
          <h2 className='text-3xl font-black text-zinc-900'>Cierre de caja</h2>
          <p className='text-sm font-semibold text-zinc-500'>Sincronizado con TPV y finanzas</p>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <Card icon={<Banknote className='h-6 w-6 text-emerald-700' />} title='Efectivo' value={money(metrics.cash)} />
        <Card icon={<CreditCard className='h-6 w-6 text-emerald-700' />} title='Tarjeta' value={money(metrics.card)} />
        <Card icon={<Wallet className='h-6 w-6 text-emerald-700' />} title='Bizum' value={money(metrics.bizum)} />
        <Card icon={<Receipt className='h-6 w-6 text-emerald-700' />} title='Transacciones' value={String(metrics.transactions)} />
      </div>

      <div className='mt-6 rounded-[2rem] border border-emerald-100 bg-emerald-50/40 p-5'>
        <div className='flex items-center justify-between py-2'>
          <span className='font-bold text-zinc-600'>Ventas del día</span>
          <span className='text-xl font-black text-emerald-700'>{money(metrics.total)}</span>
        </div>

        <div className='flex items-center justify-between py-2'>
          <span className='font-bold text-zinc-600'>Ingresos registrados</span>
          <span className='text-xl font-black text-emerald-700'>{money(metrics.income)}</span>
        </div>

        <div className='mt-5'>
          <label className='text-sm font-black text-zinc-600'>Caja real contada</label>
          <input
            type='number'
            value={realCash}
            onChange={(e)=>setRealCash(Number(e.target.value))}
            className='mt-2 w-full rounded-2xl border border-emerald-100 px-4 py-4 text-right text-3xl font-black outline-none'
          />
        </div>

        <div className='mt-5 rounded-2xl bg-white p-5'>
          <div className='flex items-center justify-between'>
            <span className='font-bold text-zinc-600'>Caja esperada</span>
            <span className='text-2xl font-black text-zinc-900'>{money(metrics.cash)}</span>
          </div>

          <div className='mt-3 flex items-center justify-between'>
            <span className='font-bold text-zinc-600'>Diferencia</span>
            <span className={`text-2xl font-black ${metrics.difference === 0 ? 'text-emerald-700':'text-rose-600'}`}>
              {money(metrics.difference)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function Card({icon,title,value}:{icon:any,title:string,value:string}){
  return(
    <div className='rounded-[1.7rem] border border-emerald-100 bg-white p-5 shadow-lg'>
      <div className='mb-3 flex items-center justify-between'>
        <div className='grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50'>
          {icon}
        </div>
      </div>
      <p className='text-sm font-bold text-zinc-500'>{title}</p>
      <h3 className='mt-1 text-2xl font-black text-zinc-900'>{value}</h3>
    </div>
  )
}
