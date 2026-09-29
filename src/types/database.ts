// Refleja polo_air_cool_fase1.sql (schema public).

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type EstadoOrden =
  | "recibido"
  | "diagnostico"
  | "en_proceso"
  | "listo"
  | "entregado"
  | "cancelado";

export type TipoEvidencia =
  | "ingreso"
  | "repuesto_viejo"
  | "repuesto_nuevo"
  | "prueba_tecnica"
  | "factura_compra";

export type TipoUnidad = "unidad" | "gramo" | "libra" | "onza";

export type CategoriaGasto =
  | "ayudante"
  | "alimentacion_refrigerio"
  | "flete_acarreo"
  | "herramienta_consumible"
  | "otros";

export type TipoGasSugerido = "R134a" | "R1234yf" | "otro";

export type SemaforoGarantia = "verde" | "amarillo" | "rojo";

/** Payload jsonb de public.obtener_orden_publica(token). */
export type OrdenPublica = {
  orden: {
    estado: EstadoOrden;
    fecha_ingreso: string;
    fecha_entrega: string | null;
    dias_garantia: number;
    fecha_fin_garantia: string | null;
    garantia_semaforo: SemaforoGarantia | null;
    mano_obra: number;
    total_cobrado: number;
  };
  cliente: { nombre: string };
  vehiculo: {
    placa: string;
    marca: string;
    modelo: string;
    anio: number | null;
  };
  repuestos: {
    nombre: string;
    cantidad: number;
    unidad: TipoUnidad;
    precio_unitario: number;
  }[];
  evidencias: {
    tipo: Exclude<TipoEvidencia, "factura_compra">;
    url_imagen: string;
    notas: string | null;
  }[];
};

