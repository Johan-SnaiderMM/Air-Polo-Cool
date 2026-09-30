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

export type MedioPago = "efectivo" | "transferencia" | "tarjeta" | "otro";

/** Estado de pago de una orden (v_saldo_ordenes.estado_pago). */
export type EstadoPago = "sin_total" | "sin_pago" | "parcial" | "pagado" | "sobrepago";

/** Autoría simple: solo dos operadores, sin roles nuevos. */
export type Autor = "Polo" | "Soporte técnico";

export type EstadoCotizacion =
  | "borrador"
  | "enviada"
  | "aprobada"
  | "rechazada"
  | "convertida";

export type EstadoMantenimiento = "vencido" | "proximo" | "lejano";

/** Checklist de pertenencias al ingreso (ordenes_servicio.pertenencias). */
export type Pertenencias = {
  carroceria: "sin_danos" | "rayones" | "golpes";
  llanta_repuesto: boolean;
  herramientas: boolean;
  documentos: boolean;
  objetos_valor: string;
  notas: string;
};

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
    /** Fase 3 (polo_air_cool_fase3.sql): pagos netos recibidos. Ausente si aún no se ejecutó. */
    pagado?: number;
    /** Fase 3: total_cobrado − pagado. */
    saldo?: number;
  };
  cliente: { nombre: string };
  vehiculo: {
    placa: string;
    marca: string;
    modelo: string;
    anio: number | null;
  };
  repuestos: {
    /** Fase 5 (polo_air_cool_fase5.sql): id de la línea; ausente si aún no se ejecutó. */
    id?: string;
    nombre: string;
    cantidad: number;
    unidad: TipoUnidad;
    precio_unitario: number;
  }[];
  evidencias: {
    tipo: Exclude<TipoEvidencia, "factura_compra">;
    url_imagen: string;
    notas: string | null;
    /** Fase 5: a qué repuesto (id de línea) pertenece la foto. */
    orden_repuesto_id?: string | null;
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
          /** En el taller esto es la LÍNEA (Spark GT, Duster…). Se conserva el nombre de columna. */
          modelo: string;
          /** En el taller esto es el MODELO (año de fabricación). Se conserva el nombre de columna. */
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
          /** Fase 4 */
          pertenencias: Json | null;
          mantenimiento_meses: number | null;
          /** date (YYYY-MM-DD); lo calcula el trigger. */
          proximo_mantenimiento: string | null;
          autor: Autor | null;
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
          pertenencias?: Json | null;
          mantenimiento_meses?: number | null;
          proximo_mantenimiento?: string | null;
          autor?: Autor | null;
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
          pertenencias?: Json | null;
          mantenimiento_meses?: number | null;
          proximo_mantenimiento?: string | null;
          autor?: Autor | null;
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
          /** Fase 5: línea de repuesto de la orden a la que pertenece la foto (viejo / nuevo). */
          orden_repuesto_id: string | null;
        };
        Insert: {
          id?: string;
          orden_id: string;
          url_imagen: string;
          tipo: TipoEvidencia;
          notas?: string | null;
          created_at?: string;
          orden_repuesto_id?: string | null;
        };
        Update: {
          id?: string;
          orden_id?: string;
          url_imagen?: string;
          tipo?: TipoEvidencia;
          notas?: string | null;
          created_at?: string;
          orden_repuesto_id?: string | null;
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
      pagos_orden: {
        Row: {
          id: string;
          orden_id: string;
          /** date (YYYY-MM-DD) */
          fecha: string;
          monto: number;
          medio: MedioPago;
          /** true = devolución al cliente (resta del pagado). */
          es_devolucion: boolean;
          referencia: string | null;
          notas: string | null;
          /** Ruta dentro del bucket 'facturas-gastos' (prefijo pagos/). */
          comprobante_url: string | null;
          registrado_por: string | null;
          autor: Autor | null;
          created_at: string;
          anulado: boolean;
          anulado_motivo: string | null;
          anulado_por: string | null;
          anulado_at: string | null;
        };
        /** Inmutable: no hay política de update/delete; se anula con anular_pago(). */
        Insert: {
          id?: string;
          orden_id: string;
          fecha?: string;
          monto: number;
          medio?: MedioPago;
          es_devolucion?: boolean;
          referencia?: string | null;
          notas?: string | null;
          comprobante_url?: string | null;
          /** Se llena con auth.uid(); si se envía debe coincidir con el usuario. */
          registrado_por?: string | null;
          autor?: Autor | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "pagos_orden_orden_id_fkey";
            columns: ["orden_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_servicio";
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
          /** Fase 4 */
          orden_id: string | null;
          autor: Autor | null;
          registrado_por: string | null;
          updated_at: string | null;
          /** [{ at, por, autor, antes: {...} }] */
          historial: Json;
          anulado: boolean;
          anulado_motivo: string | null;
          anulado_por: string | null;
          anulado_autor: Autor | null;
          anulado_at: string | null;
        };
        Insert: {
          id?: string;
          fecha?: string;
          categoria?: CategoriaGasto;
          descripcion?: string | null;
          monto: number;
          comprobante_url?: string | null;
          created_at?: string;
          orden_id?: string | null;
          autor?: Autor | null;
        };
        /** Se edita con editar_gasto() y se anula con anular_gasto(). */
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "gastos_caja_menor_orden_id_fkey";
            columns: ["orden_id"];
            isOneToOne: false;
            referencedRelation: "ordenes_servicio";
            referencedColumns: ["id"];
          },
        ];
      };
      cotizaciones: {
        Row: {
          id: string;
          vehiculo_id: string;
          estado: EstadoCotizacion;
          fecha: string;
          vigencia_dias: number;
          mano_obra: number;
          notas: string | null;
          orden_id: string | null;
          autor: Autor | null;
          registrado_por: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          vehiculo_id: string;
          estado?: EstadoCotizacion;
          fecha?: string;
          vigencia_dias?: number;
          mano_obra?: number;
          notas?: string | null;
          autor?: Autor | null;
        };
        Update: {
          estado?: EstadoCotizacion;
          fecha?: string;
          vigencia_dias?: number;
          mano_obra?: number;
          notas?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cotizaciones_vehiculo_id_fkey";
            columns: ["vehiculo_id"];
            isOneToOne: false;
            referencedRelation: "vehiculos";
            referencedColumns: ["id"];
          },
        ];
      };
      cotizacion_items: {
        Row: {
          id: string;
          cotizacion_id: string;
          inventario_id: string | null;
          descripcion: string;
          cantidad: number;
          precio_unitario: number;
          costo_unitario: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          cotizacion_id: string;
          inventario_id?: string | null;
          descripcion: string;
          cantidad: number;
          precio_unitario: number;
          costo_unitario?: number;
        };
        Update: {
          inventario_id?: string | null;
          descripcion?: string;
          cantidad?: number;
          precio_unitario?: number;
          costo_unitario?: number;
        };
        Relationships: [
          {
            foreignKeyName: "cotizacion_items_cotizacion_id_fkey";
            columns: ["cotizacion_id"];
            isOneToOne: false;
            referencedRelation: "cotizaciones";
            referencedColumns: ["id"];
          },
        ];
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
      v_saldo_ordenes: {
        Row: {
          orden_id: string | null;
          placa: string | null;
          cliente: string | null;
          telefono: string | null;
          estado: EstadoOrden | null;
          fecha_entrega: string | null;
          total_cobrado: number | null;
          pagado: number | null;
          saldo: number | null;
          estado_pago: EstadoPago | null;
          /** date */
          ultimo_pago: string | null;
        };
        Relationships: [];
      };
      v_cartera: {
        Row: {
          orden_id: string | null;
          placa: string | null;
          cliente: string | null;
          telefono: string | null;
          estado: EstadoOrden | null;
          fecha_entrega: string | null;
          total_cobrado: number | null;
          pagado: number | null;
          saldo: number | null;
          estado_pago: EstadoPago | null;
          ultimo_pago: string | null;
          /** null si la orden aún no se entrega. */
          dias_desde_entrega: number | null;
        };
        Relationships: [];
      };
      v_recaudo_mensual: {
        Row: {
          /** date: primer día del mes */
          mes: string | null;
          recaudado: number | null;
          devoluciones: number | null;
          neto: number | null;
          neto_efectivo: number | null;
          neto_transferencia: number | null;
          neto_tarjeta: number | null;
          neto_otro: number | null;
        };
        Relationships: [];
      };
      v_balance_real: {
        Row: {
          mes: string | null;
          facturado: number | null;
          cobrado: number | null;
          costo_repuestos: number | null;
          gastos: number | null;
          utilidad_real: number | null;
        };
        Relationships: [];
      };
      v_rentabilidad_orden: {
        Row: {
          orden_id: string | null;
          vehiculo_id: string | null;
          placa: string | null;
          cliente: string | null;
          estado: EstadoOrden | null;
          fecha_entrega: string | null;
          total_cobrado: number | null;
          pagado: number | null;
          costo_repuestos: number | null;
          gastos_directos: number | null;
          utilidad_real: number | null;
          utilidad_facturada: number | null;
        };
        Relationships: [];
      };
      v_mantenimientos: {
        Row: {
          orden_id: string | null;
          vehiculo_id: string | null;
          placa: string | null;
          marca: string | null;
          modelo: string | null;
          anio: number | null;
          cliente: string | null;
          telefono: string | null;
          mantenimiento_meses: number | null;
          proximo_mantenimiento: string | null;
          dias_restantes: number | null;
          estado_mantenimiento: EstadoMantenimiento | null;
        };
        Relationships: [];
      };
      v_cotizacion_totales: {
        Row: {
          cotizacion_id: string | null;
          total_repuestos: number | null;
          mano_obra: number | null;
          total: number | null;
          costo_estimado: number | null;
          margen_estimado: number | null;
          items: number | null;
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
      editar_gasto: {
        Args: {
          p_id: string;
          p_fecha: string;
          p_categoria: CategoriaGasto;
          p_monto: number;
          p_descripcion: string | null;
          p_orden_id: string | null;
          p_autor: Autor | null;
        };
        Returns: Database["public"]["Tables"]["gastos_caja_menor"]["Row"];
      };
      anular_gasto: {
        Args: { p_id: string; p_motivo: string; p_autor: Autor | null };
        Returns: Database["public"]["Tables"]["gastos_caja_menor"]["Row"];
      };
      convertir_cotizacion: {
        Args: { p_id: string; p_autor: Autor | null };
        Returns: string;
      };
      anular_pago: {
        Args: { p_pago_id: string; p_motivo: string };
        Returns: Database["public"]["Tables"]["pagos_orden"]["Row"];
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
      medio_pago: MedioPago;
      estado_cotizacion: EstadoCotizacion;
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
