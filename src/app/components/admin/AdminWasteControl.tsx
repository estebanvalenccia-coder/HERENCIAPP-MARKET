import { AlertCircle, Flower2, PackageMinus, TrendingDown, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

const WASTE_KEY = 'herencia_waste'

function money(value:number){
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value||0)
}

export function AdminWasteControl(){
  const [product,setProduct]=useState('')
  const [reason,setReason]=useState('Flor dañada')
  const [amount,setAmount]=useState(0)

  const waste = useMemo(()=>{
    return JSON.parse(localStorage.getItem(WASTE_KEY)||'[]')
  },[])

  const totalWaste = waste.reduce((sum:number,item:any)=>sum+Number(item.amount||0),0)

  function registerWaste(){
    if(!product || amount<=0)return

    const next = [
      {
        id: crypto.randomUUID(),
        product,
        reason,
        amount:Number(amount),
        createdAt:new Date().toISOString(),
      },
      ...waste,
    ]

    localStorage.setItem(WASTE_KEY,JSON.stringify(next))

    window.location.reload()
  }

  return(
    <div className='space-y-6'>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-3'>
        <Card
          icon={<Trash2 className='h-6 w-6 text-rose-600' />}
          title='Mermas registradas'
          value={String(waste.length)}
        />

        <Card
          icon={<TrendingDown className='h-6 w-6 text-amber-600' />}
          title='Pérdidas estimadas'
          value={money(totalWaste)}
        />

        <Card
          icon={<PackageMinus className='h-6 w-6 text-emerald-700' />}
          title='Control activo'
          value='LIVE'
        />
      </div>

      <div className='grid grid-cols-1 gap-6 xl:grid-cols-[.9fr_1.1fr]'>
        <section className='rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl backdrop-blur-xl'>
          <div className='mb-6 flex items-center gap-3'>
            <div className='grid h-14 w-14 place-items-center rounded-3xl bg-rose-50 text-2xl'>🥀</div>
            <div>
              <h2 className='text-3xl font-black text-zinc-900'>Registrar merma</h2>
              <p className='text-sm font-semibold text-zinc-500'>Conectado a finanzas y stock</p>
            </div>
          </div>

          <div className='space-y-4'>
            <label className='block'>
              <span className='text-sm font-black text-zinc-600'>Producto</span>
              <input
                value={product}
                onChange={(e)=>setProduct(e.target.value)}
                placeholder='Ej: Rosa roja premium'
                className='mt-2 w-full rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-4 font-semibold outline-none'
              />
            </label>

            <label className='block'>
              <span className='text-sm font-black text-zinc-600'>Motivo</span>
              <select
                value={reason}
                onChange={(e)=>setReason(e.target.value)}
                className='mt-2 w-full rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-4 font-semibold outline-none'
              >
                <option>Flor dañada</option>
                <option>Producto vencido</option>
                <option>Rotura</option>
                <option>Desperdicio</option>
                <option>Pérdida logística</option>
              </select>
            </label>

            <label className='block'>
              <span className='text-sm font-black text-zinc-600'>Coste pérdida</span>
              <input
                type='number'
                value={amount}
                onChange={(e)=>setAmount(Number(e.target.value))}
                className='mt-2 w-full rounded-2xl border border-emerald-100 bg-emerald-50/40 px-4 py-4 text-2xl font-black outline-none'
              />
            </label>

            <button
              onClick={registerWaste}
              className='w-full rounded-[1.6rem] bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-5 text-lg font-black text-white shadow-xl'
            >
              Registrar merma
            </button>
          </div>
        </section>

        <section className='rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl backdrop-blur-xl'>
          <div className='mb-6 flex items-center justify-between'>
            <div>
              <h2 className='text-3xl font-black text-zinc-900'>Historial mermas</h2>
              <p className='text-sm font-semibold text-zinc-500'>Impacto económico automático</p>
            </div>

            <AlertCircle className='h-6 w-6 text-amber-600' />
          </div>

          <div className='space-y-3'>
            {waste.map((item:any)=>(
              <div key={item.id} className='rounded-[1.7rem] border border-rose-100 bg-rose-50/50 p-5'>
                <div className='flex items-start justify-between gap-4'>
                  <div className='flex items-center gap-4'>
                    <div className='grid h-14 w-14 place-items-center rounded-3xl bg-white text-2xl'>
                      🥀
                    </div>

                    <div>
                      <h3 className='font-black text-zinc-900'>{item.product}</h3>
                      <p className='text-sm font-semibold text-zinc-500'>{item.reason}</p>
                    </div>
                  </div>

                  <div className='text-right'>
                    <p className='text-sm font-bold text-zinc-500'>Pérdida</p>
                    <h3 className='text-2xl font-black text-rose-600'>-{money(item.amount)}</h3>
                  </div>
                </div>
              </div>
            ))}

            {!waste.length && (
              <div className='rounded-[2rem] border border-dashed border-emerald-200 p-12 text-center'>
                <Flower2 className='mx-auto mb-5 h-16 w-16 text-emerald-400' />
                <h2 className='text-3xl font-black text-zinc-900'>Sin mermas registradas</h2>
                <p className='mt-2 font-semibold text-zinc-500'>Las pérdidas aparecerán aquí automáticamente.</p>
              </div>
            )}
          </div>
        </section>
      </div>
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