export type Database = {
  public: {
    Tables: {
      clientes: {
        Row: {
          id: string;
          nombre: string;
          /** WhatsApp E.164, ej: +573001234567 */
          telefono: string;
          documento: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nombre: string;
          telefono: string;
          documento?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nombre?: string;
          telefono?: string;
          documento?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      vehiculos: {
        Row: {
          id: string;
          cliente_id: string;
          /** Normalizada por trigger: MAYÚSCULAS, sin espacios ni guiones. */
          placa: string;
          marca: string;
          modelo: string;
          anio: number | null;
          tipo_gas_sugerido: TipoGasSugerido | null;
          carga_estandar_gramos: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          cliente_id: string;
          placa: string;
          marca: string;
          modelo: string;
          anio?: number | null;
          tipo_gas_sugerido?: TipoGasSugerido | null;
          carga_estandar_gramos?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          cliente_id?: string;
          placa?: string;
          marca?: string;
          modelo?: string;
          anio?: number | null;
          tipo_gas_sugerido?: TipoGasSugerido | null;
          carga_estandar_gramos?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehiculos_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
        ];
      };
      ordenes_servicio: {
        Row: {
          id: string;
          vehiculo_id: string;
          estado: EstadoOrden;
          fecha_ingreso: string;
          fecha_entrega: string | null;
          kilometraje: number | null;
          dias_garantia: number;
          /** date (YYYY-MM-DD); la calcula el trigger. */
          fecha_fin_garantia: string | null;
          mano_obra: number;
          total_cobrado: number;
          token_publico: string;
          notas: string | null;
          /** Fase 2 (polo_air_cool_fase2.sql) */
          diagnostico_inicial: string | null;
          trabajos_a_realizar: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehiculo_id: string;
          estado?: EstadoOrden;
          fecha_ingreso?: string;
          fecha_entrega?: string | null;
          kilometraje?: number | null;
          dias_garantia?: number;
          fecha_fin_garantia?: string | null;
          mano_obra?: number;
          total_cobrado?: number;
          token_publico?: string;
          notas?: string | null;
          diagnostico_inicial?: string | null;
          trabajos_a_realizar?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          vehiculo_id?: string;
          estado?: EstadoOrden;
          fecha_ingreso?: string;
          fecha_entrega?: string | null;
          kilometraje?: number | null;
          dias_garantia?: number;
          fecha_fin_garantia?: string | null;
          mano_obra?: number;
          total_cobrado?: number;
          token_publico?: string;
          notas?: string | null;
          diagnostico_inicial?: string | null;
          trabajos_a_realizar?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ordenes_servicio_vehiculo_id_fkey";
            columns: ["vehiculo_id"];
            isOneToOne: false;
            referencedRelation: "vehiculos";
            referencedColumns: ["id"];
          },
        ];
      };
      evidencias_fotograficas: {
        Row: {
          id: string;
          orden_id: string;
          /** Ruta dentro del bucket 'evidencias-ordenes' (no una URL). */
          url_imagen: string;
          tipo: TipoEvidencia;
          notas: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          orden_id: string;
          url_imagen: string;
          tipo: TipoEvidencia;
          notas?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          orden_id?: string;
          url_imagen?: string;
          tipo?: TipoEvidencia;
          notas?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "evidencias_fotograficas_orden_id_fkey";
            columns: ["orden_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_servicio";
            referencedColumns: ["id"];
          },
        ];
      };
      inventario: {
        Row: {
          id: string;
          codigo: string;
          nombre: string;
          descripcion: string | null;
          tipo_unidad: TipoUnidad;
          stock_actual: number;
          stock_minimo: number;
          costo_compra: number;
          precio_venta: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          codigo: string;
          nombre: string;
          descripcion?: string | null;
          tipo_unidad?: TipoUnidad;
          stock_actual?: number;
          stock_minimo?: number;
          costo_compra?: number;
          precio_venta?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          codigo?: string;
          nombre?: string;
          descripcion?: string | null;
          tipo_unidad?: TipoUnidad;
          stock_actual?: number;
          stock_minimo?: number;
          costo_compra?: number;
          precio_venta?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      orden_repuestos: {
        Row: {
          id: string;
          orden_id: string;
          inventario_id: string;
          cantidad_usada: number;
          costo_unitario: number;
          precio_unitario: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          orden_id: string;
          inventario_id: string;
          cantidad_usada: number;
          /** Si se omite, el trigger toma el costo vigente del inventario. */
          costo_unitario?: number;
          /** Si se omite, el trigger toma el precio vigente del inventario. */
          precio_unitario?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          orden_id?: string;
          inventario_id?: string;
          cantidad_usada?: number;
          costo_unitario?: number;
          precio_unitario?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orden_repuestos_orden_id_fkey";
            columns: ["orden_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_servicio";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orden_repuestos_inventario_id_fkey";
            columns: ["inventario_id"];
            isOneToOne: false;
            referencedRelation: "inventario";
            referencedColumns: ["id"];
          },
        ];
      };
      gastos_caja_menor: {
        Row: {
          id: string;
          /** date (YYYY-MM-DD) */
          fecha: string;
          categoria: CategoriaGasto;
          descripcion: string | null;
          monto: number;
          /** Ruta dentro del bucket 'facturas-gastos'. */
          comprobante_url: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          fecha?: string;
          categoria?: CategoriaGasto;
          descripcion?: string | null;
          monto: number;
          comprobante_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          fecha?: string;
          categoria?: CategoriaGasto;
          descripcion?: string | null;
          monto?: number;
          comprobante_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      v_finanzas_orden: {
        Row: {
          orden_id: string | null;
          placa: string | null;
          estado: EstadoOrden | null;
          fecha_entrega: string | null;
          mano_obra: number | null;
          total_cobrado: number | null;
          costo_repuestos: number | null;
          precio_repuestos: number | null;
          margen_bruto: number | null;
        };
        Relationships: [];
      };
      v_balance_mensual: {
        Row: {
          /** date: primer día del mes */
          mes: string | null;
          ingresos: number | null;
          costo_repuestos: number | null;
          gastos_caja_menor: number | null;
          utilidad_real: number | null;
        };
        Relationships: [];
      };
      v_garantias: {
        Row: {
          orden_id: string | null;
          placa: string | null;
          cliente: string | null;
          telefono: string | null;
          fecha_entrega: string | null;
          dias_garantia: number | null;
          fecha_fin_garantia: string | null;
          dias_restantes: number | null;
          semaforo: SemaforoGarantia | null;
        };
        Relationships: [];
      };
      v_inventario_reposicion: {
        Row: {
          id: string | null;
          codigo: string | null;
          nombre: string | null;
          tipo_unidad: TipoUnidad | null;
          stock_actual: number | null;
          stock_minimo: number | null;
          faltante: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      obtener_orden_publica: {
        Args: { p_token: string };
        Returns: OrdenPublica | null;
      };
      es_staff: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      es_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      fn_generar_token_publico: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
    };
    Enums: {
      estado_orden: EstadoOrden;
      tipo_evidencia: TipoEvidencia;
      tipo_unidad: TipoUnidad;
      categoria_gasto: CategoriaGasto;
    };
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> =
  PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> =
  PublicSchema["Views"][T]["Row"];
