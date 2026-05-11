import { CalendarHeart, Mail, MapPin, Phone, ShoppingBag, Sparkles, Star, UserRound } from "lucide-react";
import { getSales } from "../../lib/tpvFinanceEngine";

function money(value:number){
  return new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(value||0)
}

export function AdminCRMClients(){
  const sales = getSales()

  const customerMap = new Map<string,any>()

  sales.forEach((sale:any)=>{
    const customerName = sale.customer || 'Cliente mostrador'

    const current = customerMap.get(customerName) || {
      name: customerName,
      totalSpent:0,
      orders:0,
      lastOrder:null,
      favorite:'🌹 Rosas',
    }

    customerMap.set(customerName,{
      ...current,
      totalSpent: current.totalSpent + Number(sale.total||0),
      orders: current.orders + 1,
      lastOrder: sale.createdAt,
    })
  })

  const customers = [...customerMap.values()]
    .sort((a,b)=>b.totalSpent-a.totalSpent)

  return (
    <div className='space-y-6'>
      <section className='rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl backdrop-blur-xl'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <div className='mb-2 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700'>CRM conectado al TPV</div>
            <h1 className='text-4xl font-black tracking-tight text-zinc-950'>Clientes Herencia</h1>
            <p className='mt-2 text-zinc-500'>Historial, compras, preferencias y métricas automáticas.</p>
          </div>

          <div className='rounded-[2rem] border border-emerald-100 bg-emerald-50/40 px-5 py-4'>
            <p className='text-sm font-bold text-zinc-500'>Clientes registrados</p>
            <h3 className='text-4xl font-black text-emerald-700'>{customers.length}</h3>
          </div>
        </div>
      </section>

      <div className='grid grid-cols-1 gap-6 xl:grid-cols-2'>
        {customers.map((customer,index)=>(
          <section key={customer.name} className='rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl backdrop-blur-xl'>
            <div className='flex items-start justify-between gap-4'>
              <div className='flex items-center gap-4'>
                <div className='grid h-20 w-20 place-items-center rounded-[2rem] bg-gradient-to-br from-emerald-50 to-rose-50 text-4xl'>
                  🌿
                </div>

                <div>
                  <div className='mb-2 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700'>
                    Cliente #{index+1}
                  </div>

                  <h2 className='text-2xl font-black text-zinc-950'>{customer.name}</h2>

                  <div className='mt-3 flex flex-wrap gap-2'>
                    <Badge icon={<Star className='h-4 w-4' />} text='Cliente frecuente' />
                    <Badge icon={<Sparkles className='h-4 w-4' />} text={customer.favorite} />
                  </div>
                </div>
              </div>

              <div className='rounded-2xl bg-emerald-50 px-4 py-3 text-right'>
                <p className='text-xs font-bold text-zinc-500'>Total gastado</p>
                <h3 className='text-2xl font-black text-emerald-700'>{money(customer.totalSpent)}</h3>
              </div>
            </div>

            <div className='mt-6 grid grid-cols-2 gap-4'>
              <MiniCard icon={<ShoppingBag className='h-5 w-5 text-emerald-700' />} title='Pedidos' value={String(customer.orders)} />

              <MiniCard icon={<CalendarHeart className='h-5 w-5 text-emerald-700' />} title='Última compra' value={customer.lastOrder ? new Date(customer.lastOrder).toLocaleDateString() : '-'} />
            </div>

            <div className='mt-6 rounded-[1.7rem] border border-emerald-100 bg-emerald-50/30 p-5'>
              <div className='mb-4 flex items-center gap-2'>
                <UserRound className='h-5 w-5 text-emerald-700' />
                <h3 className='font-black text-zinc-900'>Información cliente</h3>
              </div>

              <div className='space-y-3'>
                <Info icon={<Phone className='h-4 w-4 text-zinc-500' />} text='Teléfono pendiente' />
                <Info icon={<Mail className='h-4 w-4 text-zinc-500' />} text='Email pendiente' />
                <Info icon={<MapPin className='h-4 w-4 text-zinc-500' />} text='Dirección pendiente' />
              </div>
            </div>
          </section>
        ))}

        {!customers.length && (
          <section className='col-span-full rounded-[2rem] border border-dashed border-emerald-200 bg-white/90 p-16 text-center shadow-xl'>
            <div className='mx-auto mb-5 grid h-28 w-28 place-items-center rounded-full bg-emerald-50 text-6xl'>🌿</div>
            <h2 className='text-4xl font-black text-zinc-950'>Aún no hay clientes</h2>
            <p className='mt-3 text-lg font-semibold text-zinc-500'>Los clientes aparecerán automáticamente cuando se registren ventas en el TPV.</p>
          </section>
        )}
      </div>
    </div>
  )
}

function Badge({icon,text}:{icon:any,text:string}){
  return(
    <div className='flex items-center gap-2 rounded-full bg-white px-3 py-2 text-sm font-black text-zinc-700 shadow-sm'>
      {icon}
      {text}
    </div>
  )
}

function MiniCard({icon,title,value}:{icon:any,title:string,value:string}){
  return(
    <div className='rounded-[1.4rem] border border-emerald-100 bg-white p-4'>
      <div className='mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50'>
        {icon}
      </div>

      <p className='text-sm font-bold text-zinc-500'>{title}</p>
      <h3 className='mt-1 text-2xl font-black text-zinc-950'>{value}</h3>
    </div>
  )
}

function Info({icon,text}:{icon:any,text:string}){
  return(
    <div className='flex items-center gap-3 rounded-2xl bg-white px-4 py-3'>
      {icon}
      <span className='font-semibold text-zinc-600'>{text}</span>
    </div>
  )
}
