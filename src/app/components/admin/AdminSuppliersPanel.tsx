import { Building2, FileText, PackagePlus, TrendingUp, Truck } from 'lucide-react'

const suppliers = [
  {
    id:'PRV-001',
    name:'Flores Barcelona Premium',
    category:'Flor cortada',
    lastOrder:'Hoy',
    total:'1.240€',
  },
  {
    id:'PRV-002',
    name:'Green Plants Europe',
    category:'Plantas',
    lastOrder:'Ayer',
    total:'840€',
  },
]

export function AdminSuppliersPanel(){
  return (
    <div className='space-y-6'>
      <section className='rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl backdrop-blur-xl'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <div className='mb-2 inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700'>Compras y proveedores</div>
            <h1 className='text-4xl font-black tracking-tight text-zinc-950'>Proveedores Herencia</h1>
            <p className='mt-2 text-zinc-500'>Control de compras, entradas stock y costes empresariales.</p>
          </div>

          <button className='rounded-[1.5rem] bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-4 text-lg font-black text-white shadow-xl'>
            + Nuevo proveedor
          </button>
        </div>
      </section>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <Card title='Proveedores' value='12' icon={<Building2 className='h-6 w-6 text-emerald-700' />} />
        <Card title='Compras mes' value='4.820€' icon={<Truck className='h-6 w-6 text-emerald-700' />} />
        <Card title='Entradas stock' value='248' icon={<PackagePlus className='h-6 w-6 text-emerald-700' />} />
        <Card title='Coste promedio' value='18%' icon={<TrendingUp className='h-6 w-6 text-emerald-700' />} />
      </div>

      <section className='rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl backdrop-blur-xl'>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h2 className='text-3xl font-black text-zinc-900'>Últimas compras</h2>
            <p className='text-sm font-semibold text-zinc-500'>Conectado con stock y finanzas</p>
          </div>

          <FileText className='h-6 w-6 text-emerald-700' />
        </div>

        <div className='space-y-4'>
          {suppliers.map((supplier)=>(
            <div key={supplier.id} className='rounded-[1.8rem] border border-emerald-100 bg-emerald-50/30 p-5'>
              <div className='flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between'>
                <div className='flex items-center gap-4'>
                  <div className='grid h-16 w-16 place-items-center rounded-[1.6rem] bg-white text-3xl'>🌿</div>

                  <div>
                    <div className='mb-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700'>
                      {supplier.id}
                    </div>

                    <h3 className='text-2xl font-black text-zinc-950'>{supplier.name}</h3>
                    <p className='mt-1 font-semibold text-zinc-500'>{supplier.category}</p>
                  </div>
                </div>

                <div className='flex gap-4'>
                  <Metric label='Último pedido' value={supplier.lastOrder} />
                  <Metric label='Total' value={supplier.total} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Card({title,value,icon}:{title:string,value:string,icon:any}){
  return (
    <div className='rounded-[1.8rem] border border-emerald-100 bg-white/90 p-5 shadow-xl'>
      <div className='mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-emerald-50'>
        {icon}
      </div>
      <p className='text-sm font-bold text-zinc-500'>{title}</p>
      <h3 className='mt-2 text-4xl font-black text-zinc-950'>{value}</h3>
    </div>
  )
}

function Metric({label,value}:{label:string,value:string}){
  return (
    <div className='rounded-2xl bg-white px-5 py-4 text-center shadow-sm'>
      <p className='text-sm font-bold text-zinc-500'>{label}</p>
      <h3 className='mt-1 text-xl font-black text-emerald-700'>{value}</h3>
    </div>
  )
}
