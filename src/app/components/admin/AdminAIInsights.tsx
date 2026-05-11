import { BrainCircuit, Lightbulb, Sparkles, TrendingUp, WandSparkles } from 'lucide-react'

const insights = [
  {
    title:'Rosas rojas en tendencia',
    description:'Las rosas rojas aumentaron ventas un 32% esta semana.',
    type:'Ventas',
  },
  {
    title:'Stock bajo detectado',
    description:'La IA recomienda reponer peonías antes del viernes.',
    type:'Inventario',
  },
  {
    title:'Cliente VIP detectado',
    description:'María García realizó 8 compras este mes.',
    type:'CRM',
  },
]

export function AdminAIInsights(){
  return (
    <div className='space-y-6'>
      <section className='relative overflow-hidden rounded-[2.5rem] border border-emerald-100 bg-gradient-to-br from-emerald-500 via-green-500 to-emerald-600 p-8 text-white shadow-2xl'>
        <div className='absolute left-0 top-0 h-72 w-72 rounded-full bg-white/10 blur-3xl'></div>
        <div className='absolute right-0 bottom-0 h-72 w-72 rounded-full bg-emerald-200/20 blur-3xl'></div>

        <div className='relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between'>
          <div>
            <div className='mb-3 inline-flex rounded-full bg-white/15 px-4 py-2 text-sm font-black'>
              IA Herencia activa
            </div>

            <h1 className='max-w-3xl text-5xl font-black tracking-tight'>
              Inteligencia artificial empresarial
            </h1>

            <p className='mt-4 max-w-2xl text-lg text-emerald-50'>
              Predicciones, recomendaciones, análisis de clientes y optimización automática del negocio.
            </p>
          </div>

          <div className='grid h-40 w-40 place-items-center rounded-full border border-white/20 bg-white/10 backdrop-blur-xl'>
            <BrainCircuit className='h-20 w-20 text-white' />
          </div>
        </div>
      </section>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <Card title='Predicciones IA' value='24' icon={<TrendingUp className='h-6 w-6 text-emerald-700' />} />
        <Card title='Clientes analizados' value='184' icon={<Sparkles className='h-6 w-6 text-emerald-700' />} />
        <Card title='Recomendaciones' value='12' icon={<Lightbulb className='h-6 w-6 text-emerald-700' />} />
        <Card title='IA activa' value='LIVE' icon={<WandSparkles className='h-6 w-6 text-emerald-700' />} />
      </div>

      <section className='rounded-[2rem] border border-emerald-100 bg-white/90 p-6 shadow-xl backdrop-blur-xl'>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h2 className='text-3xl font-black text-zinc-900'>Insights inteligentes</h2>
            <p className='text-sm font-semibold text-zinc-500'>Análisis automáticos del ERP</p>
          </div>

          <BrainCircuit className='h-7 w-7 text-emerald-700' />
        </div>

        <div className='space-y-4'>
          {insights.map((insight,index)=>(
            <div key={index} className='rounded-[1.8rem] border border-emerald-100 bg-emerald-50/30 p-5'>
              <div className='flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between'>
                <div className='flex items-center gap-4'>
                  <div className='grid h-16 w-16 place-items-center rounded-[1.6rem] bg-white text-3xl'>✨</div>

                  <div>
                    <div className='mb-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-black text-emerald-700'>
                      {insight.type}
                    </div>

                    <h3 className='text-2xl font-black text-zinc-950'>{insight.title}</h3>
                    <p className='mt-2 font-semibold text-zinc-500'>{insight.description}</p>
                  </div>
                </div>

                <button className='rounded-2xl bg-white px-5 py-4 font-black text-emerald-700 shadow-sm'>
                  Ver análisis
                </button>
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
