export interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  image: string;
  description: string;
  featured?: boolean;
}

export const products: Product[] = [
  // Flores
  {
    id: 1,
    name: "Ramo de Rosas Rojas",
    category: "flores",
    price: 45.00,
    image: "https://images.unsplash.com/photo-1743407849750-d7d18f4b8380?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Elegante ramo de 12 rosas rojas frescas",
    featured: true,
  },
  {
    id: 2,
    name: "Ramo de Rosas Blancas",
    category: "flores",
    price: 42.00,
    image: "https://images.unsplash.com/photo-1637426456082-e0b7c02daec5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Delicado ramo de rosas blancas premium",
  },
  {
    id: 3,
    name: "Bouquet Mixto Premium",
    category: "flores",
    price: 65.00,
    image: "https://images.unsplash.com/photo-1674970483657-9b3bcba35299?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Arreglo floral mixto con flores de temporada",
    featured: true,
  },
  {
    id: 4,
    name: "Rosas Rosadas",
    category: "flores",
    price: 38.00,
    image: "https://images.unsplash.com/photo-1709099158463-cae636593236?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Hermoso bouquet de rosas rosadas",
  },

  // Plantas de Interior
  {
    id: 5,
    name: "Monstera Deliciosa",
    category: "plantas-interior",
    price: 28.00,
    image: "https://images.unsplash.com/photo-1581572145515-5c6c361286ca?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Planta tropical de interior, fácil cuidado",
    featured: true,
  },
  {
    id: 6,
    name: "Conjunto de Plantas Decorativas",
    category: "plantas-interior",
    price: 55.00,
    image: "https://images.unsplash.com/photo-1612366206518-535bea7db163?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Set de 3 plantas ideales para decoración",
  },
  {
    id: 7,
    name: "Planta en Maceta Blanca",
    category: "plantas-interior",
    price: 22.00,
    image: "https://images.unsplash.com/photo-1611866972879-3f7c79e1282d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Elegante planta en maceta cerámica blanca",
  },
  {
    id: 8,
    name: "Planta de Salón Grande",
    category: "plantas-interior",
    price: 45.00,
    image: "https://images.unsplash.com/photo-1612366211377-357e2bc523cb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Planta grande perfecta para salones amplios",
  },

  // Orquídeas
  {
    id: 9,
    name: "Orquídea Blanca",
    category: "orquideas",
    price: 32.00,
    image: "https://images.unsplash.com/photo-1768368052646-a6185df478c1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Elegante orquídea blanca en maceta",
    featured: true,
  },
  {
    id: 10,
    name: "Orquídea Púrpura",
    category: "orquideas",
    price: 35.00,
    image: "https://images.unsplash.com/photo-1775405298622-3d8d2977dd02?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Vibrante orquídea púrpura",
  },
  {
    id: 11,
    name: "Orquídea Rosa",
    category: "orquideas",
    price: 33.00,
    image: "https://images.unsplash.com/photo-1759549885072-ea7f9fc57bcf?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Delicada orquídea rosa y blanca",
  },
  {
    id: 12,
    name: "Orquídea Amarilla",
    category: "orquideas",
    price: 36.00,
    image: "https://images.unsplash.com/photo-1772958906381-9be2a193c523?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Orquídea amarilla exótica",
  },

  // Plantas de Exterior y Accesorios
  {
    id: 13,
    name: "Regadera Decorativa",
    category: "accesorios",
    price: 18.00,
    image: "https://images.unsplash.com/photo-1703113690930-fc391676e0de?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Regadera vintage para jardín",
  },
  {
    id: 14,
    name: "Maceta Cerámica Grande",
    category: "macetas",
    price: 25.00,
    image: "https://images.unsplash.com/photo-1707404188225-e0f9a531f2bb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Maceta de cerámica artesanal",
  },
  {
    id: 15,
    name: "Sustrato Premium 5kg",
    category: "sustratos",
    price: 12.00,
    image: "https://images.unsplash.com/photo-1771131404869-5a813dcf9796?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Sustrato orgánico para todo tipo de plantas",
  },
  {
    id: 16,
    name: "Fertilizante Orgánico",
    category: "fertilizantes",
    price: 15.00,
    image: "https://images.unsplash.com/photo-1722634037789-09a9fffdd334?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=600",
    description: "Fertilizante 100% orgánico",
  },
];

export const categories = [
  { id: "todos", name: "Todos" },
  { id: "flores", name: "Flores" },
  { id: "plantas-interior", name: "Plantas de Interior" },
  { id: "plantas-exterior", name: "Plantas de Exterior" },
  { id: "orquideas", name: "Orquídeas" },
  { id: "macetas", name: "Macetas" },
  { id: "sustratos", name: "Sustratos" },
  { id: "fertilizantes", name: "Fertilizantes" },
  { id: "accesorios", name: "Accesorios" },
];
